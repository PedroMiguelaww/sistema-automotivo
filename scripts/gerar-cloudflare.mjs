// Gera os arquivos que a Cloudflare Pages lê na pasta "out":
// _headers   -> proteções do navegador (CSP e outras)
// _redirects -> endereços antigos que levam para a tela inicial
// Roda sozinho depois de "npm run build".
import { copyFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
nextEnv.loadEnvConfig(raiz)

const endereco = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!endereco) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL: configure nas variáveis de ambiente da Cloudflare.')
  process.exit(1)
}
const supabase = new URL(endereco).origin

// De onde o navegador pode carregar cada coisa.
// - 'unsafe-inline': o Next precisa dele nas páginas estáticas.
// - 'wasm-unsafe-eval': o OCR roda em WebAssembly.
// - data: nas imagens: é o QR code das duas etapas.
const politica = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabase}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = `/*
  Content-Security-Policy: ${politica}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=31536000
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`

const redirects = `/login / 302
/cadastro / 302
`

const saida = join(raiz, 'out')
writeFileSync(join(saida, '_headers'), headers)
writeFileSync(join(saida, '_redirects'), redirects)

// Build feito no Windows: o Next grava os arquivos de pré-carga das telas em
// subpastas ("__next.!KG1haW4p/placas/__PAGE__.txt"), mas o navegador pede
// "__next.!KG1haW4p.placas.__PAGE__.txt". No Linux, como na Cloudflare, eles já
// saem certos e nada disto acontece.
function arquivosDe(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? arquivosDe(join(pasta, item.name)) : [join(pasta, item.name)]
  )
}

for (const rota of readdirSync(saida, { withFileTypes: true })) {
  if (!rota.isDirectory()) continue
  const pastaRota = join(saida, rota.name)
  for (const item of readdirSync(pastaRota, { withFileTypes: true })) {
    if (!item.isDirectory() || !item.name.startsWith('__next.')) continue
    const pasta = join(pastaRota, item.name)
    for (const arquivo of arquivosDe(pasta)) {
      const nome = `${item.name}.${relative(pasta, arquivo).split(sep).join('.')}`
      copyFileSync(arquivo, join(pastaRota, nome))
    }
    rmSync(pasta, { recursive: true })
  }
}
