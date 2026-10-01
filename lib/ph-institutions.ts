/**
 * Catalog of banks and e-wallets in the Philippines.
 *
 * Logos are not bundled (they are trademarked). To show a real logo, drop a
 * file named `<id>.svg` (or `.png`, see `logoExt`) into `public/banks/`; until
 * then <InstitutionLogo> renders a brand-colored monogram.
 */
export type InstitutionKind = 'bank' | 'digital_bank' | 'ewallet' | 'government'

export interface Institution {
  id: string
  name: string
  /** Short label used in tight spaces and for the monogram. */
  short: string
  kind: InstitutionKind
  /** Primary brand color, also used as the default wallet color. */
  color: string
  /** Set to 'png' when the dropped-in logo is a PNG. Defaults to svg. */
  logoExt?: 'svg' | 'png'
}

export const INSTITUTION_KIND_LABEL: Record<InstitutionKind, string> = {
  bank: 'Banks',
  digital_bank: 'Digital banks',
  ewallet: 'E-wallets',
  government: 'Government funds',
}

export const PH_INSTITUTIONS: Institution[] = [
  // Universal & commercial banks
  { id: 'bdo', name: 'BDO Unibank', short: 'BDO', kind: 'bank', color: '#003A8F' },
  { id: 'bpi', name: 'Bank of the Philippine Islands', short: 'BPI', kind: 'bank', color: '#B11116' },
  { id: 'metrobank', name: 'Metrobank', short: 'Metrobank', kind: 'bank', color: '#0B3C8C' },
  { id: 'landbank', name: 'Land Bank of the Philippines', short: 'Landbank', kind: 'bank', color: '#00693E' },
  { id: 'pnb', name: 'Philippine National Bank', short: 'PNB', kind: 'bank', color: '#0055A5' },
  { id: 'securitybank', name: 'Security Bank', short: 'Security Bank', kind: 'bank', color: '#00A651' },
  { id: 'unionbank', name: 'UnionBank of the Philippines', short: 'UnionBank', kind: 'bank', color: '#F26B21' },
  { id: 'rcbc', name: 'Rizal Commercial Banking Corp.', short: 'RCBC', kind: 'bank', color: '#0072BC' },
  { id: 'chinabank', name: 'China Banking Corporation', short: 'Chinabank', kind: 'bank', color: '#00843D' },
  { id: 'eastwest', name: 'EastWest Bank', short: 'EastWest', kind: 'bank', color: '#6A2C91' },
  { id: 'dbp', name: 'Development Bank of the Philippines', short: 'DBP', kind: 'bank', color: '#00529B' },
  { id: 'pbcom', name: 'Philippine Bank of Communications', short: 'PBCom', kind: 'bank', color: '#E31837' },
  { id: 'aub', name: 'Asia United Bank', short: 'AUB', kind: 'bank', color: '#C8102E' },
  { id: 'boc', name: 'Bank of Commerce', short: 'BankCom', kind: 'bank', color: '#0A5C36' },
  { id: 'psbank', name: 'Philippine Savings Bank', short: 'PSBank', kind: 'bank', color: '#0072CE' },
  { id: 'robinsonsbank', name: 'Robinsons Bank', short: 'Robinsons', kind: 'bank', color: '#E4002B' },
  { id: 'maybank', name: 'Maybank Philippines', short: 'Maybank', kind: 'bank', color: '#FFC72C' },
  { id: 'hsbc', name: 'HSBC Philippines', short: 'HSBC', kind: 'bank', color: '#DB0011' },
  { id: 'scb', name: 'Standard Chartered Bank', short: 'Standard Chartered', kind: 'bank', color: '#0473EA' },
  { id: 'citibank', name: 'Citibank Philippines', short: 'Citi', kind: 'bank', color: '#056DAE' },
  { id: 'sterling', name: 'Sterling Bank of Asia', short: 'Sterling', kind: 'bank', color: '#1B5E9B' },
  { id: 'banko', name: 'BanKo (BPI Direct BanKo)', short: 'BanKo', kind: 'bank', color: '#E2231A' },
  { id: 'ofbank', name: 'Overseas Filipino Bank', short: 'OF Bank', kind: 'bank', color: '#1C3F94' },

  // Digital banks
  { id: 'gotyme', name: 'GoTyme Bank', short: 'GoTyme', kind: 'digital_bank', color: '#00C2B2' },
  { id: 'maya-bank', name: 'Maya Bank', short: 'Maya Bank', kind: 'digital_bank', color: '#00B287' },
  { id: 'seabank', name: 'SeaBank Philippines', short: 'SeaBank', kind: 'digital_bank', color: '#EE4D2D' },
  { id: 'tonik', name: 'Tonik Digital Bank', short: 'Tonik', kind: 'digital_bank', color: '#5B2EFF' },
  { id: 'unobank', name: 'UNO Digital Bank', short: 'UNO', kind: 'digital_bank', color: '#FF5A1F' },
  { id: 'cimb', name: 'CIMB Bank Philippines', short: 'CIMB', kind: 'digital_bank', color: '#EC1C24' },
  { id: 'ing', name: 'ING Bank Philippines', short: 'ING', kind: 'digital_bank', color: '#FF6200' },
  { id: 'unionbank-online', name: 'UnionDigital Bank', short: 'UnionDigital', kind: 'digital_bank', color: '#F58220' },

  // Government funds
  { id: 'pagibig', name: 'Pag-IBIG Fund', short: 'Pag-IBIG', kind: 'government', color: '#E31837' },

  // E-wallets
  { id: 'gcash', name: 'GCash', short: 'GCash', kind: 'ewallet', color: '#007DFE' },
  { id: 'maya', name: 'Maya', short: 'Maya', kind: 'ewallet', color: '#00B287' },
  { id: 'grabpay', name: 'GrabPay', short: 'GrabPay', kind: 'ewallet', color: '#00B14F' },
  { id: 'shopeepay', name: 'ShopeePay', short: 'ShopeePay', kind: 'ewallet', color: '#EE4D2D' },
  { id: 'coinsph', name: 'Coins.ph', short: 'Coins.ph', kind: 'ewallet', color: '#1E6FFF' },
  { id: 'paypal', name: 'PayPal', short: 'PayPal', kind: 'ewallet', color: '#003087' },
  { id: 'palawanpay', name: 'Palawan Pay', short: 'Palawan Pay', kind: 'ewallet', color: '#D71920' },
  { id: 'wise', name: 'Wise', short: 'Wise', kind: 'ewallet', color: '#37517E' },
]

const BY_ID = new Map(PH_INSTITUTIONS.map((institution) => [institution.id, institution]))

export const getInstitution = (id?: string | null): Institution | undefined => (id ? BY_ID.get(id) : undefined)

export const institutionLogoSrc = (institution: Institution) => `/banks/${institution.id}.${institution.logoExt ?? 'svg'}`

export const searchInstitutions = (query: string, kinds?: InstitutionKind[]): Institution[] => {
  const needle = query.trim().toLowerCase()
  return PH_INSTITUTIONS.filter((institution) => {
    if (kinds && !kinds.includes(institution.kind)) return false
    if (!needle) return true
    return institution.name.toLowerCase().includes(needle) || institution.short.toLowerCase().includes(needle)
  })
}
