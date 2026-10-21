// Downloads a logo for every catalog institution that has no bundled SVG, shrinks it to a small
// WebP in public/banks/, and records it (with the brand color picked from the logo) in
// lib/bank-logos.generated.ts. Runs before every build so the app never fetches logos at runtime.
// Sources, best first: the App Store icon (square, in brand colors), the site's own icon, then the
// Wikipedia infobox logo. Any failure is skipped, never fatal: that institution keeps its monogram.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT_DIR = join('public', 'banks')
const MANIFEST = join('lib', 'bank-logos.generated.ts')
const SIZE = 128
const TIMEOUT_MS = 8000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15'

// Catalog id (lib/ph-institutions.ts), website, App Store search term, pattern the app's name or seller must match, Wikipedia title
const ITEMS = [
  ['bdo', 'bdo.com.ph', 'BDO Online', /\bBDO\b/i, 'BDO Unibank'],
  ['bpi', 'bpi.com.ph', 'BPI', /\bBPI\b|Bank of the Philippine Islands/i, 'Bank of the Philippine Islands'],
  ['metrobank', 'metrobank.com.ph', 'Metrobank', /Metrobank|Metropolitan Bank/i, 'Metrobank (Philippines)'],
  ['landbank', 'landbank.com', 'LANDBANK Mobile Banking', /Land ?bank/i, 'Land Bank of the Philippines'],
  ['pnb', 'pnb.com.ph', 'PNB Digital', /\bPNB\b|Philippine National Bank/i, 'Philippine National Bank'],
  ['securitybank', 'securitybank.com', 'Security Bank Mobile', /Security Bank/i, 'Security Bank'],
  ['unionbank', 'unionbankph.com', 'UnionBank Online', /Union ?Bank/i, 'UnionBank (Philippines)'],
  ['rcbc', 'rcbc.com', 'RCBC Pulz', /RCBC|Rizal Commercial/i, 'Rizal Commercial Banking Corporation'],
  ['chinabank', 'chinabank.ph', 'China Bank Mobile', /China ?bank|China Banking/i, 'Chinabank'],
  ['eastwest', 'eastwestbanker.com', 'EastWest Mobile', /East ?West/i, 'EastWest Bank'],
  ['dbp', 'dbp.ph', 'DBP Mobile', /\bDBP\b|Development Bank of the Philippines/i, 'Development Bank of the Philippines'],
  ['pbcom', 'pbcom.com.ph', 'PBCOM', /PBCOM|Philippine Bank of Communications/i, 'Philippine Bank of Communications'],
  ['aub', 'aub.com.ph', 'AUB Mobile Banking', /\bAUB\b|Asia United Bank/i, 'Asia United Bank'],
  ['boc', 'bankcom.com.ph', 'BankCom Mobile', /Bank ?Com|Bank of Commerce/i, 'Bank of Commerce (Philippines)'],
  ['psbank', 'psbank.com.ph', 'PSBank Mobile', /PSBank|Philippine Savings Bank/i, 'PSBank'],
  ['robinsonsbank', 'robinsonsbank.com.ph', 'Robinsons Bank', /Robinsons Bank/i, 'Robinsons Bank'],
  ['maybank', 'maybank.com.ph', 'Maybank2u PH', /Maybank|Malayan Banking/i, 'Maybank'],
  ['scb', 'sc.com', 'SC Mobile Philippines', /Standard Chartered|\bSC Mobile/i, 'Standard Chartered'],
  ['citibank', 'citibank.com.ph', 'Citi Mobile', /\bCiti/i, 'Citibank'],
  ['sterling', 'sterlingbankasia.com', 'Sterling Bank of Asia', /Sterling Bank/i, 'Sterling Bank of Asia'],
  ['banko', 'bankoph.com', 'BanKo', /BanKo/i, 'BPI Direct BanKo'],
  ['ofbank', 'ofbank.com.ph', 'OFBank', /OF ?Bank|Overseas Filipino Bank/i, 'Overseas Filipino Bank'],
  ['gotyme', 'gotyme.com.ph', 'GoTyme Bank', /GoTyme/i, 'GoTyme Bank'],
  ['maya-bank', 'maya.ph', 'Maya', /\bMaya\b/i, 'Maya (mobile payments)'],
  ['seabank', 'seabank.ph', 'SeaBank PH', /SeaBank/i, 'SeaBank'],
  ['tonik', 'tonikbank.com', 'Tonik', /Tonik/i, 'Tonik Digital Bank'],
  ['unobank', 'uno.bank', 'UNOBank', /\bUNO\b/i, 'UNO Digital Bank'],
  ['cimb', 'cimbbank.com.ph', 'CIMB Bank PH', /CIMB/i, 'CIMB Group'],
  ['ing', 'ing.com.ph', 'ING Philippines', /\bING\b/i, 'ING Group'],
  ['unionbank-online', 'uniondigitalbank.io', 'UnionDigital Bank', /UnionDigital/i, 'UnionDigital Bank'],
  ['pagibig', 'pagibigfund.gov.ph', 'Virtual Pag-IBIG', /Pag-?IBIG|Home Development Mutual Fund/i, 'Home Development Mutual Fund'],
  ['gcash', 'gcash.com', 'GCash', /GCash|G-Xchange/i, 'GCash'],
  ['maya', 'maya.ph', 'Maya', /\bMaya\b/i, 'Maya (mobile payments)'],
  ['coinsph', 'coins.ph', 'Coins.ph', /Coins\.?ph|Betur/i, 'Coins.ph'],
  ['palawanpay', 'palawanpay.com', 'Palawan Pay', /Palawan/i, 'Palawan Express Pera Padala'],
  ['colfinancial', 'colfinancial.com', 'COL Financial', /\bCOL\b/i, 'COL Financial'],
  ['firstmetrosec', 'firstmetrosec.com.ph', 'FirstMetroSec', /First ?Metro/i, 'First Metro Investment Corporation'],
  ['btr', 'treasury.gov.ph', 'Bonds.PH', /Bonds\.?PH|Treasury/i, 'Bureau of the Treasury (Philippines)'],
  ['gotrade', 'heygotrade.com', 'Gotrade', /Gotrade/i, 'Gotrade'],
  ['etoro', 'etoro.com', 'eToro', /eToro/i, 'EToro'],
  ['ibkr', 'interactivebrokers.com', 'IBKR Mobile', /IBKR|Interactive Brokers/i, 'Interactive Brokers'],
]

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res
}

