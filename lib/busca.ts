// Ajuda para as buscas do sistema (placa, beneficiário, consultor)

import { normalizarTexto } from '@/lib/texto'

export { normalizarTexto }

// Tira caracteres que têm significado especial nos filtros do Supabase
export function limparBusca(texto: string) {
  return texto.replace(/[%_,()"\\*]/g, ' ').replace(/\s+/g, ' ').trim()
}

type ConsultorNome = { id: string; nome: string }

// Monta o filtro "ou": placa OU beneficiário OU consultor (pelo nome)
export function montarFiltroBusca(termo: string, consultores?: ConsultorNome[]) {
  const t = limparBusca(termo)
  if (!t) return undefined

  const partes = [
    `placa.ilike.*${t}*`,
    // chave normalizada (registros novos)
    `dados_extra->>beneficiario.ilike.*${t}*`,
    // chave antiga, como vinha do 0800 (registros anteriores à normalização)
    `dados_extra->>Beneficiário.ilike.*${t}*`,
  ]

  if (consultores && consultores.length > 0) {
    const nt = normalizarTexto(t)
    const ids = consultores
      .filter((c) => normalizarTexto(c.nome || '').includes(nt))
      .map((c) => c.id)
      .slice(0, 60)
    if (ids.length > 0) partes.push(`consultor_id.in.(${ids.join(',')})`)
  }

  return partes.join(',')
}
