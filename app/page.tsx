'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { precisaDoCodigo } from '@/lib/duasEtapas'
import CodigoDuasEtapas from '@/components/CodigoDuasEtapas'
import Image from 'next/image'

type Etapa = 'carregando' | 'login' | 'codigo' | 'esqueci' | 'email-enviado'

export default function HomePage() {
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setEtapa('login')
      } else if (await precisaDoCodigo(supabase)) {
        setEtapa('codigo')
      } else {
        router.push('/perfil')
      }
    }
    checar()
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setEnviando(false)
      setErro('E-mail ou senha incorretos')
      return
    }

    setSenha('')
    if (await precisaDoCodigo(supabase)) {
      setEnviando(false)
      setEtapa('codigo')
      return
    }

    router.push('/perfil')
  }

  async function handleEsqueci(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)

    // A resposta é a mesma exista ou não a conta, para a tela não revelar quem tem cadastro
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    setEnviando(false)
    setEtapa('email-enviado')
  }

  async function cancelarCodigo() {
    await createClient().auth.signOut()
    setEtapa('login')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <Image src="/logo-proseg.png" alt="Proseg" width={220} height={64} className="mb-5" priority />
      <h1 className="fonte-titulo text-2xl font-bold mb-2">
        Sistema Automotivo
      </h1>
      <p className="text-[var(--cor-texto-suave)] mb-8 max-w-sm">
        Gestão e comunicação integrada para atendimento automotivo.
      </p>

      {etapa === 'carregando' && (
        <p className="text-sm text-[var(--cor-texto-suave)]">Carregando...</p>
      )}

      {etapa === 'codigo' && (
        <CodigoDuasEtapas onConfirmado={() => router.push('/perfil')} onCancelar={cancelarCodigo} />
      )}

      {etapa === 'login' && (
        <form onSubmit={handleLogin} className="cartao w-full max-w-sm space-y-4 text-left">
          <div>
            <label htmlFor="email" className="rotulo">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo-input"
              required
            />
          </div>

          <div>
            <label htmlFor="senha" className="rotulo">Senha</label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="campo-input"
              required
            />
          </div>

          {erro && <p className="text-red-300 text-sm font-semibold">{erro}</p>}

          <button type="submit" disabled={enviando} className="botao-principal w-full">
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-sm text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setErro('')
                setEtapa('esqueci')
              }}
              className="text-[var(--cor-primaria-clara)] font-semibold min-h-11 px-2 cursor-pointer hover:underline"
            >
              Esqueci minha senha
            </button>
          </p>
          <p className="text-xs text-[var(--cor-texto-suave)] text-center">
            Precisa de acesso? Fale com o administrador do sistema.
          </p>
        </form>
      )}

      {etapa === 'esqueci' && (
        <form onSubmit={handleEsqueci} className="cartao w-full max-w-sm space-y-4 text-left">
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Informe seu e-mail para receber o link de redefinição de senha.
          </p>
          <div>
            <label htmlFor="email-recuperar" className="rotulo">E-mail</label>
            <input
              id="email-recuperar"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="campo-input"
              required
            />
          </div>
          <button type="submit" disabled={enviando} className="botao-principal w-full">
            {enviando ? 'Enviando...' : 'Enviar link'}
          </button>
          <button type="button" onClick={() => setEtapa('login')} className="botao-secundario w-full">
            Voltar
          </button>
        </form>
      )}

      {etapa === 'email-enviado' && (
        <div className="cartao w-full max-w-sm space-y-3 text-left">
          <p className="text-sm">
            Se esse e-mail tiver acesso ao sistema, o link chegará em alguns minutos. Abra o link neste
            mesmo navegador.
          </p>
          <button type="button" onClick={() => setEtapa('login')} className="botao-secundario w-full">
            Voltar para o login
          </button>
        </div>
      )}
    </div>
  )
}
