// Run: npx tsx scripts/test-transaction-parser.mts
// Realistic chat prompts for the Fico assistant, in English, Tagalog and Taglish.
import { parseTransactionText, parseReceiptText, matchCategory, matchWallet, type ParseContext, type ParsedTransaction } from '../utils/transaction-parser'
import { detectIntent } from '../utils/agent-intent'
import { answerQuestion } from '../utils/agent-answers'
import { frequentTransactionSuggestions } from '../utils/frequent-transactions'

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++
  else {
    failures++
    console.log('FAIL', label, JSON.stringify(extra))
  }
}

// Wednesday, Oct 21 2026, mid-day.
const now = new Date(2026, 9, 21, 12, 0)
const wallets = [
  { name: 'GCash', type: 'ewallet' },
  { name: 'GoTyme', type: 'bank' },
  { name: 'Cash', type: 'cash' },
  { name: 'GoTyme Emergency', type: 'savings' },
  { name: 'BDO Unibank', type: 'bank' },
  { name: 'BPI Credit Card', type: 'credit_card' },
  { name: 'Maya', type: 'ewallet' },
]
const categories = [
  'Salary:income', 'Freelance:income', 'Business:income', 'Investment:income', 'Remittance:income', 'Gift:income', 'Other Income:income',
  'Food & Dining:expense', 'Groceries:expense', 'Transportation:expense', 'Bills & Utilities:expense', 'Rent:expense', 'Healthcare:expense',
  'Entertainment:expense', 'Shopping:expense', 'Education:expense', 'Insurance:expense', 'Clothing:expense', 'Personal Care:expense',
  'Travel:expense', 'Subscription:expense', 'Donation:expense', 'Other Expense:expense', 'Pets:expense',
].map((s) => ({ name: s.split(':')[0], type: s.split(':')[1] }))
const ctx: ParseContext = { wallets, categories, now }

type Expect = Partial<Pick<ParsedTransaction, 'amount' | 'type' | 'date' | 'description' | 'inferredCategoryName' | 'fromWalletName' | 'toWalletName' | 'serviceFee'>>

const expectParse = (text: string, expected: Expect, context: ParseContext = ctx) => {
  const got = parseTransactionText(text, context)
  const wrong = Object.entries(expected).filter(([k, v]) => (got as any)[k] !== v)
  check(`"${text}"`, wrong.length === 0, { wrong: Object.fromEntries(wrong.map(([k]) => [k, (got as any)[k]])), expected: Object.fromEntries(wrong) })
}

// --- The user's own example -------------------------------------------------
expectParse('80 lunch cash', { amount: 80, type: 'expense', description: 'Lunch', fromWalletName: 'Cash', inferredCategoryName: 'Food & Dining', date: '2026-10-21' })

// --- The chat's suggested prompts --------------------------------------------
expectParse('Spent 150 on lunch', { amount: 150, type: 'expense', description: 'Lunch', inferredCategoryName: 'Food & Dining' })
expectParse('Received 5000 freelance', { amount: 5000, type: 'income', description: 'Freelance', inferredCategoryName: 'Freelance' })
expectParse('Transfer 1000 from BPI to GCash', { amount: 1000, type: 'transfer', fromWalletName: 'BPI Credit Card', toWalletName: 'GCash' })
expectParse('Transfer 1000 from GoTyme to GCash', { amount: 1000, type: 'transfer', fromWalletName: 'GoTyme', toWalletName: 'GCash', description: 'GoTyme to GCash' })
expectParse('Transfer 2500 from GoTyme to GoTyme Emergency', { amount: 2500, type: 'transfer', fromWalletName: 'GoTyme', toWalletName: 'GoTyme Emergency' })
expectParse('Spent 3120 on Grocery via GCash', { amount: 3120, type: 'expense', description: 'Grocery', fromWalletName: 'GCash', inferredCategoryName: 'Groceries' })
expectParse('Received 25000 Salary via BDO Unibank', { amount: 25000, type: 'income', description: 'Salary', fromWalletName: 'BDO Unibank', inferredCategoryName: 'Salary' })
expectParse('Spent 1250.5 on Meralco Bill', { amount: 1250.5, description: 'Meralco Bill', inferredCategoryName: 'Bills & Utilities' })
expectParse('Spent 89 on 7-Eleven', { amount: 89, description: '7-Eleven', inferredCategoryName: 'Food & Dining' })
expectParse('Spent 500 on Transfer fee', { amount: 500, type: 'expense' })

