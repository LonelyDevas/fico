// Local query engine: runs supabase-js style calls (from().select().eq()..., rpc()) against the
// on-device Postgres, so the app's existing query code works unchanged offline.
//
// Reads are answered from the local database. Writes are applied locally, and every write that
// really changed something is queued in the outbox so lib/local/sync.ts can replay it to Supabase.
//
// The output mimics PostgREST: rows come back as JSON (numbers as numbers, timestamps as ISO
// strings), embedded selects like `category:categories(name)` become nested objects, and errors are
// plain `{ message, details, hint, code }` objects.

/** A recorded builder call, e.g. ['eq', ['status', 'active']]. */
export type Call = [method: string, args: unknown[]]

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  /** Forces pending writes to disk (PGlite with relaxed durability). */
  syncToFs?(): Promise<void>
}

export interface ForeignKey {
  name: string
  table: string
  cols: string[]
  refTable: string
  refCols: string[]
}

export interface FunctionInfo {
  name: string
  retSet: boolean
  returnsVoid: boolean
}

export interface Catalog {
  tables: Set<string>
  tablesWithId: Set<string>
  tablesWithUpdatedAt: Set<string>
  fks: ForeignKey[]
  functions: Map<string, FunctionInfo>
}

export interface QueryResult {
  data: unknown
  error: { message: string; details: string; hint: string; code: string } | null
  count: number | null
  status: number
  statusText: string
}

export type OutboxPayload =
  | { kind: 'rpc'; payload: { name: string; args: Record<string, unknown> } }
  | { kind: 'table'; payload: { table: string; calls: Call[] } }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

const ident = (name: string): string => {
  if (!IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`)
  return `"${name}"`
}

class QueryError extends Error {
  code: string
  details: string
  hint: string
  constructor(message: string, code = '', details = '', hint = '') {
    super(message)
    this.code = code
    this.details = details
    this.hint = hint
  }
}

export async function loadCatalog(db: Db): Promise<Catalog> {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and table_name not like '\\_%'`
  )
  const tables = new Set<string>()
  const tablesWithId = new Set<string>()
  const tablesWithUpdatedAt = new Set<string>()
  for (const c of cols.rows) {
    tables.add(c.table_name)
    if (c.column_name === 'id') tablesWithId.add(c.table_name)
    if (c.column_name === 'updated_at') tablesWithUpdatedAt.add(c.table_name)
  }

  const fkRows = await db.query<{ conname: string; tbl: string; reftbl: string; cols: string[]; refcols: string[] }>(
    `select c.conname,
            c.conrelid::regclass::text as tbl,
            c.confrelid::regclass::text as reftbl,
            (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
            (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as refcols
     from pg_constraint c
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace`
  )
  const fks: ForeignKey[] = fkRows.rows.map((r) => ({
    name: r.conname,
    table: r.tbl,
    cols: r.cols,
    refTable: r.reftbl,
    refCols: r.refcols,
  }))

  const fnRows = await db.query<{ proname: string; proretset: boolean; rettype: string }>(
    `select p.proname, p.proretset, p.prorettype::regtype::text as rettype
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'`
  )
  const functions = new Map<string, FunctionInfo>()
  for (const f of fnRows.rows) {
    functions.set(f.proname, { name: f.proname, retSet: f.proretset, returnsVoid: f.rettype === 'void' })
  }

  return { tables, tablesWithId, tablesWithUpdatedAt, fks, functions }
}

// ---------------------------------------------------------------------------------------------
// select-string parsing:  "*, category:categories(name,type), wallet:wallets!bills_wallet_id_fkey(name)"

type SelectItem =
  | { kind: 'star' }
  | { kind: 'col'; name: string; alias?: string }
  | { kind: 'embed'; alias: string; table: string; hint?: string; inner: boolean; items: SelectItem[] }

