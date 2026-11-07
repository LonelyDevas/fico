// Run: npx tsx scripts/test-import-csv.mts
import { parseImportCsv } from '../utils/import-csv'

let failures = 0
const check = (label: string, ok: boolean, extra?: unknown) => {
  if (!ok) failures++
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : JSON.stringify(extra))
}

const debitCredit = parseImportCsv('Date,Description,Debit,Credit\n2024-01-05,Coffee,150.00,0.00\n2024-01-06,Salary,0.00,"5,000.00"', [])
check('0.00 in the unused column does not hide the real amount', debitCredit.valid.length === 2 && debitCredit.valid[1].type === 'income' && debitCredit.valid[1].amount === 5000, debitCredit)

const withTime = parseImportCsv('Date,Time,Description,Amount,Indicator\n25/01/2024,10:30,Rent,1200,DBIT\n05/01/2024,9:05,Shop,10,DBIT', [])
check('DD/MM/YYYY with a time column', withTime.valid.length === 2 && withTime.valid[0].date.startsWith('2024-01-25') && withTime.valid[1].date.startsWith('2024-01-05'), withTime)

const amounts = parseImportCsv('Date,Description,Amount,Indicator\n2024-01-01,a,"1,234",DBIT\n2024-01-01,b,"12,50",DBIT\n2024-01-01,c,"1.234,56",DBIT\n2024-01-01,d,"12,500",DBIT', [])
check('thousands vs decimal commas', amounts.valid.map((r) => r.amount).join() === '1234,12.5,1234.56,12500', amounts.valid.map((r) => r.amount))

// Categorization rules fill rows the file leaves without a category; the file's own Category wins.
const rule = { id: 'r1', position: 1, matchField: 'description' as const, matchOp: 'contains' as const, matchValue: 'jollibee', matchType: null, setCategoryId: 'food', setTags: ['eat'], setWalletId: null, enabled: true }
const ruled = parseImportCsv(
  'Date,Description,Amount,Indicator,Category\n2024-01-01,JOLLIBEE QC,200,DBIT,\n2024-01-02,Jollibee,100,DBIT,Gifts\n2024-01-03,Other,50,DBIT,',
  [{ id: 'gifts', name: 'Gifts' }],
  'misc',
  [rule]
)
check(
  'rules categorize imported rows, the file wins, the default fills the rest',
  ruled.valid.map((r) => r.category_id).join() === 'food,gifts,misc' && ruled.valid[0].tags.includes('eat'),
  ruled.valid.map((r) => [r.category_id, r.tags])
)

console.log(failures ? failures + ' FAILURES' : 'ALL PASSED')
process.exit(failures ? 1 : 0)
