'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function PerfilAvatar() {
  const [inicial, setInicial] = useState('?')
  const pathname = usePathname()

  useEffect(() => {
    async function carregar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single()

      if (data?.nome) {
        setInicial(data.nome.trim().charAt(0).toUpperCase())
      }
    }
    carregar()
  }, [])

  return (
    <Link
      href="/perfil"
      aria-current={pathname === '/perfil' ? 'page' : undefined}
      className={`aba shrink-0 !pl-2 ${pathname === '/perfil' ? 'aba-ativa' : ''}`}
    >
      <span className="w-8 h-8 rounded-full bg-[var(--cor-primaria)] border border-white/30 text-white text-sm font-bold flex items-center justify-center">
        {inicial}
      </span>
      Perfil
    </Link>
  )
}
