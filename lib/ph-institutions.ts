/**
 * Catalog of banks and e-wallets in the Philippines, plus the investment
 * platforms people commonly use.
 *
 * Logos come from three places, in order (see <InstitutionLogo>):
 * 1. A bundled file in `public/banks/<id>.<logo>`, when `logo` is set. These
 *    come from the CC0 simple-icons set and the MIT @web3icons/core set.
 * 2. The institution's own site icon, looked up from `domain` at runtime.
 * 3. A brand-colored monogram, when offline or nothing else loads.
 */
export type InstitutionKind = 'bank' | 'digital_bank' | 'ewallet' | 'government' | 'platform'

export interface Institution {
  id: string
  name: string
  /** Short label used in tight spaces and for the monogram. */
  short: string
  kind: InstitutionKind
  /** Primary brand color, also used as the default wallet color. */
  color: string
  /** Website, used to look up the site icon when no logo is bundled. */
  domain?: string
  /** Set when a logo file is bundled in public/banks/. */
  logo?: 'svg' | 'png'
  /** Other names people type for it, matched as whole words. */
  aliases?: string[]
}

export const INSTITUTION_KIND_LABEL: Record<InstitutionKind, string> = {
  bank: 'Banks',
  digital_bank: 'Digital banks',
  ewallet: 'E-wallets',
  government: 'Government funds',
  platform: 'Investment platforms',
}

