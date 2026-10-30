import { createWorker } from 'tesseract.js'

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>

// O worker carrega wasm + dicionário de português (vários MB). Criar um novo a
// cada foto trava a tela por segundos; aqui ele é criado uma vez e reutilizado.
let workerAtual: Promise<TesseractWorker> | null = null

function obterWorker() {
  if (!workerAtual) {
    workerAtual = createWorker('por').catch((erro) => {
      // se falhar (ex: sem rede na primeira carga), permite tentar de novo
      workerAtual = null
      throw erro
    })
  }
  return workerAtual
}

export async function lerTextoDaImagem(imagemBase64: string): Promise<string> {
  const worker = await obterWorker()
  const { data } = await worker.recognize(imagemBase64)
  return data.text
}
