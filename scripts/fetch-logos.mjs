// Copies the bundled logos in public/banks/ and public/coins/ out of open-licence icon packages:
// @web3icons/core (MIT) for coins and exchanges, simple-icons (CC0) for global brands.
// Philippine banks and e-wallets are not in either set; <InstitutionLogo> loads their site icon instead.
// Run with `node scripts/fetch-logos.mjs` after adding a coin or platform below.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const out = path.resolve(import.meta.dirname, '../public')
const pkgs = fs.mkdtempSync(path.join(os.tmpdir(), 'fico-logos-'))
for (const [dir, tarball] of [
  ['core-4.0.58', '@web3icons/core/-/core-4.0.58.tgz'],
  ['simple-icons-16.35.0', 'simple-icons/-/simple-icons-16.35.0.tgz'],
]) {
  fs.mkdirSync(`${pkgs}/${dir}`)
  const file = `${pkgs}/${dir}.tgz`
  fs.writeFileSync(file, Buffer.from(await (await fetch(`https://registry.npmjs.org/${tarball}`)).arrayBuffer()))
  execFileSync('tar', ['xzf', file, '-C', `${pkgs}/${dir}`])
}

const W = `${pkgs}/core-4.0.58/package/dist/svgs`
const SI = `${pkgs}/simple-icons-16.35.0/package`
// These draw white glyphs meant for dark backgrounds; recolor them so they show on a white tile.
const INK = { ALGO: '#000000', HBAR: '#000000', XRP: '#23292F', bybit: '#15192A' }
const web3 = async (dir, name) => {
  let svg = (await import(`${W}/${dir}/branded/${name}.svg.js`)).default
  if (INK[name]) svg = svg.replaceAll('fill="#fff"', `fill="${INK[name]}"`)
  return svg.replace(/ class="web3icons"/, '').replace(/\n\s*/g, '')
}
const siData = JSON.parse(fs.readFileSync(`${SI}/data/simple-icons.json`, 'utf8'))
const siList = Array.isArray(siData) ? siData : siData.icons
const simple = (slug) => {
  const svg = fs.readFileSync(`${SI}/icons/${slug}.svg`, 'utf8')
  const entry = siList.find((i) => (i.slug ?? i.title.toLowerCase().replace(/[^a-z0-9]/g, '')) === slug)
  return svg.replace(/<title>.*?<\/title>/, '').replace('<svg ', `<svg fill="#${entry.hex}" `)
}
const write = (rel, svg) => { const p = path.join(out, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, svg.trim() + '\n') }
// Coins, by ticker
for (const s of 'BTC ETH BNB USDT USDC SOL XRP DOGE ADA TRX AVAX SHIB DOT LINK POL LTC BCH UNI XLM NEAR CAKE DAI APT OP SUI PEPE ICP ATOM XMR FIL HBAR AAVE MKR ETC ALGO VET'.split(' ')) write(`coins/${s.toLowerCase()}.svg`, await web3('tokens', s))
write('coins/ton.svg', await web3('networks', 'ton'))
write('coins/inj.svg', await web3('networks', 'injective'))
// Banks and wallets in the catalog
for (const [id, slug] of [['paypal', 'paypal'], ['wise', 'wise'], ['grabpay', 'grab'], ['shopeepay', 'shopee'], ['hsbc', 'hsbc']]) write(`banks/${id}.svg`, simple(slug))
// Investment platforms
for (const id of ['binance', 'coinbase', 'okx', 'bybit', 'kucoin', 'crypto-com', 'gemini', 'kraken']) write(`banks/${id}.svg`, await web3('exchanges', id))
for (const id of ['robinhood', 'revolut']) write(`banks/${id}.svg`, simple(id))
fs.rmSync(pkgs, { recursive: true, force: true })