function splitTopLevel(src: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of src) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function parseSelect(src: string | undefined): SelectItem[] {
  if (!src || !src.trim()) return [{ kind: 'star' }]
  return splitTopLevel(src).map((token): SelectItem => {
    if (token === '*') return { kind: 'star' }
    const embed = /^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!(\w+))?\(([\s\S]*)\)$/.exec(token)
    if (embed) {
      const [, alias, table, hint1, hint2, inner] = embed
      const hints = [hint1, hint2].filter(Boolean) as string[]
      const isInner = hints.includes('inner')
      return {
        kind: 'embed',
        alias: alias ?? table,
        table,
        hint: hints.find((h) => h !== 'inner' && h !== 'left'),
        inner: isInner,
        items: parseSelect(inner),
      }
    }
    const aliased = /^(\w+):(\w+)$/.exec(token)
    if (aliased) return { kind: 'col', name: aliased[2], alias: aliased[1] }
    return { kind: 'col', name: token.replace(/::\w+$/, '') }
  })
}

// ---------------------------------------------------------------------------------------------
// SQL building

class Params {
  values: unknown[] = []
  push(value: unknown): string {
    this.values.push(normalizeParam(value))
    return `$${this.values.length}`
  }
}

function normalizeParam(value: unknown): unknown {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    // Arrays of primitives are Postgres arrays; arrays holding objects are JSON.
    return value.some((v) => v !== null && typeof v === 'object') ? JSON.stringify(value) : value
  }
  if (value !== null && typeof value === 'object') return JSON.stringify(value)
  return value
}

const OPERATORS: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  ilike: 'ilike',
  cs: '@>',
  cd: '<@',
  ov: '&&',
}

/** PostgREST puts `*` wildcards inside `like`/`ilike` filter strings. */
const likeValue = (op: string, value: unknown) =>
  (op === 'like' || op === 'ilike') && typeof value === 'string' ? value.replace(/\*/g, '%') : value

function parseListValue(raw: string): string[] {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '')
  return inner
    .split(',')
    .map((v) => v.trim().replace(/^"(.*)"$/, '$1'))
    .filter((v) => v.length > 0)
}

function condition(column: string, op: string, value: unknown, p: Params, alias: string): string {
  const col = `${alias}.${ident(column)}`
  if (op === 'is') {
    if (value === null || value === 'null') return `${col} is null`
    if (value === true || value === 'true') return `${col} is true`
    if (value === false || value === 'false') return `${col} is false`
    throw new QueryError(`Unsupported "is" value: ${String(value)}`)
  }
  if (op === 'in') {
    const list = Array.isArray(value) ? value : parseListValue(String(value))
    return list.length === 0 ? 'false' : `${col} = any(${p.push(list)})`
  }
  if (op in OPERATORS) {
    let v = likeValue(op, value)
    // `cs`, `cd`, `ov` carry a Postgres array literal like {a,b} or (a,b) when they come from a string.
    if ((op === 'cs' || op === 'cd' || op === 'ov') && typeof v === 'string') v = parseListValue(v.replace(/^\{/, '(').replace(/\}$/, ')'))
    return `${col} ${OPERATORS[op]} ${p.push(v)}`
  }
  throw new QueryError(`Unsupported filter operator: ${op}`)
}

/** Parses the argument of `.or("a.eq.1,b.in.(1,2),and(c.gt.2,d.lt.5)")` into SQL. */
function orExpression(src: string, p: Params, alias: string, joiner: 'or' | 'and' = 'or'): string {
  const parts = splitTopLevel(src).map((item) => {
    const group = /^(and|or)\(([\s\S]*)\)$/.exec(item)
    if (group) return `(${orExpression(group[2], p, alias, group[1] as 'or' | 'and')})`
    const negated = item.match(/^([\w]+)\.not\.(\w+)\.([\s\S]*)$/)
    if (negated) return `not (${condition(negated[1], negated[2], negated[3], p, alias)})`
    const m = /^([\w]+)\.(\w+)\.([\s\S]*)$/.exec(item)
    if (!m) throw new QueryError(`Cannot parse filter: ${item}`)
    return condition(m[1], m[2], m[3], p, alias)
  })
  return parts.join(` ${joiner} `)
}

