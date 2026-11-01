-- ============================================================================
--  03-diagnostico.sql  —  SOMENTE LEITURA
-- ----------------------------------------------------------------------------
--  Mostra, em um único resultado, o que precisa ser conferido na segurança.
--  Não altera nada e não traz dados de clientes. Pode rodar quantas vezes
--  quiser: antes do 04 (para saber o estado atual) e depois (para conferir).
--
--  Copie TUDO, cole no Supabase > SQL Editor e clique em "Run".
-- ============================================================================

with tabelas as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
)
-- 1) Tabelas sem RLS, ou que quem não está logado consegue ler
select 1 as ordem,
       'tabela' as item,
       relname::text as nome,
       'rls_ligado=' || relrowsecurity
         || ' | anon_pode_ler=' || has_table_privilege('anon', oid, 'select')
         || ' | logado_pode_ler=' || has_table_privilege('authenticated', oid, 'select') as detalhe
from tabelas

union all
-- 2) Regras de acesso em vigor
select 2, 'policy', tablename || ' / ' || policyname,
       cmd || ' | using: ' || coalesce(qual, '-') || ' | check: ' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public'

union all
-- 3) Gatilhos nas tabelas do sistema
select 3, 'gatilho', c.relname || ' / ' || t.tgname,
       'funcao: ' || p.proname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgrelid in (
    'public.profiles'::regclass, 'public.placas'::regclass, 'public.pecas'::regclass,
    'public.reboques'::regclass, 'public.status_historico'::regclass
  )

union all
-- 4) Gatilho que cria o perfil quando nasce uma conta (o texto completo importa:
--    se ele ler "role" dos metadados, qualquer um pode se criar como admin)
select 4, 'gatilho auth.users', t.tgname, pg_get_functiondef(p.oid)
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal

union all
-- 5) Tipo e valor padrão da coluna role
select 5, 'coluna role', data_type || ' / ' || udt_name, 'padrao: ' || coalesce(column_default, '(nenhum)')
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'

union all
-- 6) Quantas contas existem por papel (sem listar ninguém)
select 6, 'papel', coalesce(role::text, '(vazio)'), count(*)::text || ' conta(s)'
from public.profiles
group by role

union all
-- 7) Contas sem perfil e contas com e-mail nunca confirmado
select 7, 'contas', 'sem perfil em profiles',
       (select count(*)::text from auth.users u
         where not exists (select 1 from public.profiles p where p.id = u.id))
union all
select 7, 'contas', 'e-mail nao confirmado',
       (select count(*)::text from auth.users where email_confirmed_at is null)

union all
-- 8) Peso das fotos guardadas dentro do banco
select 8, 'fotos', 'pecas com imagem em base64',
       (select count(*)::text || ' foto(s), '
               || pg_size_pretty(coalesce(sum(octet_length(imagem)), 0)::bigint)
        from public.pecas where imagem is not null)

order by ordem, nome;
