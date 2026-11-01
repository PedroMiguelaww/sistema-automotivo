'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import SeletorPlaca from '@/components/SeletorPlaca'
import type { PlacaLinha } from '@/components/ListaPlacas'
import { STATUS_LISTA, STATUS_FINAL, corDoStatus } from '@/lib/status'

type Consultor = {
  id: string
  nome: string
}

type HistoricoItem = {
  id: string
  status_anterior: string | null
  status_novo: string
  created_at: string
}

function textoDaMudanca(h: HistoricoItem) {
  if (!h.status_anterior) return `Criado como ${h.status_novo}`
  const antes = STATUS_LISTA.indexOf(h.status_anterior)
  const depois = STATUS_LISTA.indexOf(h.status_novo)
  const voltou = antes >= 0 && depois >= 0 && depois < antes
  return `${voltou ? '↩ ' : ''}${h.status_anterior} → ${h.status_novo}`
}

export default function MecanicaPage() {
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaLinha | null>(null)
  const [atualizarLista, setAtualizarLista] = useState(0)
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [atualizando, setAtualizando] = useState(false)
  const [confirmarFinalizar, setConfirmarFinalizar] = useState(false)
  const travado = useRef(false) // impede clique duplo

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarConsultores() {
    const { data } = await supabase.from('profiles').select('id, nome')
    if (data) setConsultores(data)
  }

  async function carregarHistorico(placaId: string) {
    const { data, error } = await supabase
      .from('status_historico')
      .select('id, status_anterior, status_novo, created_at')
      .eq('placa_id', placaId)
      .order('created_at', { ascending: false })

    if (error) {
      mostrarToast('Não foi possível carregar o histórico.', 'erro')
      return
    }
    if (data) setHistorico(data)
  }

  useEffect(() => {
    carregarConsultores()
  }, [])

  useEffect(() => {
    setConfirmarFinalizar(false)
    if (placaSelecionada) carregarHistorico(placaSelecionada.id)
    else setHistorico([])
  }, [placaSelecionada?.id])

  // Troca a etapa para qualquer outra (avançar, pular ou voltar)
  async function mudarStatus(novo: string) {
    if (!placaSelecionada || travado.current) return
    if (novo === placaSelecionada.status) return

    travado.current = true
    setAtualizando(true)
    setConfirmarFinalizar(false)

    // O histórico é gravado pelo próprio banco, junto com a mudança (ver 04-seguranca.sql).
    // O ".select" serve para notar quando o RLS bloqueia: sem ele, parece que deu certo.
    const { data: alteradas, error: erroUpdate } = await supabase
      .from('placas')
      .update({ status: novo })
      .eq('id', placaSelecionada.id)
      .select('id')

    if (erroUpdate || !alteradas?.length) {
      mostrarToast('Não foi possível atualizar o status. Tente novamente.', 'erro')
    } else {
      mostrarToast(`Status atualizado para "${novo}"`)

      setPlacaSelecionada({ ...placaSelecionada, status: novo })
      setAtualizarLista((n) => n + 1)
      await carregarHistorico(placaSelecionada.id)
    }

    // pequena pausa antes de liberar de novo, para não valer clique duplo
    setTimeout(() => {
      travado.current = false
      setAtualizando(false)
    }, 700)
  }

  function pedirMudanca(novo: string) {
    if (novo === STATUS_FINAL) {
      setConfirmarFinalizar(true)
      return
    }
    mudarStatus(novo)
  }

  const statusAtual = placaSelecionada?.status || ''
  const proximoStatus = STATUS_LISTA[STATUS_LISTA.indexOf(statusAtual) + 1]
  const ultima = historico[0]
  const podeDesfazer = !!ultima && !!ultima.status_anterior && ultima.status_novo === statusAtual

  const consultorResponsavel = consultores.find((c) => c.id === placaSelecionada?.consultor_id)

  return (
    <div className="conteudo">
      <h1 className="titulo-pagina">Mecânica</h1>

      <SeletorPlaca
        selecionada={placaSelecionada}
        onSelecionar={setPlacaSelecionada}
        consultores={consultores}
        refreshKey={atualizarLista}
      />

      {placaSelecionada && (
        <p className="text-sm text-[var(--cor-texto-suave)] mb-6">
          Consultor responsável: <strong className="text-[var(--cor-texto)]">{consultorResponsavel?.nome || '—'}</strong>
        </p>
      )}

      {placaSelecionada && statusAtual && (
        <>
          <div className="cartao mb-6 space-y-4">
            <div>
              <p className="text-sm text-[var(--cor-texto-suave)] mb-2">
                Etapa atual
                {STATUS_LISTA.includes(statusAtual) &&
                  ` (${STATUS_LISTA.indexOf(statusAtual) + 1} de ${STATUS_LISTA.length})`}
              </p>
              <span className={`inline-block px-4 py-1.5 rounded-full font-bold ${corDoStatus(statusAtual)}`}>
                {statusAtual}
              </span>
            </div>

            {confirmarFinalizar ? (
              <div className="border border-[var(--cor-borda)] rounded-[var(--raio)] p-3 space-y-3">
                <p>Finalizar esta placa? Você ainda poderá desfazer logo depois.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => mudarStatus(STATUS_FINAL)}
                    disabled={atualizando}
                    className="botao-principal flex-1"
                  >
                    Sim, finalizar
                  </button>
                  <button
                    onClick={() => setConfirmarFinalizar(false)}
                    className="botao-secundario flex-1"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {proximoStatus ? (
                  <button
                    onClick={() => pedirMudanca(proximoStatus)}
                    disabled={atualizando}
                    className="botao-principal w-full"
                  >
                    {atualizando ? 'Atualizando...' : `Avançar para "${proximoStatus}"`}
                  </button>
                ) : (
                  <p className="text-green-300 font-semibold">✓ Atendimento finalizado</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value=""
                    onChange={(e) => e.target.value && pedirMudanca(e.target.value)}
                    disabled={atualizando}
                    className="campo-input flex-1"
                    aria-label="Ir para outra etapa"
                  >
                    <option value="">Ir para outra etapa...</option>
                    {STATUS_LISTA.filter((s) => s !== statusAtual).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  {podeDesfazer && (
                    <button
                      onClick={() => mudarStatus(ultima.status_anterior as string)}
                      disabled={atualizando}
                      className="botao-secundario"
                    >
                      ↩ Desfazer (voltar para &quot;{ultima.status_anterior}&quot;)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <h2 className="titulo-secao">Histórico</h2>
          <div className="relative pl-4 space-y-5 border-l-2 border-[var(--cor-borda)]">
            {historico.length === 0 && (
              <p className="text-[var(--cor-texto-suave)]">Nenhuma mudança registrada ainda.</p>
            )}
            {historico.map((h) => (
              <div key={h.id} className="relative">
                <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-[var(--cor-primaria)] border-2 border-[var(--cor-fundo)]" />
                <p className="font-semibold">{textoDaMudanca(h)}</p>
                <p className="text-sm text-[var(--cor-texto-suave)]">
                  {new Date(h.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
