import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Raiz fixa do projeto. Sem isso o Turbopack sobe até C:\Users\Dell, encontra
// um package-lock.json solto fora do projeto e usa a pasta errada como raiz
// (o build avisa "Turbopack root should be ...").
const raiz = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: raiz },
  async headers() {
    return [
      {
        // Cabeçalhos básicos de segurança. Não inclui CSP porque o app usa
        // worker/wasm do Tesseract e o Supabase; CSP precisa ser testada antes.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // impede que o sistema seja embutido em iframe de outro site
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
