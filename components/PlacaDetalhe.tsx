'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { STATUS_COR, corDoStatus } from '@/lib/status'

export { STATUS_COR }

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

function linkSeguro(url?: string) {
  const limpo = (url || '').trim()
  return /^https:\/\//i.test(limpo) ? limpo : null
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

  const dados = placa.dados_extra || {}
  const temDados = Object.keys(dados).length > 0

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
      .select('data_hora')
      .eq('placa_id', placa.id)
      .gte('data_hora', inicioAno.toISOString())
      .then(({ data }) => {
        if (data) {
          setReboquesAno(data.length)
          setReboquesMes(data.filter((r) => new Date(r.data_hora) >= inicioMes).length)
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
    ['Beneficiário', dados['Beneficiário']],
    ['Cidade', dados['Cidade']],
    ['Veículo', modeloDoVeiculo(dados['Veículo'])],
    ['Marca', dados['Marca']],
    ['Cor', dados['Cor']],
    ['Adesão', dados['Adesão']],
    ['Motivo', dados['Motivo']],
    ['Data/Hora', dados['Data/Hora']],
    ['Protocolo', dados['Protocolo']],
  ]

  const telefone = soDigitos(dados['Telefones'])
  const mapa = linkSeguro(dados['Link Origem'])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="cartao modal-entrada w-full max-w-md max-h-[85dvh] overflow-y-auto sem-scrollbar"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da placa ${placa.placa}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="fonte-titulo text-xl font-bold">{placa.placa}</h2>
            <span
              className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                corDoStatus(placa.status)
              }`}
            >
              {placa.status}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-[var(--cor-texto-suave)] hover:text-white text-xl leading-none px-2"
          >
            ✕
          </button>
        </div>

        {temDados ? (
          <dl className="space-y-3 text-sm">
            {campos.map(
              ([rotulo, valor]) =>
                valor && (
                  <div key={rotulo}>
                    <dt className="text-xs uppercase tracking-wide text-[var(--cor-texto-suave)]">
                      {rotulo}
                    </dt>
                    <dd className="font-medium">{valor}</dd>
                  </div>
                )
            )}

            {dados['Observação'] && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--cor-texto-suave)]">
                  Observação
                </dt>
                <dd className="text-[var(--cor-texto-suave)] whitespace-pre-line">
                  {dados['Observação']}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Esta placa foi cadastrada sem a mensagem do 0800, então não há mais detalhes do veículo.
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--cor-borda)] text-sm flex justify-between">
          <span className="text-[var(--cor-texto-suave)]">
            Peças ({qtdPecas})
          </span>
          <strong className="text-[var(--cor-primaria-clara)]">R$ {totalPecas.toFixed(2)}</strong>
        </div>

        <div className="mt-2 text-sm flex justify-between">
          <span className="text-[var(--cor-texto-suave)]">Reboques (este mês / este ano)</span>
          <strong>
            {reboquesMes} / {reboquesAno}
          </strong>
        </div>

        {(telefone || mapa) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {telefone && (
              <>
                <a href={`tel:+${telefone}`} className="botao-secundario text-sm">
                  Ligar
                </a>
                <a
                  href={`https://wa.me/${telefone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao-secundario text-sm"
                >
                  WhatsApp
                </a>
              </>
            )}
            {mapa && (
              <a
                href={mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="botao-secundario text-sm"
              >
                Ver no mapa
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
