// Categorization rules. Run: npx tsx scripts/test-rules.mts
import { applyRules, ruleAlreadyCovers, ruleMatches, suggestRuleValue, type Rule } from '../utils/rules'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

let n = 0
const rule = (p: Partial<Rule>): Rule => ({
  id: `r${++n}`,
  position: n,
  matchField: 'description',
  matchOp: 'contains',
  matchValue: '',
  matchType: null,
  setCategoryId: null,
  setTags: [],
  setWalletId: null,
  enabled: true,
  ...p,
})

const food = rule({ matchValue: 'Jollibee', setCategoryId: 'food' })
check('contains ignores case and spaces', ruleMatches(food, { description: '  JOLLIBEE   SM North ', type: 'expense' }))
check('no match on other text', !ruleMatches(food, { description: 'McDonalds', type: 'expense' }))
check('starts with', ruleMatches(rule({ matchOp: 'starts_with', matchValue: 'grab' }), { description: 'Grab ride' }))
check('ends with', ruleMatches(rule({ matchOp: 'ends_with', matchValue: 'load' }), { description: 'Smart load' }))
check('equals is exact', !ruleMatches(rule({ matchOp: 'equals', matchValue: 'meralco' }), { description: 'Meralco bill' }))
check('notes field', ruleMatches(rule({ matchField: 'notes', matchValue: 'office' }), { description: 'Lunch', notes: 'office team' }))
check('type filter', !ruleMatches(rule({ matchValue: 'gcash', matchType: 'income' }), { description: 'GCash', type: 'expense' }))
check('transfers are left alone', !ruleMatches(food, { description: 'Jollibee', type: 'transfer' }))
check('empty match value never matches', !ruleMatches(rule({ matchValue: '  ' }), { description: 'anything' }))

// Order and conflicts.
const coffee = rule({ position: 1, matchValue: 'starbucks', setCategoryId: 'coffee', setTags: ['treat'] })
const dining = rule({ position: 2, matchValue: 'starbucks', setCategoryId: 'dining', setWalletId: 'card', setTags: ['treat', 'out'] })
const r1 = applyRules([dining, coffee], { description: 'Starbucks BGC', type: 'expense' })
check('rules apply in the order set, not the order given', r1.categoryId === 'coffee' && r1.categoryRule?.id === coffee.id, r1)
check('a later rule fills what is still empty', r1.walletId === 'card', r1)
check('tags from every matching rule, once each', JSON.stringify(r1.tags) === '["treat","out"]', r1.tags)
const r2 = applyRules([{ ...coffee, position: 3 }, dining], { description: 'Starbucks BGC', type: 'expense' })
check('moving a rule changes which one wins', r2.categoryId === 'dining', r2)
const r3 = applyRules([{ ...coffee, enabled: false }, dining], { description: 'Starbucks', type: 'expense' })
check('a disabled rule is skipped', r3.categoryId === 'dining' && !r3.matched.some((r) => r.id === coffee.id), r3)
check('nothing matches: nothing set', applyRules([coffee, dining], { description: 'Jollibee' }).categoryId === null)

// Offering a rule after a fix.
check('suggest strips refs and amounts', suggestRuleValue('JOLLIBEE SM NORTH EDSA Ref No. 1234567890 PHP 245.00') === 'jollibee sm north', suggestRuleValue('JOLLIBEE SM NORTH EDSA Ref No. 1234567890 PHP 245.00'))
check('suggest skips notes with nothing to match', suggestRuleValue('12/05 1,250.00') === null, suggestRuleValue('12/05 1,250.00'))
check('an existing rule covers it', ruleAlreadyCovers([coffee], { description: 'starbucks', type: 'expense' }, 'coffee'))

console.log(failures ? `${failures} FAILURES` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
