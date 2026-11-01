'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { IconeSetaBaixo, IconeSetaCima } from '@/components/Icones'
import { PAPEIS } from '@/lib/papeis'

type Usuario = {
  id: string
  nome: string
  role: string
}

// Tela do administrador para liberar contas e definir o papel de cada pessoa.
// Começa minimizada: ao abrir o perfil só é feita a contagem de contas pendentes,
// e a lista é buscada quando alguém maximiza. Ao minimizar, ela sai da memória.
export default function GerenciarUsuarios({ meuId }: { meuId: string }) {
  const [aberto, setAberto] = useState(false)
  const [pendentes, setPendentes] = useState(0)
  const { mostrarToast } = useToast()

  useEffect(() => {
    createClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'pendente')
      .then(({ count }) => setPendentes(count ?? 0))
  }, [])

  return (
    <section className="cartao mb-6">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer min-h-12"
      >
        <span className="min-w-0">
          <span className="block titulo-secao !mb-0">Usuários</span>
          <span className={`block text-sm ${pendentes > 0 ? 'text-amber-300 font-semibold' : 'text-[var(--cor-texto-suave)]'}`}>
            {pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? 'conta aguardando' : 'contas aguardando'} liberação`
              : 'Defina o que cada pessoa pode acessar'}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0 text-sm font-semibold text-[var(--cor-primaria-clara)]">
          {aberto ? 'Minimizar' : 'Mostrar'}
          {aberto ? <IconeSetaCima /> : <IconeSetaBaixo />}
        </span>
      </button>

      {aberto && (
        <ListaUsuarios meuId={meuId} mostrarToast={mostrarToast} onMudarPendentes={setPendentes} />
      )}
    </section>
  )
}

function ListaUsuarios({
  meuId,
  mostrarToast,
  onMudarPendentes,
}: {
  meuId: string
  mostrarToast: ReturnType<typeof useToast>['mostrarToast']
  onMudarPendentes: (quantidade: number) => void
}) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  useEffect(() => {
    createClient()
      .from('profiles')
      .select('id, nome, role')
      .order('nome')
      .then(({ data, error }) => {
        if (error) mostrarToast('Não foi possível carregar os usuários.', 'erro')
        setUsuarios(data ?? [])
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

    const atualizados = (usuarios ?? []).map((u) => (u.id === usuario.id ? { ...u, role } : u))
    setUsuarios(atualizados)
    onMudarPendentes(atualizados.filter((u) => u.role === 'pendente').length)
    mostrarToast(`Acesso de ${usuario.nome} atualizado`)
  }

  if (!usuarios) {
    return <div className="esqueleto h-16 w-full mt-4" />
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--cor-borda)] space-y-3">
      <p className="text-sm text-[var(--cor-texto-suave)]">Só libere as contas de quem você reconhece.</p>
      {usuarios.map((u) => (
        <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="font-semibold min-w-0 truncate">
            {u.nome}
            {u.id === meuId && <span className="font-normal text-[var(--cor-texto-suave)]"> (você)</span>}
          </span>
          <select
            value={u.role}
            onChange={(e) => mudarPapel(u, e.target.value)}
            disabled={u.id === meuId || salvandoId === u.id}
            className="campo-input sm:!w-auto disabled:opacity-60"
            aria-label={`Acesso de ${u.nome}`}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.descricao}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
