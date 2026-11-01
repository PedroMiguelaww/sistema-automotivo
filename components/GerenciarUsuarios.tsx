'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type Usuario = {
  id: string
  nome: string
  role: string
}

const PAPEIS = [
  { valor: 'pendente', rotulo: 'Sem acesso' },
  { valor: 'consultor', rotulo: 'Consultor (só as placas dele)' },
  { valor: 'operador', rotulo: 'Operador (todas as placas)' },
  { valor: 'super_admin', rotulo: 'Administrador' },
]

// Tela do administrador para liberar contas e definir o papel de cada pessoa.
export default function GerenciarUsuarios({ meuId }: { meuId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const { mostrarToast } = useToast()

  useEffect(() => {
    createClient()
      .from('profiles')
      .select('id, nome, role')
      .order('nome')
      .then(({ data, error }) => {
        if (error) mostrarToast('Não foi possível carregar os usuários.', 'erro')
        if (data) setUsuarios(data)
      })
  }, [mostrarToast])

  async function mudarPapel(usuario: Usuario, role: string) {
    setSalvandoId(usuario.id)
    const { data, error } = await createClient()
      .from('profiles')
      .update({ role })
      .eq('id', usuario.id)
      .select('id')
    setSalvandoId(null)

    if (error || !data?.length) {
      mostrarToast('Não foi possível alterar o acesso.', 'erro')
      return
    }

    setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, role } : u)))
    mostrarToast(`Acesso de ${usuario.nome} atualizado`)
  }

  const pendentes = usuarios.filter((u) => u.role === 'pendente').length

  return (
    <div className="mb-8">
      <h2 className="fonte-titulo text-lg font-bold mb-1">Usuários</h2>
      <p className="text-sm text-[var(--cor-texto-suave)] mb-3">
        {pendentes > 0
          ? `${pendentes} conta(s) aguardando liberação. Só libere quem você reconhece.`
          : 'Defina o que cada pessoa pode acessar.'}
      </p>
      <div className="space-y-2">
        {usuarios.map((u) => (
          <div key={u.id} className="cartao flex flex-col sm:flex-row sm:items-center justify-between gap-2 !py-3">
            <span className="text-sm font-medium min-w-0 truncate">
              {u.nome}
              {u.id === meuId && <span className="font-normal text-[var(--cor-texto-suave)]"> (você)</span>}
            </span>
            <select
              value={u.role}
              onChange={(e) => mudarPapel(u, e.target.value)}
              disabled={u.id === meuId || salvandoId === u.id}
              className="campo-input sm:!w-auto text-sm"
              aria-label={`Acesso de ${u.nome}`}
            >
              {PAPEIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
