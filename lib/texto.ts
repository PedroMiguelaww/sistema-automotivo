// Normalização de texto usada em buscas e nas chaves do dados_extra.
// "Beneficiário", "Beneficiario" e "BENEFICIARIO" viram todos "beneficiario".

export function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