// --- Amount formats ----------------------------------------------------------
expectParse('₱250 coffee', { amount: 250, description: 'Coffee', inferredCategoryName: 'Food & Dining' })
expectParse('P1,250.75 shoes', { amount: 1250.75, inferredCategoryName: 'Clothing' })
expectParse('php 300 haircut', { amount: 300, inferredCategoryName: 'Personal Care' })
expectParse('lunch 150php', { amount: 150, description: 'Lunch' })
expectParse('jollibee 245 pesos', { amount: 245, description: 'Jollibee' })
expectParse('2k groceries', { amount: 2000, inferredCategoryName: 'Groceries' })
expectParse('1.5k gas', { amount: 1500, inferredCategoryName: 'Transportation' })
expectParse('sahod 25k', { amount: 25000, type: 'income', inferredCategoryName: 'Salary' })
expectParse('rent 8,500', { amount: 8500, inferredCategoryName: 'Rent' })
expectParse('bought 2 shirts for 500', { amount: 500, inferredCategoryName: 'Clothing', description: '2 shirts' })
expectParse('3 coffees 450', { amount: 450 })
expectParse('lunch at 12:30 for 180', { amount: 180 })
expectParse('grab 3pm 210', { amount: 210, inferredCategoryName: 'Transportation' })
expectParse('13th month 30000', { amount: 30000, type: 'income', inferredCategoryName: 'Salary' })
expectParse('iphone15 case 450', { amount: 450 })
expectParse('load 09171234567 100', { amount: 100, inferredCategoryName: 'Bills & Utilities' })
expectParse('$20 netflix', { amount: 20, inferredCategoryName: 'Subscription' })
expectParse('5 pesos candy', { amount: 5 })

// --- Wallets anywhere ---------------------------------------------------------
expectParse('coffee 120 gcash', { amount: 120, fromWalletName: 'GCash', description: 'Coffee' })
expectParse('gcash 120 coffee', { amount: 120, fromWalletName: 'GCash', description: 'Coffee' })
expectParse('paid meralco 2300 using bdo', { amount: 2300, fromWalletName: 'BDO Unibank', description: 'Meralco', inferredCategoryName: 'Bills & Utilities' })
expectParse('jeep 13 cash', { amount: 13, fromWalletName: 'Cash', inferredCategoryName: 'Transportation' })
expectParse('bayad sa kuryente 1800 gamit maya', { amount: 1800, fromWalletName: 'Maya', inferredCategoryName: 'Bills & Utilities' })
expectParse('BDO Spent 3120 for groceries', { amount: 3120, fromWalletName: 'BDO Unibank', description: 'Groceries' })
expectParse('lazada 899 bpi cc', { amount: 899, fromWalletName: 'BPI Credit Card', inferredCategoryName: 'Shopping' })
expectParse('gotyme 300 snacks', { fromWalletName: 'GoTyme' })
expectParse('g-cash 50 load', { fromWalletName: 'GCash', amount: 50 })
expectParse('paid in cash 300 for tricycle', { fromWalletName: 'Cash', amount: 300, inferredCategoryName: 'Transportation' })

