'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
      },
    })

    if (error) {
      setErro('Não foi possível criar a conta: ' + error.message)
      return
    }

    setSucesso(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="pagina flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleCadastro} className="cartao w-full max-w-sm space-y-3">
        <h1 className="fonte-titulo text-xl font-bold mb-4">Criar conta</h1>

        {sucesso ? (
          <p className="text-green-400 text-sm">
            Conta criada com sucesso! Redirecionando pro login...
          </p>
        ) : (
          <>
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="campo-input"
              required
            />

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
              minLength={8}
            />

            {erro && <p className="text-red-400 text-sm">{erro}</p>}

            <button type="submit" className="botao-principal w-full">
              Criar conta
            </button>

            <p className="text-sm text-[var(--cor-texto-suave)] text-center pt-2">
              Já tem conta?{' '}
              <Link href="/login" className="text-[var(--cor-primaria)] font-medium">
                Entrar
              </Link>
            </p>
          </>
        )}
      </form>
    </div>
  )
}