'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// Pede o código de 6 dígitos do aplicativo autenticador.
export default function CodigoDuasEtapas({
  onConfirmado,
  onCancelar,
}: {
  onConfirmado: () => void
  onCancelar: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro('')
    setEnviando(true)

    const supabase = createClient()
    const { data } = await supabase.auth.mfa.listFactors()
    const fator = data?.totp[0]
    const { error } = fator
      ? await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() })
      : { error: new Error('sem fator') }

    setEnviando(false)
    if (error) {
      setErro('Código incorreto ou expirado. Tente novamente.')
      setCodigo('')
      return
    }
    onConfirmado()
  }

  return (
    <form onSubmit={confirmar} className="cartao w-full max-w-sm space-y-3 text-left">
      <p className="text-sm text-[var(--cor-texto-suave)]">
        Digite o código de 6 dígitos do seu aplicativo autenticador.
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="campo-input"
        aria-label="Código de verificação"
        required
      />
      {erro && <p className="text-red-300 text-sm font-semibold">{erro}</p>}
      <button type="submit" disabled={enviando} className="botao-principal w-full">
        {enviando ? 'Confirmando...' : 'Confirmar'}
      </button>
      <button type="button" onClick={onCancelar} className="botao-secundario w-full">
        Voltar
      </button>
    </form>
  )
}
