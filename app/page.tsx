'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function HomePage() {
  const [logado, setLogado] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [erro, setErro] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function checar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/perfil')
      } else {
        setLogado(false)
      }
    }
    checar()
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('E-mail ou senha incorretos')
      return
    }

    router.push('/perfil')
  }

  return (
    <div className="pagina flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="fonte-titulo text-4xl font-bold tracking-tight mb-2">
        Sistema Automotivo
      </h1>
      <p className="text-[var(--cor-texto-suave)] mb-8 max-w-sm">
        Gestão e comunicação integrada para atendimento automotivo.
      </p>

      {logado === null ? (
        <p className="text-sm text-[var(--cor-texto-suave)]">Carregando...</p>
      ) : (
        <form onSubmit={handleLogin} className="cartao w-full max-w-sm space-y-3 text-left">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="campo-input"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="campo-input"
            required
          />

          <label className="flex items-center gap-2 text-sm text-[var(--cor-texto-suave)]">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
            />
            Lembrar de mim
          </label>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <button type="submit" className="botao-principal w-full">
            Entrar
          </button>

          <p className="text-sm text-[var(--cor-texto-suave)] text-center pt-2">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-[var(--cor-primaria)] font-medium">
              Criar conta
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}