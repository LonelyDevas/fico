/**
 * Catalog of banks and e-wallets in the Philippines, plus the investment
 * platforms people commonly use.
 *
 * Logos are files in public/banks/, so nothing is fetched at runtime (see <InstitutionLogo>):
 * 1. `<id>.svg` when `logo` is set, from the CC0 simple-icons and MIT @web3icons/core sets.
 * 2. `<id>.webp`, downloaded and shrunk at build time by scripts/fetch-bank-logos.mjs, which also
 *    picks the brand color from the logo. Listed in lib/bank-logos.generated.ts.
 * 3. Otherwise a brand-colored monogram.
 */
import { BANK_LOGOS } from '@/lib/bank-logos.generated'

export type InstitutionKind = 'bank' | 'digital_bank' | 'ewallet' | 'government' | 'platform'

export interface Institution {
  id: string
  name: string
  /** Short label used in tight spaces and for the monogram. */
  short: string
  kind: InstitutionKind
  /** Primary brand color, also used as the default wallet color. */
  color: string
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

const CATALOG: Institution[] = [
  // Universal & commercial banks
  { id: 'bdo', name: 'BDO Unibank', short: 'BDO', kind: 'bank', color: '#003A8F'  },
  { id: 'bpi', name: 'Bank of the Philippine Islands', short: 'BPI', kind: 'bank', color: '#B11116'  },
  { id: 'metrobank', name: 'Metrobank', short: 'Metrobank', kind: 'bank', color: '#0B3C8C'  },
  { id: 'landbank', name: 'Land Bank of the Philippines', short: 'Landbank', kind: 'bank', color: '#00693E'  },
  { id: 'pnb', name: 'Philippine National Bank', short: 'PNB', kind: 'bank', color: '#0055A5'  },
  { id: 'securitybank', name: 'Security Bank', short: 'Security Bank', kind: 'bank', color: '#00A651'  },
  { id: 'unionbank', name: 'UnionBank of the Philippines', short: 'UnionBank', kind: 'bank', color: '#F26B21'  },
  { id: 'rcbc', name: 'Rizal Commercial Banking Corp.', short: 'RCBC', kind: 'bank', color: '#0072BC'  },
  { id: 'chinabank', name: 'China Banking Corporation', short: 'Chinabank', kind: 'bank', color: '#00843D'  },
  { id: 'eastwest', name: 'EastWest Bank', short: 'EastWest', kind: 'bank', color: '#6A2C91'  },
  { id: 'dbp', name: 'Development Bank of the Philippines', short: 'DBP', kind: 'bank', color: '#00529B'  },
  { id: 'pbcom', name: 'Philippine Bank of Communications', short: 'PBCom', kind: 'bank', color: '#E31837'  },
  { id: 'aub', name: 'Asia United Bank', short: 'AUB', kind: 'bank', color: '#C8102E'  },
  { id: 'boc', name: 'Bank of Commerce', short: 'BankCom', kind: 'bank', color: '#0A5C36'  },
  { id: 'psbank', name: 'Philippine Savings Bank', short: 'PSBank', kind: 'bank', color: '#0072CE'  },
  { id: 'robinsonsbank', name: 'Robinsons Bank', short: 'Robinsons', kind: 'bank', color: '#E4002B'  },
  { id: 'maybank', name: 'Maybank Philippines', short: 'Maybank', kind: 'bank', color: '#FFC72C'  },
  { id: 'hsbc', name: 'HSBC Philippines', short: 'HSBC', kind: 'bank', color: '#DB0011' , logo: 'svg' },
  { id: 'scb', name: 'Standard Chartered Bank', short: 'Standard Chartered', kind: 'bank', color: '#0473EA'  },
  { id: 'citibank', name: 'Citibank Philippines', short: 'Citi', kind: 'bank', color: '#056DAE'  },
  { id: 'sterling', name: 'Sterling Bank of Asia', short: 'Sterling', kind: 'bank', color: '#1B5E9B'  },
  { id: 'banko', name: 'BanKo (BPI Direct BanKo)', short: 'BanKo', kind: 'bank', color: '#E2231A'  },
  { id: 'ofbank', name: 'Overseas Filipino Bank', short: 'OF Bank', kind: 'bank', color: '#1C3F94'  },

  // Digital banks
  { id: 'gotyme', name: 'GoTyme Bank', short: 'GoTyme', kind: 'digital_bank', color: '#00C2B2'  },
  { id: 'maya-bank', name: 'Maya Bank', short: 'Maya Bank', kind: 'digital_bank', color: '#00B287'  },
  { id: 'seabank', name: 'SeaBank Philippines', short: 'SeaBank', kind: 'digital_bank', color: '#EE4D2D'  },
  { id: 'tonik', name: 'Tonik Digital Bank', short: 'Tonik', kind: 'digital_bank', color: '#5B2EFF'  },
  { id: 'unobank', name: 'UNO Digital Bank', short: 'UNO', kind: 'digital_bank', color: '#FF5A1F'  },
  { id: 'cimb', name: 'CIMB Bank Philippines', short: 'CIMB', kind: 'digital_bank', color: '#EC1C24'  },
  { id: 'ing', name: 'ING Bank Philippines', short: 'ING', kind: 'digital_bank', color: '#FF6200'  },
  { id: 'unionbank-online', name: 'UnionDigital Bank', short: 'UnionDigital', kind: 'digital_bank', color: '#F58220'  },

  // Government funds
  { id: 'pagibig', name: 'Pag-IBIG Fund', short: 'Pag-IBIG', kind: 'government', color: '#E31837'  },

  // E-wallets
  { id: 'gcash', name: 'GCash', short: 'GCash', kind: 'ewallet', color: '#007DFE'  },
  { id: 'maya', name: 'Maya', short: 'Maya', kind: 'ewallet', color: '#00B287'  },
  { id: 'grabpay', name: 'GrabPay', short: 'GrabPay', kind: 'ewallet', color: '#00B14F' , logo: 'svg' },
  { id: 'shopeepay', name: 'ShopeePay', short: 'ShopeePay', kind: 'ewallet', color: '#EE4D2D' , logo: 'svg' },
  { id: 'coinsph', name: 'Coins.ph', short: 'Coins.ph', kind: 'ewallet', color: '#1E6FFF'  },
  { id: 'paypal', name: 'PayPal', short: 'PayPal', kind: 'ewallet', color: '#003087' , logo: 'svg' },
  { id: 'palawanpay', name: 'Palawan Pay', short: 'Palawan Pay', kind: 'ewallet', color: '#D71920'  },
  { id: 'wise', name: 'Wise', short: 'Wise', kind: 'ewallet', color: '#37517E' , logo: 'svg' },
]

/** Uses the color picked from the downloaded logo, so tiles and default wallet colors match it. */
const withLogoColor = (institution: Institution): Institution => ({ ...institution, color: BANK_LOGOS[institution.id]?.color ?? institution.color })

export const PH_INSTITUTIONS = CATALOG.map(withLogoColor)

/** Brokers, exchanges and funds, for matching an investment's platform. Not offered when creating a wallet. */
const PLATFORMS: Institution[] = [
  { id: 'colfinancial', name: 'COL Financial', short: 'COL', kind: 'platform', color: '#0B4EA2' },
  { id: 'firstmetrosec', name: 'First Metro Securities', short: 'FirstMetroSec', kind: 'platform', color: '#0B3C8C', aliases: ['First Metro'] },
  { id: 'btr', name: 'Bureau of the Treasury', short: 'BTr', kind: 'platform', color: '#1C3F94', aliases: ['Treasury', 'RTB', 'Retail Treasury Bonds'] },
  { id: 'binance', name: 'Binance', short: 'Binance', kind: 'platform', color: '#F0B90B', logo: 'svg' },
  { id: 'coinbase', name: 'Coinbase', short: 'Coinbase', kind: 'platform', color: '#0052FF', logo: 'svg' },
  { id: 'okx', name: 'OKX', short: 'OKX', kind: 'platform', color: '#000000', logo: 'svg' },
  { id: 'bybit', name: 'Bybit', short: 'Bybit', kind: 'platform', color: '#F7A600', logo: 'svg' },
  { id: 'kucoin', name: 'KuCoin', short: 'KuCoin', kind: 'platform', color: '#23AF91', logo: 'svg' },
  { id: 'crypto-com', name: 'Crypto.com', short: 'Crypto.com', kind: 'platform', color: '#002D74', logo: 'svg' },
  { id: 'gemini', name: 'Gemini', short: 'Gemini', kind: 'platform', color: '#00DCFA', logo: 'svg' },
  { id: 'kraken', name: 'Kraken', short: 'Kraken', kind: 'platform', color: '#5741D9', logo: 'svg' },
  { id: 'robinhood', name: 'Robinhood', short: 'Robinhood', kind: 'platform', color: '#CCFF00', logo: 'svg' },
  { id: 'revolut', name: 'Revolut', short: 'Revolut', kind: 'platform', color: '#191C1F', logo: 'svg' },
  { id: 'gotrade', name: 'Gotrade', short: 'Gotrade', kind: 'platform', color: '#00C2A8' },
  { id: 'etoro', name: 'eToro', short: 'eToro', kind: 'platform', color: '#13C636' },
  { id: 'ibkr', name: 'Interactive Brokers', short: 'IBKR', kind: 'platform', color: '#D71920' },
]

export const INVESTMENT_PLATFORMS = PLATFORMS.map(withLogoColor)

const BY_ID = new Map([...PH_INSTITUTIONS, ...INVESTMENT_PLATFORMS].map((institution) => [institution.id, institution]))

export const getInstitution = (id?: string | null): Institution | undefined => (id ? BY_ID.get(id) : undefined)

/** The bundled logo and how to fit it in a tile: glyphs are padded, app icons fill the tile. */
export const institutionLogo = (institution: Institution): { src: string; fit: 'cover' | 'contain' } | undefined => {
  if (institution.logo) return { src: `/banks/${institution.id}.${institution.logo}`, fit: 'contain' }
  const downloaded = BANK_LOGOS[institution.id]
  return downloaded ? { src: `/banks/${institution.id}.webp`, fit: downloaded.fit } : undefined
}

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
