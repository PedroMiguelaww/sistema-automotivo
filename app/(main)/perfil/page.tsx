'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
<<<<<<< HEAD
import PlacaDetalhe from '@/components/PlacaDetalhe'
import ListaPlacas, { type ConsultorNome, type PlacaLinha } from '@/components/ListaPlacas'
=======
import PlacaDetalhe, {
  modeloDoVeiculo,
  STATUS_COR,
  type PlacaResumo,
} from '@/components/PlacaDetalhe'
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d

type Perfil = {
  id: string
  nome: string
  role: string
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
<<<<<<< HEAD
  const [consultores, setConsultores] = useState<ConsultorNome[]>([])
  const [placaAberta, setPlacaAberta] = useState<PlacaLinha | null>(null)
=======
  const [minhasPlacas, setMinhasPlacas] = useState<PlacaResumo[]>([])
  const [placaAberta, setPlacaAberta] = useState<PlacaResumo | null>(null)
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d
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

<<<<<<< HEAD
    // o super admin precisa dos nomes dos consultores (para mostrar e para buscar)
    if (perfilData.role === 'super_admin') {
      const { data: lista } = await supabase.from('profiles').select('id, nome')
      if (lista) setConsultores(lista)
    }

=======
    const { data: placasData } = await supabase
      .from('placas')
      .select('id, placa, status, dados_extra')
      .eq('consultor_id', user.id)
      .order('created_at', { ascending: false })

    if (placasData) setMinhasPlacas(placasData)
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d
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

<<<<<<< HEAD
  const ehSuperAdmin = perfil.role === 'super_admin'

=======
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d
  return (
    <div className="pagina p-8 max-w-2xl">
      <h1 className="fonte-titulo text-xl font-bold mb-1">{perfil.nome}</h1>
      <p className="text-[var(--cor-texto-suave)] mb-6 capitalize">{perfil.role.replace('_', ' ')}</p>

<<<<<<< HEAD
      <h2 className="fonte-titulo text-lg font-bold mb-3">
        {ehSuperAdmin ? 'Todas as placas' : 'Minhas placas'}
      </h2>

      <div className="mb-8">
        {ehSuperAdmin ? (
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
=======
      <h2 className="fonte-titulo text-lg font-bold mb-2">Minhas placas</h2>
      {minhasPlacas.length === 0 ? (
        <p className="text-[var(--cor-texto-suave)] text-sm mb-8">Nenhuma placa vinculada ainda.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {minhasPlacas.map((p) => {
            const modelo = modeloDoVeiculo(p.dados_extra?.['Veículo'])
            const beneficiario = p.dados_extra?.['Beneficiário']
            return (
              <button
                key={p.id}
                onClick={() => setPlacaAberta(p)}
                className="cartao w-full text-left flex items-center justify-between gap-3 !py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {p.placa}
                    {modelo && (
                      <span className="font-normal text-[var(--cor-texto-suave)]"> · {modelo}</span>
                    )}
                  </span>
                  {beneficiario && (
                    <span className="block text-xs text-[var(--cor-texto-suave)] truncate">
                      {beneficiario}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    STATUS_COR[p.status] || 'bg-white/10 text-gray-300'
                  }`}
                >
                  {p.status}
                </span>
              </button>
            )
          })}
        </div>
      )}
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d

      <button onClick={handleSair} className="botao-secundario">
        Sair
      </button>

      {placaAberta && (
<<<<<<< HEAD
        <PlacaDetalhe
          placa={placaAberta}
          consultorNome={
            ehSuperAdmin
              ? consultores.find((c) => c.id === placaAberta.consultor_id)?.nome
              : undefined
          }
          onClose={() => setPlacaAberta(null)}
        />
      )}
    </div>
  )
}
=======
        <PlacaDetalhe placa={placaAberta} onClose={() => setPlacaAberta(null)} />
      )}
    </div>
  )
}
>>>>>>> 20b3ce9c853642ffcf09e249833685434751fe6d
