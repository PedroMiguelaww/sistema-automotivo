// Lê a mensagem do 0800 e separa em campos ("Campo: valor").
// A Observação pode ter várias linhas: tudo que vem depois dela (até uma linha
// de traços ou até outro campo conhecido) entra como parte da Observação.
//
// As chaves são sempre normalizadas (sem acento, minúsculas) — ver lib/campos0800.ts.

import { CAMPOS_0800 } from '@/lib/campos0800'
import { normalizarTexto } from '@/lib/texto'

const LINHA_DE_CAMPO = /^\s*([A-Za-zÀ-ú0-9\/ ]+):\s*(.*)$/
const LINHA_DE_TRACOS = /^\s*[-–—_=*]{3,}\s*$/

const CAMPOS_CONHECIDOS: readonly string[] = CAMPOS_0800

export function lerMensagem0800(texto: string): Record<string, string> {
  const campos: Record<string, string> = {}
  let emObservacao = false
  const observacao: string[] = []

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trimEnd()

    if (LINHA_DE_TRACOS.test(linha)) {
      emObservacao = false
      continue
    }

    const match = linha.match(LINHA_DE_CAMPO)
    const rotulo = match ? normalizarTexto(match[1]) : ''
    const valor = match ? match[2].trim() : ''

    if (match && rotulo === 'observacao') {
      emObservacao = true
      observacao.length = 0
      if (valor) observacao.push(valor)
      continue
    }

    if (emObservacao) {
      // outro campo conhecido encerra a observação
      if (match && CAMPOS_CONHECIDOS.includes(rotulo) && valor) {
        emObservacao = false
      } else {
        observacao.push(linha.trim())
        continue
      }
    }

    if (match && valor) {
      campos[rotulo] = valor
    }
  }

  const textoObservacao = observacao.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  if (textoObservacao) campos['observacao'] = textoObservacao

  return campos
}
