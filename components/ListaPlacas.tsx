'use client'

import { useEffect, useState } from 'react'
import { usePlacasPaginadas } from '@/lib/usePlacasPaginadas'
import { limparBusca, montarFiltroBusca } from '@/lib/busca'
import { lerCampo } from '@/lib/campos0800'
import { modeloDoVeiculo, type PlacaResumo } from '@/components/PlacaDetalhe'
import { corDoStatus } from '@/lib/status'

export type PlacaLinha = PlacaResumo & { consultor_id: string }
export type ConsultorNome = { id: string; nome: string }

// A lista traz só o resumo. Telefone, cidade e os demais dados do cliente
// são buscados quando alguém abre os detalhes da placa.
const CAMPOS =
  'id, placa, status, consultor_id, veiculo:dados_extra->>veiculo, beneficiario:dados_extra->>beneficiario'

type LinhaResumo = Omit<PlacaLinha, 'dados_extra'> & {
  veiculo: string | null
  beneficiario: string | null
}

function paraPlacaLinha({ veiculo, beneficiario, ...placa }: LinhaResumo): PlacaLinha {
  return {
    ...placa,
    dados_extra: {
      ...(veiculo ? { veiculo } : {}),
      ...(beneficiario ? { beneficiario } : {}),
    },
  }
}

export default function ListaPlacas({
  consultorId,
  consultores,
  onAbrir,
  refreshKey,
  classeLista = '',
  textoVazio = 'Nenhuma placa em andamento.',
}: {
  consultorId?: string // só as placas desse consultor
  consultores?: ConsultorNome[] // se vier, mostra o nome do consultor e deixa buscar por ele
  onAbrir?: (placa: PlacaLinha) => void
  refreshKey?: number
  classeLista?: string
  textoVazio?: string
}) {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [incluirFinalizadas, setIncluirFinalizadas] = useState(false)

  // espera o usuário parar de digitar um instante antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca), 300)
    return () => clearTimeout(t)
  }, [busca])

  const { itens, carregando, temMais, erro, carregarMais } = usePlacasPaginadas<LinhaResumo>({
    select: CAMPOS,
    termo: limparBusca(termo),
    filtroOr: montarFiltroBusca(termo, consultores),
    incluirFinalizadas,
    consultorId,
    refreshKey,
  })

  const buscando = limparBusca(termo).length > 0

  return (
    <div>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={
          consultores ? 'Buscar por placa, beneficiário ou consultor...' : 'Buscar por placa ou beneficiário...'
        }
        className="campo-input mb-3"
        aria-label="Buscar placa"
      />

      <label className="flex items-center gap-2 text-sm text-[var(--cor-texto-suave)] mb-4 cursor-pointer w-fit min-h-8">
        <input
          type="checkbox"
          checked={incluirFinalizadas}
          onChange={(e) => setIncluirFinalizadas(e.target.checked)}
        />
        Incluir finalizadas
      </label>

      <div className={`space-y-2 ${classeLista}`}>
        {carregando && itens.length === 0 && (
          <>
            <div className="esqueleto h-14 w-full" />
            <div className="esqueleto h-14 w-full" />
            <div className="esqueleto h-14 w-full" />
          </>
        )}

        {erro && (
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Não foi possível carregar as placas. Verifique sua conexão.
          </p>
        )}

        {!carregando && !erro && itens.length === 0 && (
          <p className="text-sm text-[var(--cor-texto-suave)]">
            {buscando ? 'Nenhuma placa encontrada para essa busca.' : textoVazio}
          </p>
        )}

        {itens.map(paraPlacaLinha).map((p) => {
          const modelo = modeloDoVeiculo(lerCampo(p.dados_extra, 'veiculo'))
          const beneficiario = lerCampo(p.dados_extra, 'beneficiario')
          const nomeConsultor = consultores?.find((c) => c.id === p.consultor_id)?.nome
          const subtitulo = [nomeConsultor, beneficiario].filter(Boolean).join(' · ')

          const conteudo = (
            <>
              <span className="min-w-0">
                <span className="block font-bold">
                  {p.placa}
                  {modelo && (
                    <span className="font-normal text-[var(--cor-texto-suave)]"> · {modelo}</span>
                  )}
                </span>
                {subtitulo && (
                  <span className="block text-sm text-[var(--cor-texto-suave)] truncate">{subtitulo}</span>
                )}
              </span>
              <span
                className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold ${
                  corDoStatus(p.status)
                }`}
              >
                {p.status}
              </span>
            </>
          )

          return onAbrir ? (
            <button
              key={p.id}
              type="button"
              onClick={() => onAbrir(p)}
              className="cartao cartao-clicavel w-full text-left flex items-center justify-between gap-3 !py-3.5"
            >
              {conteudo}
            </button>
          ) : (
            <div key={p.id} className="cartao flex items-center justify-between gap-3 !py-3.5">
              {conteudo}
            </div>
          )
        })}

        {temMais && (
          <button
            type="button"
            onClick={carregarMais}
            disabled={carregando}
            className="botao-secundario w-full"
          >
            {carregando ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}
      </div>
    </div>
  )
}