interface Plan {
  mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  values?: Record<string, unknown>[]
  patch?: Record<string, unknown>
  select?: string
  /** True once .select() was chained, even without columns (returns the written rows). */
  hasSelect: boolean
  selectOptions: { count?: string; head?: boolean }
  filters: Call[]
  orders: { column: string; ascending: boolean; nullsFirst?: boolean }[]
  limit?: number
  offset?: number
  single: 'single' | 'maybeSingle' | null
  onConflict?: string
  ignoreDuplicates: boolean
  throwOnError: boolean
}

const FILTER_METHODS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'containedBy', 'overlaps', 'or', 'not', 'filter', 'match', 'and',
])

function planFromCalls(calls: Call[]): Plan {
  const plan: Plan = {
    mode: 'select',
    hasSelect: false,
    selectOptions: {},
    filters: [],
    orders: [],
    single: null,
    ignoreDuplicates: false,
    throwOnError: false,
  }
  for (const [method, args] of calls) {
    switch (method) {
      case 'select': {
        const [columns, options] = args as [string | undefined, { count?: string; head?: boolean } | undefined]
        plan.select = columns
        plan.hasSelect = true
        if (options) plan.selectOptions = options
        break
      }
      case 'insert': {
        plan.mode = 'insert'
        const [values] = args as [Record<string, unknown> | Record<string, unknown>[]]
        plan.values = Array.isArray(values) ? values : [values]
        break
      }
      case 'upsert': {
        plan.mode = 'upsert'
        const [values, options] = args as [Record<string, unknown> | Record<string, unknown>[], { onConflict?: string; ignoreDuplicates?: boolean } | undefined]
        plan.values = Array.isArray(values) ? values : [values]
        plan.onConflict = options?.onConflict
        plan.ignoreDuplicates = options?.ignoreDuplicates ?? false
        break
      }
      case 'update':
        plan.mode = 'update'
        plan.patch = (args[0] ?? {}) as Record<string, unknown>
        break
      case 'delete':
        plan.mode = 'delete'
        break
      case 'order': {
        const [column, options] = args as [string, { ascending?: boolean; nullsFirst?: boolean } | undefined]
        plan.orders.push({ column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst })
        break
      }
      case 'limit':
        plan.limit = Number(args[0])
        break
      case 'range': {
        const [from, to] = args as [number, number]
        plan.offset = from
        plan.limit = to - from + 1
        break
      }
      case 'single':
        plan.single = 'single'
        break
      case 'maybeSingle':
        plan.single = 'maybeSingle'
        break
      case 'throwOnError':
        plan.throwOnError = true
        break
      default:
        if (FILTER_METHODS.has(method)) plan.filters.push([method, args])
    }
  }
  return plan
}

function whereClause(filters: Call[], p: Params, alias: string): string {
  const parts: string[] = []
  for (const [method, args] of filters) {
    switch (method) {
      case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte': case 'like': case 'ilike': case 'is': case 'in': {
        const [column, value] = args as [string, unknown]
        parts.push(condition(column, method, value, p, alias))
        break
      }
      case 'contains': parts.push(condition(args[0] as string, 'cs', args[1], p, alias)); break
      case 'containedBy': parts.push(condition(args[0] as string, 'cd', args[1], p, alias)); break
      case 'overlaps': parts.push(condition(args[0] as string, 'ov', args[1], p, alias)); break
      case 'not': {
        const [column, op, value] = args as [string, string, unknown]
        parts.push(`not (${condition(column, op, value, p, alias)})`)
        break
      }
      case 'filter': {
        const [column, op, value] = args as [string, string, unknown]
        parts.push(condition(column, op, value, p, alias))
        break
      }
      case 'match': {
        for (const [column, value] of Object.entries(args[0] as Record<string, unknown>)) {
          parts.push(condition(column, value === null ? 'is' : 'eq', value, p, alias))
        }
        break
      }
      case 'or':
        parts.push(`(${orExpression(args[0] as string, p, alias)})`)
        break
      case 'and':
        parts.push(`(${orExpression(args[0] as string, p, alias, 'and')})`)
        break
    }
  }
  return parts.length ? `where ${parts.join(' and ')}` : ''
}

