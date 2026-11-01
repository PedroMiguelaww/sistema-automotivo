// Fotos de peça, guardadas no bucket privado do Storage (ver 04-seguranca.sql).
// Os mesmos limites valem no bucket: aqui é só para avisar antes de enviar.

export const BUCKET_FOTOS = 'pecas-imagens'
export const TAMANHO_MAX_FOTO = 5 * 1024 * 1024

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export function problemaNaFoto(arquivo: { type: string; size: number }) {
  if (!EXTENSOES[arquivo.type]) return 'Formato de imagem não aceito. Use JPG, PNG ou WEBP.'
  if (arquivo.size > TAMANHO_MAX_FOTO) return 'Imagem muito grande (máx. 5MB)'
  return null
}

// A primeira pasta é o id da placa: é nela que a permissão do Storage se baseia
export function caminhoDaFoto(placaId: string, tipo: string) {
  return `${placaId}/${crypto.randomUUID()}.${EXTENSOES[tipo]}`
}