// --- Transfers --------------------------------------------------------------
expectParse('bdo to gcash 2000', { type: 'transfer', fromWalletName: 'BDO Unibank', toWalletName: 'GCash', amount: 2000 })
expectParse('transfer 2k gotyme to maya', { type: 'transfer', fromWalletName: 'GoTyme', toWalletName: 'Maya', amount: 2000 })
expectParse('moved 5000 to emergency fund from gotyme', { type: 'transfer', toWalletName: 'GoTyme Emergency', fromWalletName: 'GoTyme' })
expectParse('to gcash from bdo 1500', { type: 'transfer', fromWalletName: 'BDO Unibank', toWalletName: 'GCash' })
expectParse('sent 1000 to gcash', { type: 'transfer', toWalletName: 'GCash', amount: 1000 })
expectParse('cash in gcash 500', { type: 'transfer', toWalletName: 'GCash', amount: 500 })
expectParse('cash in 1000 sa maya from bdo', { type: 'transfer', toWalletName: 'Maya', fromWalletName: 'BDO Unibank', amount: 1000 })
expectParse('withdraw 3000 from bdo', { type: 'transfer', fromWalletName: 'BDO Unibank', toWalletName: 'Cash', amount: 3000 })
expectParse('atm bdo 2000', { type: 'transfer', fromWalletName: 'BDO Unibank', toWalletName: 'Cash' })
expectParse('paid bpi credit card 5000 from bdo', { type: 'transfer', fromWalletName: 'BDO Unibank', toWalletName: 'BPI Credit Card', amount: 5000 })
expectParse('ipon 1000 gotyme emergency', { type: 'transfer', toWalletName: 'GoTyme Emergency', amount: 1000 })
expectParse('lipat 500 gcash to maya', { type: 'transfer', fromWalletName: 'GCash', toWalletName: 'Maya' })
expectParse('send 1000 from gcash to bdo with 15 fee', { type: 'transfer', serviceFee: 15, amount: 1000, fromWalletName: 'GCash', toWalletName: 'BDO Unibank' })
expectParse('sent 500 to mom', { type: 'expense', amount: 500 })

// --- Income -----------------------------------------------------------------
expectParse('got paid 15000 by client', { type: 'income', amount: 15000, inferredCategoryName: 'Freelance' })
expectParse('sweldo 18000 bdo', { type: 'income', amount: 18000, fromWalletName: 'BDO Unibank', inferredCategoryName: 'Salary' })
expectParse('natanggap ko 2000 padala ni mama', { type: 'income', amount: 2000, inferredCategoryName: 'Remittance' })
expectParse('refund 499 from shopee', { type: 'income', amount: 499 })
expectParse('sold old phone 6500', { type: 'income', amount: 6500, inferredCategoryName: 'Business' })
expectParse('client payment 8000 gcash', { type: 'income', fromWalletName: 'GCash', inferredCategoryName: 'Freelance' })
expectParse('bonus 5k', { type: 'income', amount: 5000 })
expectParse('freelance 12000', { type: 'income', amount: 12000, inferredCategoryName: 'Freelance' })
expectParse('paid by client 3000 via maya', { type: 'income', amount: 3000, fromWalletName: 'Maya' })
expectParse('dividends 350', { type: 'income', inferredCategoryName: 'Investment' })
expectParse('paid salary to helper 5000', { type: 'expense', amount: 5000 })

// --- Expenses: categories, Taglish ------------------------------------------
expectParse('gastos sa palengke 650', { type: 'expense', amount: 650, inferredCategoryName: 'Groceries' })
expectParse('binili ko gamot 320', { amount: 320, inferredCategoryName: 'Healthcare' })
expectParse('pamasahe 45', { amount: 45, inferredCategoryName: 'Transportation' })
expectParse('grabfood 389', { inferredCategoryName: 'Food & Dining' })
expectParse('grab food 389', { inferredCategoryName: 'Food & Dining' })
expectParse('grab to work 220', { inferredCategoryName: 'Transportation' })
expectParse('angkas 120', { inferredCategoryName: 'Transportation' })
expectParse('milk tea 140', { inferredCategoryName: 'Food & Dining' })
expectParse('samgyup with friends 599', { inferredCategoryName: 'Food & Dining', description: 'Samgyup with friends' })
expectParse('spotify 149', { inferredCategoryName: 'Subscription' })
expectParse('netflix 549 bpi credit card', { inferredCategoryName: 'Subscription', fromWalletName: 'BPI Credit Card' })
expectParse('globe load 100', { inferredCategoryName: 'Bills & Utilities' })
expectParse('pldt 1699', { inferredCategoryName: 'Bills & Utilities' })
expectParse('upa 6000', { inferredCategoryName: 'Rent' })
expectParse('tuition 15000', { inferredCategoryName: 'Education' })
expectParse('sss contribution 1350', { inferredCategoryName: 'Insurance' })
expectParse('cebu pacific 4200', { inferredCategoryName: 'Travel' })
expectParse('tithes 500', { inferredCategoryName: 'Donation' })
expectParse('pet food 800', { inferredCategoryName: 'Pets' })
expectParse('gupit 150', { inferredCategoryName: 'Personal Care' })
expectParse('business lunch 600', { type: 'expense', inferredCategoryName: 'Food & Dining' })
expectParse('bus 70', { inferredCategoryName: 'Transportation' })
expectParse('gift for mom 1500', { type: 'expense', inferredCategoryName: 'Shopping' })
expectParse('interesting book 450', { inferredCategoryName: 'Education' })

