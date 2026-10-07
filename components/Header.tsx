'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function Header() {
  const [inicial, setInicial] = useState('?')

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
    <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--cor-borda)]">
      <img src="/logo-proseg.png" alt="Proseg" className="h-10 w-auto" />

      <Link
        href="/perfil"
        className="w-9 h-9 rounded-full bg-[var(--cor-primaria)] text-white text-sm font-bold flex items-center justify-center hover:scale-105 transition-transform"
      >
        {inicial}
      </Link>
    </header>
  )
}