'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type Placa = {
  id: string
  placa: string
  status: string
  consultor_id: string
}

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

const STATUS_ORDEM = ['Aguardando avaliação', 'Procurando peça', 'Consertando', 'Finalizado']

const STATUS_COR: Record<string, string> = {
  'Aguardando avaliação': 'bg-white/10 text-gray-300',
  'Procurando peça': 'bg-amber-500/15 text-amber-400',
  'Consertando': 'bg-blue-500/15 text-blue-400',
  'Finalizado': 'bg-green-500/15 text-green-400',
}

export default function MecanicaPage() {
  const [placas, setPlacas] = useState<Placa[]>([])
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placaSelecionada, setPlacaSelecionada] = useState('')
  const [statusAtual, setStatusAtual] = useState('')
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [atualizando, setAtualizando] = useState(false)

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarPlacas() {
    const { data, error } = await supabase.from('placas').select('id, placa, status, consultor_id')
    if (error) {
      mostrarToast('Não foi possível carregar as placas. Verifique sua conexão.', 'erro')
      return
    }
    if (data) setPlacas(data)
  }

  async function carregarConsultores() {
    const { data } = await supabase.from('profiles').select('id, nome')
    if (data) setConsultores(data)
  }

  async function carregarDetalhe(placaId: string) {
    const placa = placas.find((p) => p.id === placaId)
    if (placa) setStatusAtual(placa.status)

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
    carregarPlacas()
    carregarConsultores()
  }, [])

  useEffect(() => {
    if (placaSelecionada) carregarDetalhe(placaSelecionada)
  }, [placaSelecionada, placas])

  async function avancarStatus() {
    if (atualizando) return

    const indexAtual = STATUS_ORDEM.indexOf(statusAtual)
    const proximo = STATUS_ORDEM[indexAtual + 1]
    if (!proximo) return

    setAtualizando(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: erroUpdate } = await supabase
      .from('placas')
      .update({ status: proximo })
      .eq('id', placaSelecionada)

    if (erroUpdate) {
      mostrarToast('Não foi possível atualizar o status. Tente novamente.', 'erro')
      setAtualizando(false)
      return
    }

    const { error: erroHistorico } = await supabase.from('status_historico').insert({
      placa_id: placaSelecionada,
      status_anterior: statusAtual,
      status_novo: proximo,
      atualizado_por: user?.id,
    })

    if (erroHistorico) {
      mostrarToast('Status atualizado, mas o histórico não foi registrado.', 'erro')
    } else {
      mostrarToast(`Status atualizado para "${proximo}"`)
    }

    await carregarPlacas()
    await carregarDetalhe(placaSelecionada)
    setAtualizando(false)
  }

  const proximoStatus = STATUS_ORDEM[STATUS_ORDEM.indexOf(statusAtual) + 1]

  const consultorResponsavel = consultores.find(
    (c) => c.id === placas.find((p) => p.id === placaSelecionada)?.consultor_id
  )

  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-4">Mecânica</h1>

      <label className="block mb-1 text-sm font-medium text-[var(--cor-texto-suave)]">Placa</label>
      <select
        value={placaSelecionada}
        onChange={(e) => setPlacaSelecionada(e.target.value)}
        className="campo-input mb-2"
      >
        <option value="">Selecione a placa...</option>
        {placas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.placa}
          </option>
        ))}
      </select>

      {placaSelecionada && (
        <p className="text-sm text-[var(--cor-texto-suave)] mb-6">
          Consultor responsável: <strong className="text-[var(--cor-texto)]">{consultorResponsavel?.nome || '—'}</strong>
        </p>
      )}

      {placaSelecionada && statusAtual && (
        <>
          <div className="cartao mb-6">
            <p className="text-xs text-[var(--cor-texto-suave)] mb-2 uppercase tracking-wide">Status atual</p>
            <span className={`inline-block px-3 py-1.5 rounded-full font-semibold text-sm mb-4 ${STATUS_COR[statusAtual]}`}>
              {statusAtual}
            </span>

            {proximoStatus ? (
              <button onClick={avancarStatus} disabled={atualizando} className="botao-principal w-full">
                {atualizando ? 'Atualizando...' : `Avançar para "${proximoStatus}"`}
              </button>
            ) : (
              <p className="text-green-400 text-sm font-medium">✓ Atendimento finalizado</p>
            )}
          </div>

          <h2 className="text-sm font-bold text-[var(--cor-texto-suave)] mb-3 uppercase tracking-wide">Histórico</h2>
          <div className="relative pl-4 space-y-5 border-l-2 border-[var(--cor-borda)]">
            {historico.length === 0 && (
              <p className="text-[var(--cor-texto-suave)] text-sm">Nenhuma mudança registrada ainda.</p>
            )}
            {historico.map((h) => (
              <div key={h.id} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-[var(--cor-primaria)] border-2 border-[var(--cor-fundo)]" />
                <p className="text-sm font-medium">
                  {h.status_anterior ? `${h.status_anterior} → ${h.status_novo}` : `Criado como ${h.status_novo}`}
                </p>
                <p className="text-xs text-[var(--cor-texto-suave)]">
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