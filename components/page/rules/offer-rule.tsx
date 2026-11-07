import { actionToast } from '@/components/ui/action-toast'
import { useRuleSheet } from '@/components/page/rules/rule-sheet'
import { ruleAlreadyCovers, suggestRuleValue, type Rule } from '@/utils/rules'

/**
 * After the user fixes a category by hand, offers to make it a rule ("Always Food for jollibee?").
 * Says nothing when the note has nothing to match on, or a rule already gives that category.
 */
export function offerRule({
  description,
  type,
  categoryId,
  categoryName,
  rules,
}: {
  description?: string | null
  type?: string | null
  categoryId?: string | null
  categoryName?: string | null
  rules: Rule[]
}) {
  if (!categoryId || type === 'transfer') return
  const value = suggestRuleValue(description)
  if (!value || ruleAlreadyCovers(rules, { description, type }, categoryId)) return
  const matchType = type === 'income' ? 'income' : type === 'expense' ? 'expense' : null
  actionToast(
    <>
      Always use <b>{categoryName ?? 'this category'}</b> for “{value}”?
    </>,
    'Create rule',
    () => useRuleSheet.getState().open({ matchField: 'description', matchOp: 'contains', matchValue: value, matchType, setCategoryId: categoryId }),
    { duration: 7000, id: `offer-rule-${value}` }
  )
}
