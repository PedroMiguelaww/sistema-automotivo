'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import SeletorPlaca from '@/components/SeletorPlaca'
import type { PlacaLinha } from '@/components/ListaPlacas'
import { modeloDoVeiculo } from '@/components/PlacaDetalhe'
import { lerCampo } from '@/lib/campos0800'
import {
  LIMITE_MENSAL,
  LIMITE_ANUAL,
  NOMES_MESES,
  dataDoCampo,
  hojeParaCampo,
} from '@/lib/reboque'

type Consultor = {
  id: string
  nome: string
}

type Reboque = {
  id: string
  data: string
  observacao: string | null
}

function Contador({ titulo, quantidade, limite }: { titulo: string; quantidade: number; limite: number | null }) {
  const passou = limite !== null && quantidade > limite
  const noLimite = limite !== null && quantidade === limite
  return (
    <div className="cartao flex-1 !py-4">
      <p className="text-xs uppercase tracking-wide text-[var(--cor-texto-suave)] mb-1">{titulo}</p>
      <p
        className={`fonte-titulo text-3xl font-bold ${
          passou ? 'text-red-400' : noLimite ? 'text-amber-400' : 'text-[var(--cor-primaria-clara)]'
        }`}
      >
        {quantidade}
        {limite !== null && (
          <span className="text-base font-normal text-[var(--cor-texto-suave)]"> de {limite}</span>
        )}
      </p>
      {passou && <p className="text-xs text-red-400 mt-1">Passou do limite do plano</p>}
      {noLimite && <p className="text-xs text-amber-400 mt-1">Chegou no limite do plano</p>}
    </div>
  )
}

