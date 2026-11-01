'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { precisaDoCodigo } from '@/lib/duasEtapas'

// Evita mostrar telas vazias para quem não tem acesso liberado.
// Assim como o proxy, é conforto de navegação: a proteção real é o RLS.
export default function GuardaAcesso({ children }: { children: React.ReactNode }) {
  const [situacao, setSituacao] = useState<'verificando' | 'liberado' | 'pendente'>('verificando')
  const router = useRouter()

  useEffect(() => {
    async function verificar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || (await precisaDoCodigo(supabase))) {
        router.replace('/')
        return
      }

      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      // conta sem perfil também não tem acesso; em falha de conexão, a tela avisa o erro
      setSituacao(!error && (!data || data.role === 'pendente') ? 'pendente' : 'liberado')
    }
    verificar()
  }, [router])

  async function sair() {
    await createClient().auth.signOut()
    router.replace('/')
  }

  if (situacao === 'verificando') return null

  if (situacao === 'pendente') {
    return (
      <div className="pagina flex h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="fonte-titulo text-xl font-bold mb-2">Acesso aguardando liberação</h1>
        <p className="text-sm text-[var(--cor-texto-suave)] mb-6 max-w-sm">
          Sua conta existe, mas ainda não tem acesso ao sistema. Fale com o administrador.
        </p>
        <button onClick={sair} className="botao-secundario">
          Sair
        </button>
      </div>
    )
  }

  return <>{children}</>
}
