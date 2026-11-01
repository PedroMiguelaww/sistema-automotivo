import { createClient } from '@/lib/supabase'

type Supabase = ReturnType<typeof createClient>

// Verdadeiro quando a pessoa tem as duas etapas ativas e ainda não digitou o
// código nesta sessão. O banco trata essa sessão como sem acesso (ver 04-seguranca.sql).
export async function precisaDoCodigo(supabase: Supabase) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2'
}
