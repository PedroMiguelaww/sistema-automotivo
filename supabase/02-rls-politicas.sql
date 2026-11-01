-- ============================================================================
--  02-rls-politicas.sql  —  SUBSTITUÍDO PELO 04-seguranca.sql
-- ----------------------------------------------------------------------------
--  Não rode de novo, a não ser para reverter o 04: ele apaga as regras atuais.
-- ----------------------------------------------------------------------------
--  Problema que este arquivo resolve:
--    Hoje qualquer pessoa logada abre qualquer placa de qualquer consultor.
--    O filtro "minhas placas" existe só na tela de perfil; no banco não tem
--    regra. Este script coloca a regra no banco (RLS), que é o que protege de
--    verdade — mesmo que alguém chame a API do Supabase direto.
--
--  Regra que será aplicada:
--    consultor  -> vê e mexe apenas nas placas onde consultor_id = seu id
--    super_admin-> vê e mexe em tudo
--    perfis     -> qualquer pessoa logada pode LER a lista (nome/role), porque
--                  os selects de consultor do sistema dependem disso
--    histórico  -> só leitura e inserção; não pode ser editado nem apagado
--
--  ATENÇÃO:
--    Este script APAGA todas as policies atuais das 5 tabelas e cria as novas.
--    1. Rode 00-auditoria.sql primeiro e guarde o resultado (é o seu backup
--       das regras atuais).
--    2. Rode em horário de pouco uso.
--    3. Depois de rodar, entre com um usuário consultor e confira que ele só
--       vê as placas dele, e com um super_admin que ele vê tudo.
--    4. Se algo der errado, use a seção "REVERTER" no fim do arquivo.
-- ============================================================================

begin;

-- 1) Liga o RLS em todas as tabelas -----------------------------------------
alter table public.profiles         enable row level security;
alter table public.placas           enable row level security;
alter table public.pecas            enable row level security;
alter table public.reboques         enable row level security;
alter table public.status_historico enable row level security;

-- 2) Quem não está logado não acessa nada -----------------------------------
revoke all on public.profiles, public.placas, public.pecas,
              public.reboques, public.status_historico from anon;

grant select, insert, update, delete
  on public.profiles, public.placas, public.pecas,
     public.reboques, public.status_historico
  to authenticated;

-- 3) Funções auxiliares -----------------------------------------------------
--    SECURITY DEFINER = roda ignorando o RLS, o que evita loop infinito
--    (uma policy de profiles que consulta profiles entraria em recursão).
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
$$;

create or replace function public.pode_ver_placa(p_placa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.placas
    where id = p_placa
      and (consultor_id = auth.uid() or public.eh_admin())
  )
$$;

revoke all on function public.eh_admin()                from public, anon;
revoke all on function public.pode_ver_placa(uuid)     from public, anon;
grant execute on function public.eh_admin()             to authenticated;
grant execute on function public.pode_ver_placa(uuid)  to authenticated;

-- 4) Remove TODAS as policies atuais das 5 tabelas --------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'placas', 'pecas', 'reboques', 'status_historico')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 5) PROFILES ---------------------------------------------------------------
--    Leitura liberada para quem está logado (o sistema lista consultores).
--    Escrita apenas pelo super_admin.
create policy "perfis leitura autenticada"
  on public.profiles for select
  to authenticated
  using (true);

create policy "perfis admin gerencia"
  on public.profiles for update
  to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy "perfis admin apaga"
  on public.profiles for delete
  to authenticated
  using (public.eh_admin());

-- 6) PLACAS -----------------------------------------------------------------
create policy "placas dono ou admin le"
  on public.placas for select
  to authenticated
  using (consultor_id = auth.uid() or public.eh_admin());

create policy "placas dono ou admin cadastra"
  on public.placas for insert
  to authenticated
  with check (consultor_id = auth.uid() or public.eh_admin());

--    "with check" impede o consultor de passar a placa para outro consultor
--    pela API; o admin pode transferir.
create policy "placas dono ou admin atualiza"
  on public.placas for update
  to authenticated
  using (consultor_id = auth.uid() or public.eh_admin())
  with check (consultor_id = auth.uid() or public.eh_admin());

create policy "placas apenas admin apaga"
  on public.placas for delete
  to authenticated
  using (public.eh_admin());

-- 7) PEÇAS ------------------------------------------------------------------
create policy "pecas dono ou admin le"
  on public.pecas for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

create policy "pecas dono ou admin cadastra"
  on public.pecas for insert
  to authenticated
  with check (public.pode_ver_placa(placa_id));

create policy "pecas dono ou admin atualiza"
  on public.pecas for update
  to authenticated
  using (public.pode_ver_placa(placa_id))
  with check (public.pode_ver_placa(placa_id));

create policy "pecas dono ou admin apaga"
  on public.pecas for delete
  to authenticated
  using (public.pode_ver_placa(placa_id));

-- 8) REBOQUES ---------------------------------------------------------------
create policy "reboques dono ou admin le"
  on public.reboques for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

create policy "reboques dono ou admin cadastra"
  on public.reboques for insert
  to authenticated
  with check (public.pode_ver_placa(placa_id));

create policy "reboques dono ou admin atualiza"
  on public.reboques for update
  to authenticated
  using (public.pode_ver_placa(placa_id))
  with check (public.pode_ver_placa(placa_id));

--    O app tem botão de apagar reboque; por isso o dono pode apagar.
--    (Ideal futuro: soft delete com "quem apagou" — ver README.)
create policy "reboques dono ou admin apaga"
  on public.reboques for delete
  to authenticated
  using (public.pode_ver_placa(placa_id));

-- 9) STATUS_HISTORICO -------------------------------------------------------
--    Histórico é registro de auditoria: só entra e só lê. Não edita, não apaga.
create policy "historico dono ou admin le"
  on public.status_historico for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

create policy "historico dono ou admin registra"
  on public.status_historico for insert
  to authenticated
  with check (public.pode_ver_placa(placa_id));

commit;

-- 10) Conferência: deve listar as policies criadas acima --------------------
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ============================================================================
--  REVERTER (só se precisar voltar ao estado anterior)
-- ----------------------------------------------------------------------------
--  Não existe "desfazer" automático de policies; para voltar ao estado antigo
--  use o resultado do 00-auditoria.sql, que tem o nome e a condição de cada
--  policy que existia. Se quiser apenas liberar tudo de novo (NÃO recomendado
--  em produção), descomente o bloco abaixo:
--
--  do $$
--  declare r record;
--  begin
--    for r in select schemaname, tablename, policyname from pg_policies
--             where schemaname = 'public'
--               and tablename in ('profiles','placas','pecas','reboques','status_historico')
--    loop
--      execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
--    end loop;
--  end $$;
--
--  create policy "liberado" on public.placas for all to authenticated using (true) with check (true);
--  -- repita para as outras tabelas apenas se for ambiente de teste.
-- ============================================================================
