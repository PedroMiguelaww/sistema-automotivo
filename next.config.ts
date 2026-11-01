import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Raiz fixa do projeto. Sem isso o Turbopack sobe até C:\Users\Dell, encontra
// um package-lock.json solto fora do projeto e usa a pasta errada como raiz
// (o build avisa "Turbopack root should be ...").
const raiz = dirname(fileURLToPath(import.meta.url))

const emDesenvolvimento = process.env.NODE_ENV === 'development'
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : ''

// De onde o navegador pode carregar cada coisa.
// - 'unsafe-inline': o Next precisa dele nas páginas estáticas (alternativa é
//   usar nonce, que obriga toda página a ser gerada no servidor).
// - 'wasm-unsafe-eval': o OCR roda em WebAssembly.
// - data: nas imagens: é o QR code das duas etapas.
const politica = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${emDesenvolvimento ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabase}${emDesenvolvimento ? ' ws://localhost:*' : ''}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: raiz },
  async redirects() {
    return [
      // As telas antigas de cadastro e login agora são todas a tela inicial
      { source: '/login', destination: '/', permanent: false },
      { source: '/cadastro', destination: '/', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: politica },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // impede que o sistema seja embutido em iframe de outro site
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          // a foto usa o seletor de arquivos, que não depende destas permissões
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
