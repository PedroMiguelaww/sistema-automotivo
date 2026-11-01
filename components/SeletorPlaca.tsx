'use client'

import ListaPlacas, { type ConsultorNome, type PlacaLinha } from '@/components/ListaPlacas'
import { corDoStatus } from '@/lib/status'

// Escolhe uma placa na lista (com busca e "carregar mais").
// Depois de escolhida, mostra só ela, com o botão "Trocar".
export default function SeletorPlaca({
  selecionada,
  onSelecionar,
  consultores,
  refreshKey,
}: {
  selecionada: PlacaLinha | null
  onSelecionar: (placa: PlacaLinha | null) => void
  consultores?: ConsultorNome[]
  refreshKey?: number
}) {
  if (selecionada) {
    return (
      <div className="cartao flex items-center justify-between gap-3 mb-3 !py-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <strong className="text-lg">{selecionada.placa}</strong>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              corDoStatus(selecionada.status)
            }`}
          >
            {selecionada.status}
          </span>
        </span>
        <button type="button" onClick={() => onSelecionar(null)} className="botao-secundario shrink-0 !px-4">
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <p className="rotulo !mb-2">Escolha a placa</p>
      <ListaPlacas
        consultores={consultores}
        onAbrir={onSelecionar}
        refreshKey={refreshKey}
      />
    </div>
  )
}