// --- Dates ------------------------------------------------------------------
expectParse('lunch 150 yesterday', { date: '2026-10-20', description: 'Lunch' })
expectParse('kahapon 200 merienda', { date: '2026-10-20', amount: 200 })
expectParse('kagabi inuman 800', { date: '2026-10-20', amount: 800 })
expectParse('dinner 450 last friday', { date: '2026-10-16', amount: 450 })
expectParse('noong lunes 300 gas', { date: '2026-10-19', amount: 300 })
expectParse('3 days ago grocery 1200', { date: '2026-10-18', amount: 1200 })
expectParse('Oct 5 rent 8000', { date: '2026-10-05', amount: 8000 })
expectParse('rent 8000 on oct 5', { date: '2026-10-05', amount: 8000, description: 'Rent' })
expectParse('5 oct 2026 rent 8000', { date: '2026-10-05', amount: 8000 })
expectParse('dec 24 gifts 3000', { date: '2025-12-24', amount: 3000 })
expectParse('10/15 coffee 120', { date: '2026-10-15', amount: 120 })
expectParse('2026-10-01 meralco 2100', { date: '2026-10-01', amount: 2100 })
expectParse('may 300 pa akong utang', { date: '2026-10-21', amount: 300 })
expectParse('lunch 150 may 5', { date: '2026-05-05', amount: 150 })
expectParse('today 99 snacks', { date: '2026-10-21', amount: 99 })
expectParse('lunch 150', { date: '2026-10-21' })

// --- More real-world phrasing ------------------------------------------------
expectParse('250 samgyup tapos 100 milktea', { amount: 350, inferredCategoryName: 'Food & Dining' })
expectParse('lunch 150 and coffee 120', { amount: 270, description: 'Lunch and coffee' })
expectParse('bought groceries worth 1,845.50 at puregold', { amount: 1845.5, description: 'Groceries at puregold', inferredCategoryName: 'Groceries' })
expectParse('Salary 35,000 deposited to BDO', { type: 'income', amount: 35000, fromWalletName: 'BDO Unibank' })
expectParse('Paid BPI card 12,000', { type: 'transfer', toWalletName: 'BPI Credit Card', amount: 12000 })
expectParse('Paid 2,300 Meralco bill using GCash yesterday', { amount: 2300, fromWalletName: 'GCash', date: '2026-10-20', description: 'Meralco bill' })
expectParse('kumain sa jollibee 189 gamit gcash', { amount: 189, fromWalletName: 'GCash', inferredCategoryName: 'Food & Dining' })
expectParse('paid rent 9k to landlord via bdo', { amount: 9000, fromWalletName: 'BDO Unibank', inferredCategoryName: 'Rent', type: 'expense' })
expectParse('uber eats 300', { inferredCategoryName: 'Food & Dining' })
expectParse('GCash to GoTyme 3k', { type: 'transfer', fromWalletName: 'GCash', toWalletName: 'GoTyme', amount: 3000 })

expectParse('nag cash in ako 2000 sa gcash', { type: 'transfer', toWalletName: 'GCash', amount: 2000 })
expectParse('top up maya 500 from bdo', { type: 'transfer', toWalletName: 'Maya', fromWalletName: 'BDO Unibank', amount: 500 })
expectParse('electricity bill oct 2,345', { amount: 2345, date: '2026-10-21', inferredCategoryName: 'Bills & Utilities' })
expectParse('12/25 christmas gifts 5000', { type: 'expense', amount: 5000, date: '2025-12-25', inferredCategoryName: 'Shopping' })
expectParse('jeep 13 + trike 20', { amount: 33, inferredCategoryName: 'Transportation' })
expectParse('spent ₱1.2k sa shopee kahapon gamit maya', { amount: 1200, fromWalletName: 'Maya', date: '2026-10-20', description: 'Shopee', inferredCategoryName: 'Shopping' })
expectParse('received 3,000 from tita via gcash', { type: 'income', amount: 3000, fromWalletName: 'GCash' })
expectParse('borrowed 1000 from mom', { type: 'income', amount: 1000 })
expectParse('15 pesos for photocopy', { amount: 15, description: 'Photocopy' })
expectParse('2 pcs siopao 70', { amount: 70 })
expectParse('gcash load 300', { type: 'expense', fromWalletName: 'GCash', inferredCategoryName: 'Bills & Utilities' })