export class LocalEngine {
  private aliasCounter = 0

  constructor(
    private readonly db: Db,
    readonly catalog: Catalog,
    /** Called after a write is queued, so sync can start. */
    private readonly onQueued?: () => void
  ) {}

  hasTable(table: string): boolean {
    return this.catalog.tables.has(table)
  }

  /**
   * Functions that run locally. Anything that can write must be one sync_replay accepts (migration
   * 0047), otherwise it would be queued and then refused; reports only read.
   */
  hasFunction(name: string): boolean {
    return (
      this.catalog.functions.has(name) &&
      /^(reports|wallets|categories|transactions|bills|budgets|obligations|investments|cards)_/.test(name)
    )
  }

  // --- embedded select expressions ------------------------------------------------------------

  private nextAlias(): string {
    return `_e${++this.aliasCounter}`
  }

  private findRelation(parent: string, target: string, hint?: string): { fk: ForeignKey; toOne: boolean } {
    const matches: { fk: ForeignKey; toOne: boolean }[] = []
    for (const fk of this.catalog.fks) {
      if (hint && fk.name !== hint && !fk.cols.includes(hint)) continue
      if (fk.table === parent && fk.refTable === target) matches.push({ fk, toOne: true })
      else if (fk.table === target && fk.refTable === parent) matches.push({ fk, toOne: false })
    }
    if (matches.length === 0) throw new QueryError(`Could not find a relationship between ${parent} and ${target}`, 'PGRST200')
    if (matches.length > 1) throw new QueryError(`More than one relationship between ${parent} and ${target}`, 'PGRST201')
    return matches[0]
  }

  private selectExpressions(items: SelectItem[], table: string, alias: string): string[] {
    const out: string[] = []
    for (const item of items) {
      if (item.kind === 'star') out.push(`${alias}.*`)
      else if (item.kind === 'col') out.push(`${alias}.${ident(item.name)}${item.alias ? ` as ${ident(item.alias)}` : ''}`)
      else out.push(this.embedExpression(item, table, alias))
    }
    return out
  }

  private embedExpression(item: Extract<SelectItem, { kind: 'embed' }>, parentTable: string, parentAlias: string): string {
    const { fk, toOne } = this.findRelation(parentTable, item.table, item.hint)
    const a = this.nextAlias()
    const inner = this.selectExpressions(item.items, item.table, a).join(', ')
    const link = toOne
      ? fk.cols.map((c, i) => `${a}.${ident(fk.refCols[i])} = ${parentAlias}.${ident(c)}`).join(' and ')
      : fk.cols.map((c, i) => `${a}.${ident(c)} = ${parentAlias}.${ident(fk.refCols[i])}`).join(' and ')
    const rows = `select ${inner} from public.${ident(item.table)} ${a} where ${link}`
    return toOne
      ? `(select to_jsonb(_x) from (${rows} limit 1) _x) as ${ident(item.alias)}`
      : `coalesce((select jsonb_agg(to_jsonb(_x)) from (${rows}) _x), '[]'::jsonb) as ${ident(item.alias)}`
  }

  // --- execution --------------------------------------------------------------------------------

  async execute(kind: 'table' | 'rpc', target: string, calls: Call[]): Promise<QueryResult> {
    try {
      const result = kind === 'rpc' ? await this.runRpc(target, calls) : await this.runTable(target, calls)
      return { ...result, error: null, status: 200, statusText: 'OK' }
    } catch (e) {
      const err = e as { message?: string; code?: string; detail?: string; hint?: string; details?: string }
      const error = {
        message: err.message ?? 'Local query failed',
        details: err.detail ?? err.details ?? '',
        hint: err.hint ?? '',
        code: err.code ?? '',
      }
      if (calls.some(([m]) => m === 'throwOnError')) throw Object.assign(new Error(error.message), error)
      return { data: null, error, count: null, status: error.code === 'PGRST116' ? 406 : 400, statusText: 'Bad Request' }
    }
  }

