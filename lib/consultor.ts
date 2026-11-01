import { normalizarTexto } from '@/lib/texto'

type ConsultorNome = { id: string; nome: string }

// Procura o consultor citado na mensagem do 0800.
// Só o nome idêntico é escolhido sozinho. Nome parecido vira sugestão para a
// pessoa conferir, para a placa (e os dados do cliente) não irem para a conta errada.
export function identificarConsultor<T extends ConsultorNome>(nome: string, consultores: T[]) {
  const alvo = normalizarTexto(nome)
  if (!alvo) return { sugestoes: [] as T[] }

  const iguais = consultores.filter((c) => normalizarTexto(c.nome || '') === alvo)
  if (iguais.length === 1) return { exato: iguais[0], sugestoes: [] as T[] }
  if (iguais.length > 1) return { sugestoes: iguais }

  const parecidos = consultores.filter((c) => {
    const cadastrado = normalizarTexto(c.nome || '')
    if (cadastrado.length < 3 || alvo.length < 3) return false
    return cadastrado.includes(alvo) || alvo.includes(cadastrado)
  })
  return { sugestoes: parecidos }
}
