import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Raiz fixa do projeto. Sem isso o Turbopack sobe até C:\Users\Dell, encontra
// um package-lock.json solto fora do projeto e usa a pasta errada como raiz
// (o build avisa "Turbopack root should be ...").
const raiz = dirname(fileURLToPath(import.meta.url))

// O sistema é publicado como site estático (pasta "out") na Cloudflare Pages:
// todas as telas rodam no navegador e falam direto com o Supabase.
// Proteções do navegador e redirecionamentos ficam em _headers e _redirects,
// gerados por scripts/gerar-cloudflare.mjs depois do build.
const nextConfig: NextConfig = {
  output: 'export',
  poweredByHeader: false,
  turbopack: { root: raiz },
  // site estático não tem servidor para otimizar imagens
  images: { unoptimized: true },
}

export default nextConfig
