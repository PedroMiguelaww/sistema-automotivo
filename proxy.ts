import { NextResponse, type NextRequest } from 'next/server'

// Porteiro das rotas internas: se não existe cookie de sessão do Supabase,
// manda para a tela de login em vez de abrir a tela vazia.
//
// IMPORTANTE: isso é conforto de navegação, NÃO é a proteção dos dados.
// A proteção real é o RLS (Row Level Security) no Postgres — mesmo que alguém
// contorne este proxy, a API do Supabase continua bloqueando.
// A checagem é só de presença de cookie (sem chamada de rede) para o app não
// travar caso o Supabase fique fora do ar.
//
// No Next.js 16 este arquivo se chama proxy.ts (o antigo middleware.ts).

const ROTAS_PROTEGIDAS = ['/placas', '/pecas', '/mecanica', '/reboque', '/perfil']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!ROTAS_PROTEGIDAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return NextResponse.next()
  }

  const temSessao = request.cookies.getAll().some((cookie) => cookie.name.includes('-auth-token'))
  if (temSessao) return NextResponse.next()

  const login = request.nextUrl.clone()
  login.pathname = '/'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/placas/:path*', '/pecas/:path*', '/mecanica/:path*', '/reboque/:path*', '/perfil/:path*'],
}
