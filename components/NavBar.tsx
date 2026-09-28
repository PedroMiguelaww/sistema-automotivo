'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const abas = [
  { nome: 'Placas', caminho: '/placas' },
  { nome: 'Peças', caminho: '/pecas' },
  { nome: 'Mecânica', caminho: '/mecanica' },
]

export default function NavBar() {
  const pathname = usePathname()

  return (
        <nav className="bg-[var(--cor-fundo-elevado)] border-t border-[var(--cor-borda)] flex justify-around py-3">
      {abas.map((aba) => {
        const ativo = pathname === aba.caminho
        return (
          <Link
            key={aba.caminho}
            href={aba.caminho}
            className={`text-sm font-medium transition-colors ${
              ativo ? 'text-[var(--cor-primaria)]' : 'text-[var(--cor-texto-suave)]'
            }`}
          >
            {aba.nome}
          </Link>
        )
      })}
    </nav>
  )
}