'use client'

import ListaPlacas, { type ConsultorNome, type PlacaLinha } from '@/components/ListaPlacas'
import { STATUS_COR } from '@/components/PlacaDetalhe'

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
      <div className="cartao flex items-center justify-between gap-3 mb-2 !py-3">
        <span className="flex items-center gap-3 min-w-0">
          <strong className="text-sm">{selecionada.placa}</strong>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              STATUS_COR[selecionada.status] || 'bg-white/10 text-gray-300'
            }`}
          >
            {selecionada.status}
          </span>
        </span>
        <button type="button" onClick={() => onSelecionar(null)} className="botao-secundario text-sm">
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <label className="block mb-2 text-sm font-medium text-[var(--cor-texto-suave)]">
        Escolha a placa
      </label>
      <ListaPlacas
        consultores={consultores}
        onAbrir={onSelecionar}
        refreshKey={refreshKey}
        classeLista="max-h-[28rem] overflow-y-auto sem-scrollbar"
      />
    </div>
  )
}
