import { createWorker } from 'tesseract.js'

export async function lerTextoDaImagem(imagemBase64: string): Promise<string> {
  const worker = await createWorker('por')
  const { data } = await worker.recognize(imagemBase64)
  await worker.terminate()
  return data.text
}