export const PH_INSTITUTIONS: Institution[] = [
  // Universal & commercial banks
  { id: 'bdo', name: 'BDO Unibank', short: 'BDO', kind: 'bank', color: '#003A8F' , domain: 'bdo.com.ph' },
  { id: 'bpi', name: 'Bank of the Philippine Islands', short: 'BPI', kind: 'bank', color: '#B11116' , domain: 'bpi.com.ph' },
  { id: 'metrobank', name: 'Metrobank', short: 'Metrobank', kind: 'bank', color: '#0B3C8C' , domain: 'metrobank.com.ph' },
  { id: 'landbank', name: 'Land Bank of the Philippines', short: 'Landbank', kind: 'bank', color: '#00693E' , domain: 'landbank.com' },
  { id: 'pnb', name: 'Philippine National Bank', short: 'PNB', kind: 'bank', color: '#0055A5' , domain: 'pnb.com.ph' },
  { id: 'securitybank', name: 'Security Bank', short: 'Security Bank', kind: 'bank', color: '#00A651' , domain: 'securitybank.com' },
  { id: 'unionbank', name: 'UnionBank of the Philippines', short: 'UnionBank', kind: 'bank', color: '#F26B21' , domain: 'unionbankph.com' },
  { id: 'rcbc', name: 'Rizal Commercial Banking Corp.', short: 'RCBC', kind: 'bank', color: '#0072BC' , domain: 'rcbc.com' },
  { id: 'chinabank', name: 'China Banking Corporation', short: 'Chinabank', kind: 'bank', color: '#00843D' , domain: 'chinabank.ph' },
  { id: 'eastwest', name: 'EastWest Bank', short: 'EastWest', kind: 'bank', color: '#6A2C91' , domain: 'eastwestbanker.com' },
  { id: 'dbp', name: 'Development Bank of the Philippines', short: 'DBP', kind: 'bank', color: '#00529B' , domain: 'dbp.ph' },
  { id: 'pbcom', name: 'Philippine Bank of Communications', short: 'PBCom', kind: 'bank', color: '#E31837' , domain: 'pbcom.com.ph' },
  { id: 'aub', name: 'Asia United Bank', short: 'AUB', kind: 'bank', color: '#C8102E' , domain: 'aub.com.ph' },
  { id: 'boc', name: 'Bank of Commerce', short: 'BankCom', kind: 'bank', color: '#0A5C36' , domain: 'bankcom.com.ph' },
  { id: 'psbank', name: 'Philippine Savings Bank', short: 'PSBank', kind: 'bank', color: '#0072CE' , domain: 'psbank.com.ph' },
  { id: 'robinsonsbank', name: 'Robinsons Bank', short: 'Robinsons', kind: 'bank', color: '#E4002B' , domain: 'robinsonsbank.com.ph' },
  { id: 'maybank', name: 'Maybank Philippines', short: 'Maybank', kind: 'bank', color: '#FFC72C' , domain: 'maybank.com.ph' },
  { id: 'hsbc', name: 'HSBC Philippines', short: 'HSBC', kind: 'bank', color: '#DB0011' , domain: 'hsbc.com.ph', logo: 'svg' },
  { id: 'scb', name: 'Standard Chartered Bank', short: 'Standard Chartered', kind: 'bank', color: '#0473EA' , domain: 'sc.com' },
  { id: 'citibank', name: 'Citibank Philippines', short: 'Citi', kind: 'bank', color: '#056DAE' , domain: 'citibank.com.ph' },
  { id: 'sterling', name: 'Sterling Bank of Asia', short: 'Sterling', kind: 'bank', color: '#1B5E9B' , domain: 'sterlingbankasia.com' },
  { id: 'banko', name: 'BanKo (BPI Direct BanKo)', short: 'BanKo', kind: 'bank', color: '#E2231A' , domain: 'bankoph.com' },
  { id: 'ofbank', name: 'Overseas Filipino Bank', short: 'OF Bank', kind: 'bank', color: '#1C3F94' , domain: 'ofbank.com.ph' },

  // Digital banks
  { id: 'gotyme', name: 'GoTyme Bank', short: 'GoTyme', kind: 'digital_bank', color: '#00C2B2' , domain: 'gotyme.com.ph' },
  { id: 'maya-bank', name: 'Maya Bank', short: 'Maya Bank', kind: 'digital_bank', color: '#00B287' , domain: 'maya.ph' },
  { id: 'seabank', name: 'SeaBank Philippines', short: 'SeaBank', kind: 'digital_bank', color: '#EE4D2D' , domain: 'seabank.ph' },
  { id: 'tonik', name: 'Tonik Digital Bank', short: 'Tonik', kind: 'digital_bank', color: '#5B2EFF' , domain: 'tonikbank.com' },
  { id: 'unobank', name: 'UNO Digital Bank', short: 'UNO', kind: 'digital_bank', color: '#FF5A1F' , domain: 'uno.bank' },
  { id: 'cimb', name: 'CIMB Bank Philippines', short: 'CIMB', kind: 'digital_bank', color: '#EC1C24' , domain: 'cimbbank.com.ph' },
  { id: 'ing', name: 'ING Bank Philippines', short: 'ING', kind: 'digital_bank', color: '#FF6200' , domain: 'ing.com.ph' },
  { id: 'unionbank-online', name: 'UnionDigital Bank', short: 'UnionDigital', kind: 'digital_bank', color: '#F58220' , domain: 'uniondigitalbank.io' },

  // Government funds
  { id: 'pagibig', name: 'Pag-IBIG Fund', short: 'Pag-IBIG', kind: 'government', color: '#E31837' , domain: 'pagibigfund.gov.ph' },

  // E-wallets
  { id: 'gcash', name: 'GCash', short: 'GCash', kind: 'ewallet', color: '#007DFE' , domain: 'gcash.com' },
  { id: 'maya', name: 'Maya', short: 'Maya', kind: 'ewallet', color: '#00B287' , domain: 'maya.ph' },
  { id: 'grabpay', name: 'GrabPay', short: 'GrabPay', kind: 'ewallet', color: '#00B14F' , domain: 'grab.com', logo: 'svg' },
  { id: 'shopeepay', name: 'ShopeePay', short: 'ShopeePay', kind: 'ewallet', color: '#EE4D2D' , domain: 'shopee.ph', logo: 'svg' },
  { id: 'coinsph', name: 'Coins.ph', short: 'Coins.ph', kind: 'ewallet', color: '#1E6FFF' , domain: 'coins.ph' },
  { id: 'paypal', name: 'PayPal', short: 'PayPal', kind: 'ewallet', color: '#003087' , domain: 'paypal.com', logo: 'svg' },
  { id: 'palawanpay', name: 'Palawan Pay', short: 'Palawan Pay', kind: 'ewallet', color: '#D71920' , domain: 'palawanpay.com' },
  { id: 'wise', name: 'Wise', short: 'Wise', kind: 'ewallet', color: '#37517E' , domain: 'wise.com', logo: 'svg' },
]

