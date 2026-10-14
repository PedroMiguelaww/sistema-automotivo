'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [erro, setErro] = useState('')
  const router = useRouter()

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

    router.push('/')
  }

  return (
    <div className="pagina flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleLogin} className="cartao w-full max-w-sm space-y-3">
        <h1 className="fonte-titulo text-xl font-bold mb-4">Entrar</h1>

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
    </div>
  )
}