export default function ReboquePage() {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth()

  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaLinha | null>(null)
  const [reboques, setReboques] = useState<Reboque[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ano, setAno] = useState(anoAtual)
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [dataCampo, setDataCampo] = useState(hojeParaCampo())
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const travado = useRef(false) // impede clique duplo

  const supabase = createClient()
  const { mostrarToast } = useToast()

  async function carregarConsultores() {
    const { data } = await supabase.from('profiles').select('id, nome')
    if (data) setConsultores(data)
  }

  async function carregarReboques(placaId: string) {
    setCarregando(true)
    const { data, error } = await supabase
      .from('reboques')
      .select('id, data, observacao')
      .eq('placa_id', placaId)
      .order('data', { ascending: false })
    setCarregando(false)

    if (error) {
      mostrarToast('Não foi possível carregar os reboques.', 'erro')
      return
    }
    if (data) setReboques(data)
  }

  useEffect(() => {
    carregarConsultores()
  }, [])

  useEffect(() => {
    setMesFiltro(null)
    setConfirmandoId(null)
    setAno(anoAtual)
    if (placaSelecionada) carregarReboques(placaSelecionada.id)
    else setReboques([])
  }, [placaSelecionada?.id])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!placaSelecionada || travado.current) return
    if (!dataCampo) {
      mostrarToast('Informe a data do reboque.', 'erro')
      return
    }

    travado.current = true
    setSalvando(true)

    const { error } = await supabase.from('reboques').insert({
      placa_id: placaSelecionada.id,
      data: dataDoCampo(dataCampo).toISOString(),
      observacao: observacao.trim() || null,
    })

    if (error) {
      mostrarToast('Não foi possível registrar o reboque. Tente novamente.', 'erro')
    } else {
      mostrarToast('Reboque registrado')
      setObservacao('')
      setDataCampo(hojeParaCampo())
      setAno(new Date(dataDoCampo(dataCampo)).getFullYear())
      setMesFiltro(null)
      await carregarReboques(placaSelecionada.id)
    }

    // pequena pausa antes de liberar de novo, para não valer clique duplo
    setTimeout(() => {
      travado.current = false
      setSalvando(false)
    }, 700)
  }

  async function apagar(id: string) {
    if (!placaSelecionada) return
    setConfirmandoId(null)
    const { data, error } = await supabase.from('reboques').delete().eq('id', id).select('id')
    if (error || !data?.length) {
      mostrarToast('Não foi possível apagar o registro.', 'erro')
      return
    }
    mostrarToast('Registro apagado')
    await carregarReboques(placaSelecionada.id)
  }

  const comData = reboques.map((r) => ({ ...r, quando: new Date(r.data) }))

  const noMesAtual = comData.filter(
    (r) => r.quando.getFullYear() === anoAtual && r.quando.getMonth() === mesAtual
  ).length
  const noAnoAtual = comData.filter((r) => r.quando.getFullYear() === anoAtual).length

  const doAno = comData.filter((r) => r.quando.getFullYear() === ano)
  const porMes = NOMES_MESES.map((_, m) => doAno.filter((r) => r.quando.getMonth() === m).length)
  const lista = mesFiltro === null ? doAno : doAno.filter((r) => r.quando.getMonth() === mesFiltro)

  const modelo = modeloDoVeiculo(lerCampo(placaSelecionada?.dados_extra, 'veiculo'))
  const beneficiario = lerCampo(placaSelecionada?.dados_extra, 'beneficiario')
  const consultorResponsavel = consultores.find((c) => c.id === placaSelecionada?.consultor_id)

  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-4">Reboque</h1>

      <SeletorPlaca
        selecionada={placaSelecionada}
        onSelecionar={setPlacaSelecionada}
        consultores={consultores}
      />

      {placaSelecionada && (
        <>
          <p className="text-sm text-[var(--cor-texto-suave)] mb-6">
            {[modelo, beneficiario].filter(Boolean).join(' · ')}
            {(modelo || beneficiario) && ' · '}
            Consultor: <strong className="text-[var(--cor-texto)]">{consultorResponsavel?.nome || '—'}</strong>
          </p>

          <div className="flex gap-3 mb-6">
            <Contador titulo={`Neste mês (${NOMES_MESES[mesAtual]})`} quantidade={noMesAtual} limite={LIMITE_MENSAL} />
            <Contador titulo={`Neste ano (${anoAtual})`} quantidade={noAnoAtual} limite={LIMITE_ANUAL} />
          </div>

          <form onSubmit={registrar} className="cartao mb-6 space-y-3">
            <p className="text-sm font-medium">Registrar um reboque</p>
            <input
              type="date"
              value={dataCampo}
              onChange={(e) => setDataCampo(e.target.value)}
              className="campo-input"
              aria-label="Data do reboque"
            />
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observação (opcional) — ex: de onde para onde"
              className="campo-input"
              maxLength={200}
            />
            <button type="submit" disabled={salvando} className="botao-principal w-full">
              {salvando ? 'Registrando...' : 'Registrar reboque'}
            </button>
          </form>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--cor-texto-suave)] uppercase tracking-wide">
              Por mês
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  setAno(ano - 1)
                  setMesFiltro(null)
                }}
                className="botao-secundario !px-3 !py-1"
                aria-label="Ano anterior"
              >
                ‹
              </button>
              <strong>{ano}</strong>
              <button
                type="button"
                onClick={() => {
                  setAno(ano + 1)
                  setMesFiltro(null)
                }}
                className="botao-secundario !px-3 !py-1"
                aria-label="Próximo ano"
              >
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
            {NOMES_MESES.map((nome, m) => (
              <button
                key={nome}
                type="button"
                onClick={() => setMesFiltro(mesFiltro === m ? null : m)}
                className={`cartao !p-3 text-left ${
                  mesFiltro === m ? 'border-[var(--cor-primaria)]' : ''
                }`}
              >
                <span className="block text-xs text-[var(--cor-texto-suave)]">{nome.slice(0, 3)}</span>
                <span
                  className={`block text-lg font-bold ${
                    porMes[m] === 0 ? 'text-[var(--cor-texto-suave)]' : 'text-[var(--cor-primaria-clara)]'
                  }`}
                >
                  {porMes[m]}
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--cor-texto-suave)] mb-6">
            Total em {ano}: <strong className="text-[var(--cor-texto)]">{doAno.length}</strong>
            {mesFiltro !== null && ` · mostrando só ${NOMES_MESES[mesFiltro]}`}
          </p>

          <h2 className="text-sm font-bold text-[var(--cor-texto-suave)] mb-3 uppercase tracking-wide">
            Registros
          </h2>
          <div className="space-y-2">
            {carregando && lista.length === 0 && <div className="esqueleto h-12 w-full" />}
            {!carregando && lista.length === 0 && (
              <p className="text-sm text-[var(--cor-texto-suave)]">Nenhum reboque registrado nesse período.</p>
            )}
            {lista.map((r) => (
              <div key={r.id} className="cartao flex items-center justify-between gap-3 !py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{r.quando.toLocaleDateString('pt-BR')}</span>
                  {r.observacao && (
                    <span className="block text-xs text-[var(--cor-texto-suave)] truncate">{r.observacao}</span>
                  )}
                </span>
                {confirmandoId === r.id ? (
                  <span className="flex gap-2 shrink-0">
                    <button onClick={() => apagar(r.id)} className="botao-principal text-xs !px-3 !py-1">
                      Apagar
                    </button>
                    <button onClick={() => setConfirmandoId(null)} className="botao-secundario text-xs !px-3 !py-1">
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmandoId(r.id)}
                    className="text-xs text-[var(--cor-texto-suave)] hover:text-red-400 shrink-0"
                    aria-label="Apagar registro"
                  >
                    Apagar
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
