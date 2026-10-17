// Copies the Tesseract worker, wasm cores and English language data into public/tesseract
// so receipt scanning works offline instead of fetching them from a CDN at runtime.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const out = join('public', 'tesseract')
mkdirSync(out, { recursive: true })

const copy = (from, name) => {
  if (!existsSync(from)) throw new Error(`Missing OCR asset: ${from}`)
  copyFileSync(from, join(out, name))
}

copy(join('node_modules', 'tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js')
const coreDir = join('node_modules', 'tesseract.js-core')
for (const file of readdirSync(coreDir)) {
  // The bundled language data is LSTM-only, so the non-LSTM cores are never loaded.
  if (/^tesseract-core.*lstm\.wasm\.js$/.test(file)) copy(join(coreDir, file), file)
}
copy(join('node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz')
