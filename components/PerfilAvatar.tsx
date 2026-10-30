'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function PerfilAvatar() {
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
    <div className="fixed top-4 left-4 z-10 flex items-center gap-2">
      <Image
        src="/logo-proseg.png"
        alt="Proseg"
        width={84}
        height={24}
        priority
        className="h-6 w-auto"
      />
      <Link
        href="/perfil"
        className="w-8 h-8 rounded-full bg-[var(--cor-primaria)] text-white text-sm font-bold flex items-center justify-center opacity-20 hover:opacity-100 transition-opacity duration-200"
      >
        {inicial}
      </Link>
    </div>
  )
}