  private async runRpc(name: string, calls: Call[]): Promise<Pick<QueryResult, 'data' | 'count'>> {
    const info = this.catalog.functions.get(name)
    if (!info) throw new QueryError(`Could not find the function public.${name}`, 'PGRST202')
    const [args = {}] = (calls.find(([m]) => m === 'rpc-args')?.[1] ?? [{}]) as [Record<string, unknown>]
    const single = calls.find(([m]) => m === 'single' || m === 'maybeSingle')?.[0] as 'single' | 'maybeSingle' | undefined

    const p = new Params()
    const named = Object.entries(args)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${ident(k)} => ${p.push(v)}`)
      .join(', ')
    const call = `public.${ident(name)}(${named})`
    const sql = info.retSet
      ? `select coalesce(jsonb_agg(to_jsonb(_f)), '[]'::jsonb) as r from ${call} _f`
      : info.returnsVoid
        ? `select ${call}, null::jsonb as r`
        : `select to_jsonb(${call}) as r`

    const { value } = await this.mutating(
      { kind: 'rpc', payload: { name, args: Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)) } },
      async (tx) => {
        const res = await tx.query<{ r: unknown }>(sql, p.values)
        return res.rows[0]?.r ?? null
      }
    )
    return { data: this.applySingle(value, single), count: null }
  }

  private applySingle(value: unknown, single: 'single' | 'maybeSingle' | null | undefined): unknown {
    if (!single) return value
    const rows = Array.isArray(value) ? value : value == null ? [] : [value]
    if (rows.length === 1) return rows[0]
    if (rows.length === 0 && single === 'maybeSingle') return null
    throw new QueryError('JSON object requested, multiple (or no) rows returned', 'PGRST116', `The result contains ${rows.length} rows`)
  }

  private async runTable(table: string, calls: Call[]): Promise<Pick<QueryResult, 'data' | 'count'>> {
    if (!this.hasTable(table)) throw new QueryError(`Could not find the table public.${table}`, 'PGRST205')
    const plan = planFromCalls(calls)
    if (plan.mode === 'select') return this.runSelect(table, plan)
    // Work on a JSON copy (what supabase-js would send), so adding ids never touches the caller's objects.
    const copy = JSON.parse(JSON.stringify(calls)) as Call[]
    return this.runMutation(table, planFromCalls(copy), copy)
  }

  private selectSql(table: string, plan: Plan, source: string, p: Params, withPaging: boolean): string {
    const alias = '_t0'
    const exprs = this.selectExpressions(parseSelect(plan.select), table, alias)
    const where = source === 'cte' ? '' : whereClause(plan.filters, p, alias)
    const order = plan.orders.length
      ? 'order by ' +
        plan.orders
          .map((o) => `${alias}.${ident(o.column)} ${o.ascending ? 'asc' : 'desc'}${o.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'}`)
          .join(', ')
      : ''
    const paging = withPaging
      ? `${plan.limit !== undefined ? `limit ${Math.max(0, Math.floor(plan.limit))}` : ''} ${plan.offset ? `offset ${Math.floor(plan.offset)}` : ''}`
      : ''
    const from = source === 'cte' ? `_m ${alias}` : `public.${ident(table)} ${alias}`
    return `select to_jsonb(_r) as row from (select ${exprs.join(', ')} from ${from} ${where} ${order} ${paging}) _r`
  }

  private async runSelect(table: string, plan: Plan): Promise<Pick<QueryResult, 'data' | 'count'>> {
    const p = new Params()
    const sql = this.selectSql(table, plan, 'table', p, true)
    let count: number | null = null
    if (plan.selectOptions.count) {
      const cp = new Params()
      const where = whereClause(plan.filters, cp, '_t0')
      const res = await this.db.query<{ n: number }>(`select count(*)::int as n from public.${ident(table)} _t0 ${where}`, cp.values)
      count = res.rows[0]?.n ?? 0
    }
    if (plan.selectOptions.head) return { data: null, count }
    const res = await this.db.query<{ row: unknown }>(sql, p.values)
    const rows = res.rows.map((r) => r.row)
    return { data: plan.single ? this.applySingle(rows, plan.single) : rows, count }
  }

  private async runMutation(table: string, plan: Plan, calls: Call[]): Promise<Pick<QueryResult, 'data' | 'count'>> {
    // Rows created on the device get their id here, so the queued copy carries the same one.
    if ((plan.mode === 'insert' || plan.mode === 'upsert') && this.catalog.tablesWithId.has(table)) {
      for (const row of plan.values ?? []) if (row.id === undefined) row.id = crypto.randomUUID()
    }

    const p = new Params()
    let dml: string
    if (plan.mode === 'insert' || plan.mode === 'upsert') {
      const rows = plan.values ?? []
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))]
      if (rows.length === 0) return { data: [], count: null }
      const valuesSql = rows
        .map((r) => `(${columns.map((c) => (r[c] === undefined ? 'default' : p.push(r[c]))).join(', ')})`)
        .join(', ')
      let conflict = ''
      if (plan.mode === 'upsert') {
        const target = (plan.onConflict ?? 'id').split(',').map((c) => c.trim())
        const updates = columns.filter((c) => !target.includes(c))
        conflict =
          plan.ignoreDuplicates || updates.length === 0
            ? `on conflict (${target.map(ident).join(', ')}) do nothing`
            : `on conflict (${target.map(ident).join(', ')}) do update set ${updates.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`
      }
      dml = `insert into public.${ident(table)} (${columns.map(ident).join(', ')}) values ${valuesSql} ${conflict} returning *`
    } else if (plan.mode === 'update') {
      const entries = Object.entries(plan.patch ?? {}).filter(([, v]) => v !== undefined)
      if (entries.length === 0) return { data: [], count: null }
      const set = entries.map(([c, v]) => `${ident(c)} = ${p.push(v)}`).join(', ')
      dml = `update public.${ident(table)} _t0 set ${set} ${whereClause(plan.filters, p, '_t0')} returning *`
    } else {
      dml = `delete from public.${ident(table)} _t0 ${whereClause(plan.filters, p, '_t0')} returning *`
    }

    const sql = `with _m as (${dml}) ${plan.hasSelect ? this.selectSql(table, plan, 'cte', p, false) : `select to_jsonb(_m) as row from _m`}`
    const { value } = await this.mutating({ kind: 'table', payload: { table, calls } }, async (tx) => {
      const res = await tx.query<{ row: unknown }>(sql, p.values)
      return res.rows.map((r) => r.row)
    })
    const rows = value as unknown[]
    if (!plan.hasSelect) return { data: null, count: null }
    return { data: plan.single ? this.applySingle(rows, plan.single) : rows, count: null }
  }

  /**
   * Runs `work` in a transaction. If it changed any data it is queued for sync together with the
   * ids of the rows it inserted; read-only calls (and no-op updates) leave the outbox alone.
   */
  private async mutating<T>(entry: OutboxPayload, work: (tx: Db) => Promise<T>): Promise<{ value: T }> {
    let queued = false
    const value = await this.db.transaction(async (tx) => {
      await tx.query('truncate table public._sync_id_log')
      await tx.query(`select set_config('app.dirty', '', true)`)
      const result = await work(tx)
      const dirty = (await tx.query<{ d: string | null }>(`select current_setting('app.dirty', true) as d`)).rows[0]?.d
      if (dirty === '1') {
        const ids = (await tx.query<{ id: string }>('select id from public._sync_id_log order by seq')).rows.map((r) => r.id)
        await tx.query('insert into public._sync_outbox (kind, payload, ids) values ($1, $2::jsonb, $3::jsonb)', [
          entry.kind,
          JSON.stringify(entry.payload),
          JSON.stringify(ids),
        ])
        queued = true
      }
      return result
    })
    if (queued) {
      // Make sure the change (and its queue entry) is on disk before reporting success.
      await this.db.syncToFs?.()
      this.onQueued?.()
    }
    return { value }
  }
}
