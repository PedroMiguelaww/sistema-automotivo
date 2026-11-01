'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { lerCampo } from '@/lib/campos0800'
import { corDoStatus } from '@/lib/status'
import { lerLinkExterno } from '@/lib/links'
import { formatarReais } from '@/lib/moeda'

export type PlacaResumo = {
  id: string
  placa: string
  status: string
  dados_extra: Record<string, string> | null
}

// "RZS7J95-STRADA VOLCANO 1.3" -> "STRADA VOLCANO 1.3"
export function modeloDoVeiculo(veiculo?: string) {
  if (!veiculo) return ''
  return veiculo.replace(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}\s*-?\s*/, '').trim()
}

function soDigitos(texto?: string) {
  return (texto || '').split(/[\/,;]/)[0].replace(/\D/g, '')
}

export default function PlacaDetalhe({
  placa,
  consultorNome,
  onClose,
}: {
  placa: PlacaResumo
  consultorNome?: string
  onClose: () => void
}) {
  const [qtdPecas, setQtdPecas] = useState(0)
  const [totalPecas, setTotalPecas] = useState(0)
  const [reboquesMes, setReboquesMes] = useState(0)
  const [reboquesAno, setReboquesAno] = useState(0)
  const [erroReboques, setErroReboques] = useState(false)
  // A lista só traz o resumo: os dados completos do cliente vêm ao abrir
  const [dadosCompletos, setDadosCompletos] = useState<Record<string, string> | null>(null)

  const dados = dadosCompletos || placa.dados_extra || {}
  const temDados = Object.keys(dados).length > 0

  useEffect(() => {
    createClient()
      .from('placas')
      .select('dados_extra')
      .eq('id', placa.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.dados_extra) setDadosCompletos(data.dados_extra)
      })
  }, [placa.id])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('pecas')
      .select('valor')
      .eq('placa_id', placa.id)
      .then(({ data }) => {
        if (data) {
          setQtdPecas(data.length)
          setTotalPecas(data.reduce((soma, p) => soma + Number(p.valor), 0))
        }
      })
  }, [placa.id])

  useEffect(() => {
    const agora = new Date()
    const inicioAno = new Date(agora.getFullYear(), 0, 1)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    createClient()
      .from('reboques')
      .select('data')
      .eq('placa_id', placa.id)
      .gte('data', inicioAno.toISOString())
      .then(({ data, error }) => {
        if (error) {
          // melhor mostrar "—" do que exibir 0 e parecer que não há reboques
          setErroReboques(true)
          return
        }
        if (data) {
          setReboquesAno(data.length)
          setReboquesMes(data.filter((r) => new Date(r.data) >= inicioMes).length)
        }
      })
  }, [placa.id])

  useEffect(() => {
    function aoApertarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', aoApertarTecla)
    return () => window.removeEventListener('keydown', aoApertarTecla)
  }, [onClose])

  const campos: [string, string | undefined][] = [
    ['Consultor', consultorNome],
    ['Beneficiário', lerCampo(dados, 'beneficiario')],
    ['Cidade', lerCampo(dados, 'cidade')],
    ['Veículo', modeloDoVeiculo(lerCampo(dados, 'veiculo'))],
    ['Marca', lerCampo(dados, 'marca')],
    ['Cor', lerCampo(dados, 'cor')],
    ['Adesão', lerCampo(dados, 'adesao')],
    ['Motivo', lerCampo(dados, 'motivo')],
    ['Data/Hora', lerCampo(dados, 'data/hora')],
    ['Protocolo', lerCampo(dados, 'protocolo')],
  ]

  const observacao = lerCampo(dados, 'observacao')
  const telefone = soDigitos(lerCampo(dados, 'telefones'))
  const mapa = lerLinkExterno(lerCampo(dados, 'link origem'))

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="cartao w-full max-w-md max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da placa ${placa.placa}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="fonte-titulo text-xl font-bold">{placa.placa}</h2>
            <span
              className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                corDoStatus(placa.status)
              }`}
            >
              {placa.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="botao-secundario !px-4 shrink-0"
          >
            Fechar
          </button>
        </div>

        {temDados ? (
          <dl className="space-y-3">
            {campos.map(
              ([rotulo, valor]) =>
                valor && (
                  <div key={rotulo}>
                    <dt className="text-sm text-[var(--cor-texto-suave)]">
                      {rotulo}
                    </dt>
                    <dd className="font-semibold">{valor}</dd>
                  </div>
                )
            )}

            {observacao && (
              <div>
                <dt className="text-sm text-[var(--cor-texto-suave)]">
                  Observação
                </dt>
                <dd className="whitespace-pre-line">
                  {observacao}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Esta placa foi cadastrada sem a mensagem do 0800, então não há mais detalhes do veículo.
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--cor-borda)] flex justify-between gap-3">
          <span className="text-[var(--cor-texto-suave)]">
            Peças ({qtdPecas})
          </span>
          <strong>{formatarReais(totalPecas)}</strong>
        </div>

        <div className="mt-2 flex justify-between gap-3">
          <span className="text-[var(--cor-texto-suave)]">Reboques (este mês / este ano)</span>
          <strong>{erroReboques ? '—' : `${reboquesMes} / ${reboquesAno}`}</strong>
        </div>

        {(telefone || mapa) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {telefone && (
              <>
                <a href={`tel:+${telefone}`} className="botao-secundario flex-1">
                  Ligar
                </a>
                <a
                  href={`https://wa.me/${telefone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao-secundario flex-1"
                >
                  WhatsApp
                </a>
              </>
            )}
            {mapa && (
              <a
                href={mapa.url}
                target="_blank"
                rel="noopener noreferrer"
                className="botao-secundario w-full"
              >
                {mapa.conhecido ? 'Ver no mapa' : `Abrir link (${mapa.site})`}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
