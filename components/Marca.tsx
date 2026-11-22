import { IconeCarro } from '@/components/Icones'

// Marca do sistema: ícone e nome, em texto. Para usar um logo próprio, é só
// trocar o conteúdo deste componente: ele aparece no cabeçalho e no login.
export default function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-bold fonte-titulo ${
        grande ? 'flex-col sm:flex-row gap-3 text-2xl' : 'text-lg'
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-[var(--raio)] bg-[var(--cor-primaria)] text-white ${
          grande ? 'w-12 h-12' : 'w-9 h-9'
        }`}
      >
        <IconeCarro />
      </span>
      {grande ? 'Sistema Automotivo' : <span className="hidden sm:inline">Sistema Automotivo</span>}
    </span>
  )
}
