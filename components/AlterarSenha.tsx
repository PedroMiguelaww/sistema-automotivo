'use client'

import { useState } from 'react'
import { createClient as criarClienteSupabase } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

// Troca a senha de quem está logado, sem depender do envio de e-mail.
// A senha atual é conferida num login à parte, que não mexe na sessão aberta
// e é encerrado logo depois; só então a senha nova é gravada.
async function senhaAtualConfere(email: string, senha: string) {
  const conferencia = criarClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
  const { error } = await conferencia.auth.signInWithPassword({ email, password: senha })
  if (error) return false
  await conferencia.auth.signOut({ scope: 'local' })
  return true
}

export default function AlterarSenha() {
  const [aberto, setAberto] = useState(false)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { mostrarToast } = useToast()

  function fechar() {
    setAberto(false)
    setAtual('')
    setNova('')
    setConfirmacao('')
    setErro('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (nova !== confirmacao) {
      setErro('A nova senha e a repetição não são iguais.')
      return
    }
    if (nova === atual) {
      setErro('A nova senha precisa ser diferente da atual.')
      return
    }

    setSalvando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !(await senhaAtualConfere(user.email, atual))) {
      setSalvando(false)
      setErro('Senha atual incorreta.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: nova })
    if (error) {
      setSalvando(false)
      setErro(
        'Não foi possível trocar a senha. Use uma senha mais forte. Se continuar, saia, entre de novo e tente outra vez.'
      )
      return
    }

    // quem estava com a senha antiga em outro aparelho precisa entrar de novo
    await supabase.auth.signOut({ scope: 'others' })
    setSalvando(false)
    fechar()
    mostrarToast('Senha alterada')
  }

  return (
    <div className="cartao mb-8 space-y-3">
      <h2 className="titulo-secao !mb-0">Alterar senha</h2>

      {!aberto ? (
        <>
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Recebeu uma senha temporária? Troque por uma só sua.
          </p>
          <button onClick={() => setAberto(true)} className="botao-secundario">
            Alterar senha
          </button>
        </>
      ) : (
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label htmlFor="senha-atual" className="rotulo">Senha atual</label>
            <input
              id="senha-atual"
              type="password"
              autoComplete="current-password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              className="campo-input"
              required
            />
          </div>
          <div>
            <label htmlFor="senha-nova" className="rotulo">Nova senha (mínimo 8 caracteres)</label>
            <input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              className="campo-input"
              minLength={8}
              required
            />
          </div>
          <div>
            <label htmlFor="senha-repetir" className="rotulo">Repita a nova senha</label>
            <input
              id="senha-repetir"
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="campo-input"
              minLength={8}
              required
            />
          </div>
          {erro && <p className="text-red-300 text-sm font-semibold">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando} className="botao-principal flex-1">
              {salvando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <button type="button" onClick={fechar} className="botao-secundario flex-1">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