// --- Service fee -------------------------------------------------------------
expectParse('paid 1000 to landlord with a service charge of 15 pesos', { amount: 1000, serviceFee: 15 })
expectParse('instapay 5000 to bdo + 15 fee', { amount: 5000, serviceFee: 15 })
expectParse('exam fee 500', { amount: 500, serviceFee: undefined })

// --- Description stays readable ----------------------------------------------
expectParse('I spent 300 on groceries at SM', { description: 'Groceries at SM', amount: 300 })
expectParse('Jollibee 250 lunch with team', { description: 'Jollibee lunch with team' })
expectParse('coffee and pastry 260', { description: 'Coffee and pastry' })

// --- History: the same note reuses last time's category and wallet -------------
const history = [
  { description: 'Kopiko', type: 'expense', amount: 25, categoryName: 'Food & Dining', walletName: 'Cash' },
  { description: 'Tita Baby', type: 'income', amount: 3000, categoryName: 'Gift', walletName: 'GCash' },
  { description: 'Kopiko', type: 'expense', amount: 25, categoryName: 'Food & Dining', walletName: 'Cash' },
  { description: 'Lunch', type: 'expense', amount: 150, categoryName: 'Food & Dining', walletName: 'GCash' },
]
expectParse('kopiko 30', { inferredCategoryName: 'Food & Dining', fromWalletName: 'Cash', amount: 30 }, { ...ctx, history })
expectParse('tita baby 2000', { type: 'income', inferredCategoryName: 'Gift', fromWalletName: 'GCash' }, { ...ctx, history })
expectParse('lunch 160 cash', { fromWalletName: 'Cash' }, { ...ctx, history })
expectParse('kopiko', { amount: 25, fromWalletName: 'Cash' }, { ...ctx, history })

// --- Without a wallet list (receipts, first load) -----------------------------
expectParse('Transfer 1000 from BPI to GCash', { type: 'transfer', fromWalletName: 'BPI', toWalletName: 'GCash' }, { now })
expectParse('Transfer 500 from Piggy Bank to Wallet', { type: 'transfer', fromWalletName: 'Piggy Bank', toWalletName: 'Wallet' }, { now })
expectParse('coffee 120 via gcash', { fromWalletName: 'GCash', description: 'Coffee' }, { now })

// --- Suggestions round-trip: every suggestion chip parses back to its own values --------
const recent = [
  { type: 'expense', amount: 150, description: 'Lunch', wallet: { name: 'Cash' } },
  { type: 'expense', amount: 3120, description: 'SM SUPERMARKET · POS 1234', wallet: { name: 'BDO Unibank' } },
  { type: 'income', amount: 25000, description: 'Salary', wallet: { name: 'BDO Unibank' } },
  { type: 'transfer', amount: 2000, wallet: { name: 'GoTyme' }, toWallet: { name: 'GoTyme Emergency' } },
  { type: 'expense', amount: 13, description: 'Jeep', wallet: { name: 'Cash' } },
]
for (const suggestion of frequentTransactionSuggestions(recent, 6)) {
  const got = parseTransactionText(suggestion.text, ctx)
  check(`suggestion "${suggestion.text}" keeps its amount and type`, got.amount === suggestion.amount && got.type === suggestion.type, got)
  check(`suggestion "${suggestion.text}" doesn't leave the amount in the note`, !String(got.description ?? '').includes(String(suggestion.amount)), got.description)
  if (suggestion.text.includes(' via ')) check(`suggestion "${suggestion.text}" keeps the wallet`, !!got.fromWalletName, got)
}

// --- Receipts -----------------------------------------------------------------
const receipt = `JOLLIBEE FOODS CORP
VAT REG TIN 000-388-474-00000
SM Megamall Branch
10/18/2026 12:41 PM
1 Chickenjoy 1pc    99.00
1 Jolly Spaghetti   65.00
SUBTOTAL           164.00
VAT 12%             17.57
TOTAL              164.00
CASH               200.00
CHANGE              36.00`
const r = parseReceiptText(receipt, { now })
check('receipt total', r.amount === 164, r)
check('receipt store name', r.description === 'Jollibee Foods Corp', r.description)
check('receipt date', r.date === '2026-10-18', r.date)
check('receipt category', r.inferredCategoryName === 'Food & Dining', r.inferredCategoryName)

