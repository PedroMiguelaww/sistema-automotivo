// Copia os arquivos do OCR de node_modules para public/ocr, para o sistema servir
// tudo por conta própria. Roda sozinho antes de "npm run dev" e "npm run build".
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const origem = (...partes) => join(raiz, 'node_modules', ...partes)
const destino = (...partes) => join(raiz, 'public', 'ocr', ...partes)

const arquivos = [
  [origem('tesseract.js', 'dist', 'worker.min.js'), destino('worker.min.js')],
  [origem('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), destino('core', 'tesseract-core-lstm.wasm.js')],
  [origem('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), destino('core', 'tesseract-core-simd-lstm.wasm.js')],
  [origem('tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), destino('core', 'tesseract-core-relaxedsimd-lstm.wasm.js')],
  [origem('@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz'), destino('lang', 'por.traineddata.gz')],
]

for (const [de, para] of arquivos) {
  mkdirSync(dirname(para), { recursive: true })
  copyFileSync(de, para)
}
