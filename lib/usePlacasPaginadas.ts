'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export const TAMANHO_PAGINA = 30

type Opcoes = {
  select: string
  termo: string // texto já limpo (usado na busca simples por placa)
  filtroOr?: string // filtro "ou" pronto (placa, beneficiário, consultor)
  incluirFinalizadas: boolean
  consultorId?: string
  refreshKey?: number
}

// Busca placas de 30 em 30, mais recentes primeiro.
// Por padrão esconde as "Finalizado".
export function usePlacasPaginadas<T extends { id: string }>(opcoes: Opcoes) {
  const { select, termo, filtroOr, incluirFinalizadas, consultorId, refreshKey } = opcoes

  const [itens, setItens] = useState<T[]>([])
  const [carregando, setCarregando] = useState(true)
  const [temMais, setTemMais] = useState(false)
  const [erro, setErro] = useState(false)
  const numeroDaBusca = useRef(0)

  const carregar = useCallback(
    async (deslocamento: number, anexar: boolean) => {
      const minhaBusca = ++numeroDaBusca.current
      const supabase = createClient()
      setCarregando(true)
      setErro(false)

      function montar(usarFiltroOr: boolean) {
        let q = supabase
          .from('placas')
          .select(select)
          .order('created_at', { ascending: false })
          .range(deslocamento, deslocamento + TAMANHO_PAGINA) // pede 1 a mais pra saber se tem mais

        if (consultorId) q = q.eq('consultor_id', consultorId)
        if (!incluirFinalizadas) q = q.neq('status', 'Finalizado')
        if (usarFiltroOr && filtroOr) q = q.or(filtroOr)
        else if (termo) q = q.ilike('placa', `%${termo}%`)
        return q
      }

      let { data, error } = await montar(true)
      // se o filtro completo falhar, tenta só pela placa
      if (error && filtroOr) {
        ;({ data, error } = await montar(false))
      }

      if (minhaBusca !== numeroDaBusca.current) return // chegou uma busca mais nova

      if (error || !data) {
        setErro(true)
        setCarregando(false)
        return
      }

      const recebidos = data as unknown as T[]
      setTemMais(recebidos.length > TAMANHO_PAGINA)
      const pagina = recebidos.slice(0, TAMANHO_PAGINA)

      setItens((antigos) => {
        if (!anexar) return pagina
        const vistos = new Set(antigos.map((i) => i.id))
        return [...antigos, ...pagina.filter((i) => !vistos.has(i.id))]
      })
      setCarregando(false)
    },
    [select, termo, filtroOr, incluirFinalizadas, consultorId]
  )

  useEffect(() => {
    carregar(0, false)
  }, [carregar, refreshKey])

  function carregarMais() {
    carregar(itens.length, true)
  }

  return { itens, carregando, temMais, erro, carregarMais }
}
