// 1500.5 -> "R$ 1.500,50"
export function formatarReais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
