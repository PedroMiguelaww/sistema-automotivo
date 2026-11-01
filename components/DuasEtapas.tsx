'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type Cadastro = { id: string; qrCode: string; segredo: string }

// Ativa ou desativa a verificação em duas etapas da própria conta.
export default function DuasEtapas() {
  const [fatorAtivo, setFatorAtivo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cadastro, setCadastro] = useState<Cadastro | null>(null)
  const [codigo, setCodigo] = useState('')
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const { mostrarToast } = useToast()

  const carregar = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors()
    setFatorAtivo(data?.totp[0]?.id ?? null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function iniciar() {
    setOcupado(true)
    const supabase = createClient()

    // Remove tentativa anterior que não foi concluída
    const { data: fatores } = await supabase.auth.mfa.listFactors()
    for (const fator of fatores?.all ?? []) {
      if (fator.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: fator.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Sistema Automotivo',
    })
    setOcupado(false)

    if (error || !data) {
      mostrarToast('Não foi possível iniciar a ativação.', 'erro')
      return
    }
    setCadastro({ id: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret })
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!cadastro || ocupado) return

    setOcupado(true)
    const { error } = await createClient().auth.mfa.challengeAndVerify({
      factorId: cadastro.id,
      code: codigo.trim(),
    })
    setOcupado(false)
    setCodigo('')

    if (error) {
      mostrarToast('Código incorreto ou expirado. Tente novamente.', 'erro')
      return
    }

    setCadastro(null)
    mostrarToast('Verificação em duas etapas ativada')
    carregar()
  }

  async function desativar() {
    if (!fatorAtivo) return

    setOcupado(true)
    const { error } = await createClient().auth.mfa.unenroll({ factorId: fatorAtivo })
    setOcupado(false)
    setConfirmandoDesativar(false)

    if (error) {
      mostrarToast('Não foi possível desativar. Saia e entre de novo, depois tente outra vez.', 'erro')
      return
    }
    mostrarToast('Verificação em duas etapas desativada')
    carregar()
  }

  if (carregando) return null

  return (
    <div className="cartao mb-8 space-y-3">
      <h2 className="titulo-secao !mb-0">Verificação em duas etapas</h2>

      {fatorAtivo && !confirmandoDesativar && (
        <>
          <p className="text-sm text-green-300 font-semibold">✓ Ativada: o login pede a senha e o código do aplicativo.</p>
          <button onClick={() => setConfirmandoDesativar(true)} className="botao-secundario text-sm">
            Desativar
          </button>
        </>
      )}

      {fatorAtivo && confirmandoDesativar && (
        <>
          <p className="text-sm">Desativar? Sua conta voltará a depender só da senha.</p>
          <div className="flex gap-2">
            <button onClick={desativar} disabled={ocupado} className="botao-principal flex-1">
              Sim, desativar
            </button>
            <button onClick={() => setConfirmandoDesativar(false)} className="botao-secundario flex-1">
              Cancelar
            </button>
          </div>
        </>
      )}

      {!fatorAtivo && !cadastro && (
        <>
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Protege sua conta mesmo se alguém descobrir a senha. Você vai precisar de um aplicativo
            autenticador no celular, como Google Authenticator ou Microsoft Authenticator.
          </p>
          <button onClick={iniciar} disabled={ocupado} className="botao-principal">
            {ocupado ? 'Preparando...' : 'Ativar'}
          </button>
        </>
      )}

      {cadastro && (
        <form onSubmit={confirmar} className="space-y-3">
          <p className="text-sm text-[var(--cor-texto-suave)]">
            Leia o QR code no aplicativo autenticador e digite o código que aparecer.
          </p>
          <div className="bg-white rounded-[var(--raio)] p-3 w-fit">
            <Image src={cadastro.qrCode} alt="QR code para o aplicativo autenticador" width={180} height={180} unoptimized />
          </div>
          <p className="text-xs text-[var(--cor-texto-suave)] break-all">
            Sem câmera? Digite esta chave no aplicativo: <strong>{cadastro.segredo}</strong>
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
          <div className="flex gap-2">
            <button type="submit" disabled={ocupado} className="botao-principal flex-1">
              Confirmar
            </button>
            <button type="button" onClick={() => setCadastro(null)} className="botao-secundario flex-1">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