const appStoreIcon = async (term, pattern) => {
  const q = new URLSearchParams({ term, country: 'ph', entity: 'software', limit: '8' })
  const { results = [] } = await (await get(`https://itunes.apple.com/search?${q}`)).json()
  const app = results.find((a) => pattern.test(a.trackName) || pattern.test(a.sellerName))
  if (!app?.artworkUrl512) return null
  return { data: await (await get(app.artworkUrl512)).arrayBuffer(), fit: 'cover' }
}

const siteIcon = async (domain) => {
  const data = await (await get(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`)).arrayBuffer()
  const { width = 0 } = await sharp(Buffer.from(data)).metadata()
  // Google answers unknown sites with a 16px globe, and small favicons blur when scaled up.
  return width >= 96 ? { data, fit: 'cover' } : null
}

const wikipediaLogo = async (title) => {
  const q = new URLSearchParams({ action: 'query', titles: title, prop: 'pageimages', pithumbsize: '400', format: 'json', redirects: '1' })
  const { query } = await (await get(`https://en.wikipedia.org/w/api.php?${q}`)).json()
  const thumb = Object.values(query?.pages ?? {}).find((p) => p.thumbnail)?.thumbnail?.source
  return thumb ? { data: await (await get(thumb)).arrayBuffer(), fit: 'contain' } : null
}

const firstLogo = async ([, domain, term, pattern, wiki]) => {
  for (const source of [() => appStoreIcon(term, pattern), () => siteIcon(domain), () => wikipediaLogo(wiki)]) {
    try {
      const found = await source()
      if (found) return found
    } catch {
      // try the next source
    }
  }
  return null
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** The most common strongly colored pixel group, so a white or black backdrop doesn't win. */
const brandColor = async (image) => {
  const { data, info } = await image.clone().resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const buckets = new Map()
  for (let i = 0; i < info.width * info.height * 4; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (a < 200 || max - min < 60 || max < 40) continue
    const key = `${r >> 5},${g >> 5},${b >> 5}`
    const bucket = buckets.get(key) ?? { n: 0, score: 0, r: 0, g: 0, b: 0 }
    // Vivid pixels count for more, so the brand color beats pale tints and anti-aliased edges.
    buckets.set(key, { n: bucket.n + 1, score: bucket.score + (max - min) / 255, r: bucket.r + r, g: bucket.g + g, b: bucket.b + b })
  }
  const top = [...buckets.values()].sort((a, b) => b.score - a.score)[0]
  return top && top.n >= 8 ? hex(top.r / top.n, top.g / top.n, top.b / top.n) : undefined
}

const save = async ([id], { data, fit }) => {
  const image = sharp(Buffer.from(data))
  // App icons fill their square; Wikipedia logos are trimmed of margins and centered on white.
  const resized =
    fit === 'cover'
      ? image.resize(SIZE, SIZE, { fit: 'cover' })
      : image.trim({ threshold: 10 }).resize(SIZE - 24, SIZE - 24, { fit: 'contain', background: '#FFFFFF' }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#FFFFFF' })
  const flat = sharp(await resized.flatten({ background: '#FFFFFF' }).png().toBuffer())
  await flat.clone().webp({ quality: 85 }).toFile(join(OUT_DIR, `${id}.webp`))
  return { fit, color: await brandColor(flat) }
}

mkdirSync(OUT_DIR, { recursive: true })
const manifest = {}
const queue = [...ITEMS]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const found = await firstLogo(item)
        if (found) manifest[item[0]] = await save(item, found)
      } catch {
        // keep the monogram
      }
    }
  }),
)

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(
  MANIFEST,
  `// Generated by scripts/fetch-bank-logos.mjs on every build. Do not edit.\n` +
    `export const BANK_LOGOS: Record<string, { fit: 'cover' | 'contain'; color?: string }> = ${JSON.stringify(sorted, null, 2)}\n`,
)
console.log(`Bank logos: ${Object.keys(sorted).length} of ${ITEMS.length} downloaded`)