// --- Matching names to records ---------------------------------------------------
const cats = categories.map((c, i) => ({ id: String(i), ...c }))
check('matches "Transport" to Transportation', matchCategory('Transport', 'expense', [{ id: 'x', name: 'Transportation', type: 'expense' }])?.id === 'x')
check('never picks a category of the other type', matchCategory('Investment', 'expense', cats) === undefined)
check('Salary maps to Salary for income', matchCategory('Salary', 'income', cats)?.name === 'Salary')
check('matches user category "Food"', matchCategory('Food & Dining', 'expense', [{ id: 'f', name: 'Food', type: 'expense' }])?.id === 'f')
const ws = wallets.map((w, i) => ({ id: String(i), ...w }))
check('matchWallet exact name', matchWallet('GoTyme', ws)?.name === 'GoTyme')
check('matchWallet prefix prefers shortest', matchWallet('goty', ws)?.name === 'GoTyme')

// --- Intent -----------------------------------------------------------------------
const intents: [string, string][] = [
  ['hi', 'greeting'], ['hello fico', 'greeting'], ['good morning', 'greeting'], ['kumusta', 'greeting'],
  ['thanks', 'thanks'], ['salamat po', 'thanks'],
  ['help', 'help'], ['what can you do?', 'help'], ['paano gamitin', 'help'],
  ['how much did I spend this week?', 'question'], ['magkano nagastos ko ngayong buwan', 'question'], ['balance ko sa gcash', 'question'],
  ['how much is left in my wallets', 'question'], ['what is my balance', 'question'], ['spending on food this month?', 'question'],
  ['cancel', 'cancel'], ['wag na', 'cancel'],
  ['80 lunch cash', 'transaction'], ['spent 50 on coffee', 'transaction'], ['coffee', 'transaction'], ['sahod 25k', 'transaction'],
]
for (const [text, intent] of intents) check(`intent "${text}"`, detectIntent(text) === intent, detectIntent(text))

// --- Answers ---------------------------------------------------------------------
const answerData = {
  wallets: [
    { id: '1', name: 'GCash', type: 'ewallet', balance: 1200 },
    { id: '2', name: 'Cash', type: 'cash', balance: 800 },
    { id: '3', name: 'BPI Credit Card', type: 'credit_card', balance: 5000 },
  ],
  transactions: [
    { type: 'expense', amount: 150, date: '2026-10-21', category: { name: 'Food & Dining' } },
    { type: 'expense', amount: 200, date: '2026-10-19', category: { name: 'Transportation' } },
    { type: 'income', amount: 25000, date: '2026-10-15', category: { name: 'Salary' } },
    { type: 'expense', amount: 1000, date: '2026-10-02', category: { name: 'Food & Dining' } },
    { type: 'expense', amount: 999, date: '2026-09-30', category: { name: 'Shopping' } },
  ],
  complete: true,
  categories,
  format: (n: number) => `₱${n.toFixed(2)}`,
  now,
}
const answer = (q: string) => answerQuestion(q, answerData)
check('balance total skips credit cards', answer('balance?').includes('₱2000.00') && answer('balance?').includes('₱5000.00'), answer('balance?'))
check('balance of one wallet', answer('balance ko sa gcash').includes('₱1200.00'), answer('balance ko sa gcash'))
check('spent this week', answer('how much did I spend this week?').includes('₱350.00'), answer('how much did I spend this week?'))
check('spent this month', answer('magkano nagastos ko ngayong buwan').includes('₱1350.00'), answer('magkano nagastos ko ngayong buwan'))
check('spent on food this month', answer('how much did i spend on food this month').includes('₱1150.00'), answer('how much did i spend on food this month'))
check('income this month', answer('income this month?').includes('₱25000.00'), answer('income this month?'))
check('spent today', answer('gastos ko today').includes('₱150.00'), answer('gastos ko today'))

console.log(`${passes} passed`)
console.log(failures ? failures + ' FAILURES' : 'ALL PASSED')
process.exit(failures ? 1 : 0)
