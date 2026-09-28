'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Perfil = {
  id: string
  nome: string
  role: string
}

type Placa = {
  id: string
  placa: string
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [minhasPlacas, setMinhasPlacas] = useState<Placa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregar, setErroCarregar] = useState(false)
  const router = useRouter()

  const supabase = createClient()

  async function carregarPerfil() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: perfilData, error } = await supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('id', user.id)
      .single()

    if (error || !perfilData) {
      setErroCarregar(true)
      setCarregando(false)
      return
    }

    setPerfil(perfilData)

    const { data: placasData } = await supabase
      .from('placas')
      .select('id, placa')
      .eq('consultor_id', user.id)

    if (placasData) setMinhasPlacas(placasData)
    setCarregando(false)
  }

  useEffect(() => {
    carregarPerfil()
  }, [])

  async function handleSair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (carregando) {
    return (
      <div className="pagina p-8 max-w-2xl">
        <div className="esqueleto h-8 w-48 mb-2" />
        <div className="esqueleto h-4 w-24 mb-6" />
        <div className="esqueleto h-6 w-32 mb-2" />
        <div className="esqueleto h-16 w-full" />
      </div>
    )
  }

  if (erroCarregar || !perfil) {
    return (
      <div className="pagina p-8 max-w-2xl">
        <p className="text-[var(--cor-texto-suave)] mb-4">
          Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.
        </p>
        <button onClick={handleSair} className="botao-secundario">
          Sair
        </button>
      </div>
    )
  }

  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-1">{perfil.nome}</h1>
      <p className="text-[var(--cor-texto-suave)] mb-6 capitalize">{perfil.role.replace('_', ' ')}</p>

      <h2 className="fonte-titulo text-lg font-bold mb-2">Minhas placas</h2>
      {minhasPlacas.length === 0 ? (
        <p className="text-[var(--cor-texto-suave)] text-sm mb-8">Nenhuma placa vinculada ainda.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {minhasPlacas.map((p) => (
            <div key={p.id} className="cartao text-sm">
              {p.placa}
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSair} className="botao-secundario">
        Sair
      </button>
    </div>
  )
}