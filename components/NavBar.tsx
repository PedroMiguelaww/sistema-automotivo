'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconeCarro, IconeMecanica, IconePecas, IconeReboque } from '@/components/Icones'

const abas = [
  { nome: 'Placas', caminho: '/placas', Icone: IconeCarro },
  { nome: 'Peças', caminho: '/pecas', Icone: IconePecas },
  { nome: 'Mecânica', caminho: '/mecanica', Icone: IconeMecanica },
  { nome: 'Reboque', caminho: '/reboque', Icone: IconeReboque },
]

// No computador fica no topo, ao lado do logo; no celular, na parte de baixo da tela.
export default function NavBar({ posicao }: { posicao: 'topo' | 'rodape' }) {
  const pathname = usePathname()
  const noRodape = posicao === 'rodape'

  return (
    <nav
      aria-label="Menu principal"
      className={
        noRodape
          ? 'md:hidden shrink-0 grid grid-cols-4 gap-1 p-2 bg-[var(--cor-fundo-elevado)] border-t border-[var(--cor-borda)]'
          : 'hidden md:flex items-center gap-1'
      }
    >
      {abas.map(({ nome, caminho, Icone }) => {
        const ativo = pathname === caminho
        return (
          <Link
            key={caminho}
            href={caminho}
            aria-current={ativo ? 'page' : undefined}
            className={`aba ${noRodape ? '!flex-col !gap-0.5 !px-1 text-xs' : ''} ${ativo ? 'aba-ativa' : ''}`}
          >
            <Icone />
            {nome}
          </Link>
        )
      })}
    </nav>
  )
}
