// A supabase-js look-alike query builder that only records the chained calls.
// Nothing runs until it is awaited; then `run` decides where the recorded calls execute
// (the local database or, for tables only Supabase has, the real client).
import type { Call, QueryResult } from './engine'

export type Runner = (calls: Call[]) => Promise<QueryResult>

export function recordingBuilder(initial: Call[], run: Runner): unknown {
  const calls: Call[] = [...initial]
  let pending: Promise<QueryResult> | null = null
  const start = () => (pending ??= run(calls))

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return (res?: (v: QueryResult) => unknown, rej?: (e: unknown) => unknown) => start().then(res, rej)
      if (prop === 'catch') return (rej?: (e: unknown) => unknown) => start().catch(rej)
      if (prop === 'finally') return (fn?: () => void) => start().finally(fn)
      if (typeof prop === 'symbol') return undefined
      return (...args: unknown[]) => {
        calls.push([prop, args])
        return proxy
      }
    },
  }
  const proxy: unknown = new Proxy({}, handler)
  return proxy
}
