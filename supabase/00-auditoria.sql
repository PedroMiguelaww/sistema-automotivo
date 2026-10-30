-- ============================================================================
--  00-auditoria.sql  —  SOMENTE LEITURA
-- ----------------------------------------------------------------------------
--  Rode este arquivo no Supabase > SQL Editor.
--  Ele NÃO altera nada: só mostra o estado atual do banco.
--
--  COMO RODAR:
--    1. Supabase > SQL Editor > New query.
--    2. Abra o arquivo, copie TUDO (Ctrl+A, Ctrl+C) e cole ali.
--    3. Clique em "Run" (ou Ctrl+Enter).
--
--    ATENÇÃO: este arquivo tem várias consultas e o Supabase mostra o
--    resultado apenas da ÚLTIMA. Para guardar a auditoria inteira, rode
--    UM BLOCO POR VEZ: selecione o bloco com o mouse e aperte Ctrl+Enter.
--    Cada bloco começa com um comentário numerado (-- 1), -- 2) ...).
--
--  Para que serve:
--    1. Saber quais tabelas existem e se o RLS está ligado em cada uma.
--    2. Ver TODAS as policies (as regras de acesso) que estão valendo hoje.
--    3. Conferir as colunas reais (para comparar com o README).
--    4. Achar registros de placas com chave do 0800 fora do padrão.
--    5. Ver quem (anon/authenticated) tem permissão de tabela.
--
--  IMPORTANTE: rode este antes do 02-rls-politicas.sql e guarde o resultado
--  (copie e cole num arquivo). O 02 substitui as policies das 5 tabelas.
-- ============================================================================

-- 1) Tabelas do schema public e se o RLS está ligado ------------------------
select
  c.relname                              as tabela,
  c.relrowsecurity                       as rls_ligado,
  c.relforcerowsecurity                  as rls_forcado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'                    -- tabelas comuns
order by c.relname;

-- 2) Policies existentes (a regra de acesso real) ---------------------------
select
  tablename     as tabela,
  policyname    as policy,
  cmd           as operacao,             -- SELECT / INSERT / UPDATE / DELETE / ALL
  roles         as papeis,
  qual          as condicao_using,
  with_check    as condicao_with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3) Existe alguma policy permissiva demais? --------------------------------
--    (policy de SELECT liberada para qualquer um = dado exposto)
select
  tablename,
  policyname,
  cmd,
  roles::text
from pg_policies
where schemaname = 'public'
  and cmd in ('SELECT', 'ALL')
  and (roles @> array['anon']::name[] or qual is null or qual = 'true')
order by tablename, policyname;

-- 4) Colunas reais das 5 tabelas do sistema ---------------------------------
select
  table_name    as tabela,
  ordinal_position as pos,
  column_name   as coluna,
  data_type     as tipo,
  is_nullable   as nulo_permitido,
  column_default as padrao
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'placas', 'pecas', 'reboques', 'status_historico')
order by table_name, ordinal_position;

-- 5) Permissões de tabela para os papéis públicos ---------------------------
select
  table_name as tabela,
  grantee    as papel,
  string_agg(privilege_type, ', ' order by privilege_type) as permissoes
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 6) Volume de dados --------------------------------------------------------
select 'profiles' as tabela, count(*) from public.profiles
union all select 'placas', count(*) from public.placas
union all select 'pecas', count(*) from public.pecas
union all select 'reboques', count(*) from public.reboques
union all select 'status_historico', count(*) from public.status_historico;

-- 7) Papéis cadastrados (só deve existir consultor e super_admin) -----------
select role, count(*) as quantidade
from public.profiles
group by role
order by quantidade desc;

-- 8) Chaves usadas no dados_extra (mostra se ainda tem chave com acento) ----
select
  k as chave,
  count(*) as registros
from public.placas p,
     lateral jsonb_each_text(p.dados_extra) as e(k, v)
group by k
order by registros desc;

-- 9) Quantos registros ainda estão fora do padrão ---------------------------
--    (chave diferente da versão sem acento/minúscula)
select count(*) as placas_com_chave_fora_do_padrao
from public.placas p
where p.dados_extra is not null
  and exists (
    select 1
    from jsonb_each_text(p.dados_extra) as e(k, v)
    where k <> btrim(regexp_replace(
      lower(translate(k,
        'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'AAAAAAEEEEIIIIOOOOOUUUUCN')),
      '\s+', ' ', 'g'))
  );

-- 10) Reboques: total e últimos 30 dias (para conferir com o que a tela mostra)
select
  count(*)                                               as total,
  count(*) filter (where data >= now() - interval '30 days') as ultimos_30_dias,
  count(*) filter (where placa_id is null)               as sem_placa
from public.reboques;
