// Limites dos planos (quando você souber, troque null pelo número).
// Se preenchido, a tela de Reboque mostra "N de L" e avisa quando passar.
export const LIMITE_MENSAL: number | null = null
export const LIMITE_ANUAL: number | null = null

export const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

// "2026-10-15" -> data ao meio-dia (evita virar o dia por causa de fuso horário)
export function dataDoCampo(texto: string) {
  return new Date(`${texto}T12:00:00`)
}

export function hojeParaCampo() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
