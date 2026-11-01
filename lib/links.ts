// Sites de mapa conhecidos. O link da mensagem do 0800 vem de fora do sistema,
// então link de outro site é mostrado com o endereço, para a pessoa ver onde vai cair.
const SITES_DE_MAPA = [
  'google.com',
  'google.com.br',
  'maps.app.goo.gl',
  'goo.gl',
  'waze.com',
  'maps.apple.com',
  'openstreetmap.org',
]

export function lerLinkExterno(texto?: string) {
  let url: URL
  try {
    url = new URL((texto || '').trim())
  } catch {
    return null
  }

  // "https://google.com@site-falso.com" esconde o destino real
  if (url.protocol !== 'https:' || url.username || url.password) return null

  const site = url.hostname.toLowerCase()
  const conhecido = SITES_DE_MAPA.some((s) => site === s || site.endsWith(`.${s}`))
  return { url: url.href, site, conhecido }
}
