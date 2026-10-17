'use client'

/**
 * Browser-based OCR using Tesseract.js.
 *
 * The worker, wasm core and English language data are bundled with the app
 * (public/tesseract), so no CDN is needed. The service worker caches them on
 * first use, after which scanning works fully offline.
 */

export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Dynamic import keeps Tesseract out of the main bundle (SSR-safe)
  const { createWorker } = await import('tesseract.js')

  // Worker, wasm core and language data are served from /tesseract (copied by
  // scripts/copy-ocr-assets.mjs) so scanning works without a CDN.
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tesseract',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  try {
    const {
      data: { text },
    } = await worker.recognize(imageFile)
    return text
  } finally {
    await worker.terminate()
  }
}
