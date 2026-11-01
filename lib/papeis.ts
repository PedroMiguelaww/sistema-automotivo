// Papéis do sistema e como aparecem na tela (ver supabase/04-seguranca.sql).
export const PAPEIS = [
  { valor: 'pendente', rotulo: 'Sem acesso', descricao: 'Sem acesso' },
  { valor: 'consultor', rotulo: 'Consultor', descricao: 'Consultor (só as placas dele)' },
  { valor: 'operador', rotulo: 'Operador', descricao: 'Operador (todas as placas)' },
  { valor: 'super_admin', rotulo: 'Administrador', descricao: 'Administrador' },
]

export function nomeDoPapel(role: string) {
  return PAPEIS.find((p) => p.valor === role)?.rotulo ?? role
}
