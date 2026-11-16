'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PlacaDetalhe from '@/components/PlacaDetalhe'
import ListaPlacas, { type ConsultorNome, type PlacaLinha } from '@/components/ListaPlacas'
import GerenciarUsuarios from '@/components/GerenciarUsuarios'
import DuasEtapas from '@/components/DuasEtapas'
import AlterarSenha from '@/components/AlterarSenha'
import { nomeDoPapel } from '@/lib/papeis'

type Perfil = {
  id: string
  nome: string
  role: string
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [consultores, setConsultores] = useState<ConsultorNome[]>([])
  const [placaAberta, setPlacaAberta] = useState<PlacaLinha | null>(null)
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

    // quem vê todas as placas precisa dos nomes dos consultores (para mostrar e para buscar)
    if (perfilData.role === 'super_admin' || perfilData.role === 'operador') {
      const { data: lista } = await supabase.from('profiles').select('id, nome')
      if (lista) setConsultores(lista)
    }

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
      <div className="conteudo">
        <div className="esqueleto h-8 w-48 mb-2" />
        <div className="esqueleto h-4 w-24 mb-6" />
        <div className="esqueleto h-6 w-32 mb-2" />
        <div className="esqueleto h-16 w-full" />
      </div>
    )
  }

  if (erroCarregar || !perfil) {
    return (
      <div className="conteudo">
        <p className="text-[var(--cor-texto-suave)] mb-4">
          Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.
        </p>
        <button onClick={handleSair} className="botao-secundario">
          Sair
        </button>
      </div>
    )
  }

  const ehSuperAdmin = perfil.role === 'super_admin'
  const veTodas = ehSuperAdmin || perfil.role === 'operador'

  return (
    <div className="conteudo">
      <h1 className="titulo-pagina !mb-1">{perfil.nome}</h1>
      <p className="text-[var(--cor-texto-suave)] mb-8">{nomeDoPapel(perfil.role)}</p>

      <h2 className="titulo-secao">
        {veTodas ? 'Todas as placas' : 'Minhas placas'}
      </h2>

      <div className="mb-8">
        {veTodas ? (
          <ListaPlacas
            consultores={consultores}
            onAbrir={setPlacaAberta}
            textoVazio="Nenhuma placa em andamento."
          />
        ) : (
          <ListaPlacas
            consultorId={perfil.id}
            onAbrir={setPlacaAberta}
            textoVazio="Nenhuma placa em andamento."
          />
        )}
      </div>

      {ehSuperAdmin && <GerenciarUsuarios meuId={perfil.id} />}

      <AlterarSenha />

      <DuasEtapas />

      <button onClick={handleSair} className="botao-secundario w-full sm:w-auto">
        Sair do sistema
      </button>

      {placaAberta && (
        <PlacaDetalhe
          placa={placaAberta}
          consultorNome={
            veTodas
              ? consultores.find((c) => c.id === placaAberta.consultor_id)?.nome
              : undefined
          }
          onClose={() => setPlacaAberta(null)}
        />
      )}
    </div>
  )
}
