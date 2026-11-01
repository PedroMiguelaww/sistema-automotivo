'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { precisaDoCodigo } from '@/lib/duasEtapas'
import CodigoDuasEtapas from '@/components/CodigoDuasEtapas'

type Etapa = 'carregando' | 'invalido' | 'codigo' | 'senha' | 'pronto'

export default function RedefinirSenhaPage() {
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()

    // Este evento só acontece quando o link do e-mail é válido. Estar logado não
    // basta: sem ele, ninguém troca a senha por esta tela. O Supabase pede para não
    // chamar outras funções dele dentro deste aviso, daí o setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => {
      if (evento !== 'PASSWORD_RECOVERY') return
      clearTimeout(espera.current)
      setTimeout(async () => {
        setEtapa((await precisaDoCodigo(supabase)) ? 'codigo' : 'senha')
      }, 0)
    })

    espera.current = setTimeout(() => setEtapa('invalido'), 5000)

    return () => {
      clearTimeout(espera.current)
      subscription.unsubscribe()
    }
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }

    setSalvando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setSalvando(false)
      setErro('Não foi possível trocar a senha. Use uma senha mais forte e diferente da anterior.')
      return
    }

    // Encerra todas as sessões abertas: quem estava com a senha antiga precisa sair
    await supabase.auth.signOut()
    setSalvando(false)
    setEtapa('pronto')
  }

  async function cancelar() {
    await createClient().auth.signOut()
    setEtapa('invalido')
  }

  return (
    <div className="pagina flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="fonte-titulo text-xl font-bold mb-4">Redefinir senha</h1>

      {etapa === 'carregando' && (
        <p className="text-sm text-[var(--cor-texto-suave)]">Carregando...</p>
      )}

      {etapa === 'invalido' && (
        <div className="cartao w-full max-w-sm space-y-3">
          <p className="text-sm">
            Este link é inválido ou expirou. Peça um novo na tela de login e abra-o neste mesmo navegador.
          </p>
          <Link href="/" className="botao-secundario block text-center">
            Ir para o login
          </Link>
        </div>
      )}

      {etapa === 'codigo' && (
        <CodigoDuasEtapas onConfirmado={() => setEtapa('senha')} onCancelar={cancelar} />
      )}

      {etapa === 'senha' && (
        <form onSubmit={salvar} className="cartao w-full max-w-sm space-y-3">
          <input
            type="password"
            placeholder="Nova senha (mínimo 8 caracteres)"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="campo-input"
            minLength={8}
            required
          />
          <input
            type="password"
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="campo-input"
            minLength={8}
            required
          />
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={salvando} className="botao-principal w-full">
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}

      {etapa === 'pronto' && (
        <div className="cartao w-full max-w-sm space-y-3">
          <p className="text-sm">Senha alterada. Entre novamente com a nova senha.</p>
          <Link href="/" className="botao-principal block text-center">
            Ir para o login
          </Link>
        </div>
      )}
    </div>
  )
}
