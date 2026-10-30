// Campos reconhecidos na mensagem do 0800.
// As chaves são guardadas normalizadas (sem acento, minúsculas), por isso a
// lista abaixo também é: a mensagem pode vir "Beneficiário", "Beneficiario"
// ou "BENEFICIARIO" e cai sempre no mesmo campo.

import { normalizarTexto } from '@/lib/texto'

export const CAMPOS_0800 = [
  'id',
  'protocolo',
  'data/hora',
  'motivo',
  'atendente',
  'cliente',
  'consultor',
  'veiculo',
  'adesao',
  'cor',
  'marca',
  'beneficiario',
  'cidade',
  'telefones',
  'link origem',
  'observacao',
] as const

export type Campo0800 = (typeof CAMPOS_0800)[number]

/**
 * Lê um campo do dados_extra aceitando os dois formatos:
 * - registros novos: chave normalizada (ex: "beneficiario")
 * - registros antigos: chave como veio do 0800 (ex: "Beneficiário")
 */
export function lerCampo(
  dados: Record<string, string> | null | undefined,
  campo: Campo0800
): string | undefined {
  if (!dados) return undefined

  const direto = dados[campo]
  if (direto) return direto

  for (const chave of Object.keys(dados)) {
    if (normalizarTexto(chave) === campo) {
      const valor = dados[chave]
      if (valor) return valor
    }
  }

  return undefined
}