/** Brokers, exchanges and funds, for matching an investment's platform. Not offered when creating a wallet. */
export const INVESTMENT_PLATFORMS: Institution[] = [
  { id: 'colfinancial', name: 'COL Financial', short: 'COL', kind: 'platform', color: '#0B4EA2', domain: 'colfinancial.com' },
  { id: 'firstmetrosec', name: 'First Metro Securities', short: 'FirstMetroSec', kind: 'platform', color: '#0B3C8C', domain: 'firstmetrosec.com.ph', aliases: ['First Metro'] },
  { id: 'btr', name: 'Bureau of the Treasury', short: 'BTr', kind: 'platform', color: '#1C3F94', domain: 'treasury.gov.ph', aliases: ['Treasury', 'RTB', 'Retail Treasury Bonds'] },
  { id: 'binance', name: 'Binance', short: 'Binance', kind: 'platform', color: '#F0B90B', domain: 'binance.com', logo: 'svg' },
  { id: 'coinbase', name: 'Coinbase', short: 'Coinbase', kind: 'platform', color: '#0052FF', domain: 'coinbase.com', logo: 'svg' },
  { id: 'okx', name: 'OKX', short: 'OKX', kind: 'platform', color: '#000000', domain: 'okx.com', logo: 'svg' },
  { id: 'bybit', name: 'Bybit', short: 'Bybit', kind: 'platform', color: '#F7A600', domain: 'bybit.com', logo: 'svg' },
  { id: 'kucoin', name: 'KuCoin', short: 'KuCoin', kind: 'platform', color: '#23AF91', domain: 'kucoin.com', logo: 'svg' },
  { id: 'crypto-com', name: 'Crypto.com', short: 'Crypto.com', kind: 'platform', color: '#002D74', domain: 'crypto.com', logo: 'svg' },
  { id: 'gemini', name: 'Gemini', short: 'Gemini', kind: 'platform', color: '#00DCFA', domain: 'gemini.com', logo: 'svg' },
  { id: 'kraken', name: 'Kraken', short: 'Kraken', kind: 'platform', color: '#5741D9', domain: 'kraken.com', logo: 'svg' },
  { id: 'robinhood', name: 'Robinhood', short: 'Robinhood', kind: 'platform', color: '#CCFF00', domain: 'robinhood.com', logo: 'svg' },
  { id: 'revolut', name: 'Revolut', short: 'Revolut', kind: 'platform', color: '#191C1F', domain: 'revolut.com', logo: 'svg' },
  { id: 'gotrade', name: 'Gotrade', short: 'Gotrade', kind: 'platform', color: '#00C2A8', domain: 'heygotrade.com' },
  { id: 'etoro', name: 'eToro', short: 'eToro', kind: 'platform', color: '#13C636', domain: 'etoro.com' },
  { id: 'ibkr', name: 'Interactive Brokers', short: 'IBKR', kind: 'platform', color: '#D71920', domain: 'interactivebrokers.com' },
]

const BY_ID = new Map([...PH_INSTITUTIONS, ...INVESTMENT_PLATFORMS].map((institution) => [institution.id, institution]))

export const getInstitution = (id?: string | null): Institution | undefined => (id ? BY_ID.get(id) : undefined)

export const institutionLogoSrc = (institution: Institution) => (institution.logo ? `/banks/${institution.id}.${institution.logo}` : undefined)

/** The site's own icon, from Google's favicon service. Small or missing icons are rejected by <InstitutionLogo>. */
export const institutionIconSrc = (institution: Institution) =>
  institution.domain ? `https://www.google.com/s2/favicons?domain=${institution.domain}&sz=128` : undefined

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `

// Longest names first, so "Maya Bank" wins over "Maya" and "BPI Trade" still finds BPI.
const MATCHERS = [...INVESTMENT_PLATFORMS, ...PH_INSTITUTIONS]
  .flatMap((institution) => [institution.name, institution.short, ...(institution.aliases ?? [])].map((label) => ({ label: words(label), institution })))
  .sort((a, b) => b.label.length - a.label.length)

/** Best guess at the institution a free-text name refers to, e.g. a wallet called "My GCash" or a platform "BPI Trade". */
export const matchInstitution = (text?: string | null): Institution | undefined => {
  if (!text?.trim()) return undefined
  const haystack = words(text)
  return MATCHERS.find((m) => haystack.includes(m.label))?.institution
}

export const searchInstitutions = (query: string, kinds?: InstitutionKind[]): Institution[] => {
  const needle = query.trim().toLowerCase()
  return PH_INSTITUTIONS.filter((institution) => {
    if (kinds && !kinds.includes(institution.kind)) return false
    if (!needle) return true
    return institution.name.toLowerCase().includes(needle) || institution.short.toLowerCase().includes(needle)
  })
}
