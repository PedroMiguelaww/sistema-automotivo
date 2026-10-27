// Etapas do atendimento, na ordem em que aparecem.
// Para criar, tirar ou reordenar etapas, é só mexer nesta lista (e nas cores abaixo).
export const STATUS_LISTA: string[] = [
  'Aguardando avaliação',
  'Procurando peça',
  'Consertando',
  'Lanternagem',
  'Pintura',
  'Enchimento de roda',
  'Finalizado',
]

export const STATUS_FINAL = 'Finalizado'

export const STATUS_COR: Record<string, string> = {
  'Aguardando avaliação': 'bg-white/10 text-gray-300',
  'Procurando peça': 'bg-amber-500/15 text-amber-400',
  'Consertando': 'bg-violet-500/15 text-violet-400',
  'Lanternagem': 'bg-orange-500/15 text-orange-400',
  'Pintura': 'bg-pink-500/15 text-pink-400',
  'Enchimento de roda': 'bg-cyan-500/15 text-cyan-400',
  'Finalizado': 'bg-green-500/15 text-green-400',
}

export function corDoStatus(status: string) {
  return STATUS_COR[status] || 'bg-white/10 text-gray-300'
}
