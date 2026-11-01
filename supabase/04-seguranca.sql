-- ============================================================================
--  04-seguranca.sql  —  ALTERA PERMISSÕES (substitui as regras do 02)
-- ----------------------------------------------------------------------------
--  O que faz:
--    1. Tranca qualquer tabela exposta, inclusive o backup criado pelo 01.
--    2. Cria os papéis: super_admin, operador, consultor e pendente.
--    3. Toda conta nova nasce "pendente" (sem acesso a nada) até um admin liberar.
--    4. Reescreve as regras de acesso das 5 tabelas.
--    5. O histórico de status passa a ser gravado pelo próprio banco.
--    6. Cria a tabela "auditoria" (rastro de peças, reboques e placas).
--    7. Cria o bucket privado de fotos de peça e limites de tamanho.
--
--  O que cada papel pode fazer:
--    super_admin -> tudo, inclusive liberar contas e apagar placas
--    operador    -> vê e trabalha em todas as placas (atendimento e oficina)
--    consultor   -> vê e trabalha só nas placas dele
--    pendente    -> nada
--
--  Não apaga nenhuma placa, peça, reboque ou histórico.
--  Quem já tem conta continua com o papel atual.
--
--  ORDEM: rode este SQL primeiro e publique o código logo depois. O código
--  atual continua funcionando com ele, com uma exceção: até publicar, salvar a
--  mudança de status mostra um aviso de que o histórico não foi registrado
--  (o histórico é gravado mesmo assim, pelo banco).
--
--  COMO REVERTER: veja o bloco no fim do arquivo.
-- ============================================================================

begin;

-- 1) Tranca tudo que estiver exposto no schema public -------------------------
--    Pega o placas_backup_20261030 e qualquer outra tabela sem RLS.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('revoke all on public.%I from anon, authenticated', r.relname);
    raise notice 'Tabela trancada: %', r.relname;
  end loop;
end $$;

revoke all on public.profiles, public.placas, public.pecas,
              public.reboques, public.status_historico from anon;

-- Tabelas e funções criadas daqui para frente não nascem abertas
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

do $$
begin
  if to_regprocedure('public.chave_normalizada(text)') is not null then
    revoke all on function public.chave_normalizada(text) from public, anon, authenticated;
  end if;
end $$;

-- 2) Papéis -------------------------------------------------------------------
alter table public.profiles alter column role drop default;

-- Se a coluna for de um tipo enum, vira texto para aceitar os papéis novos
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') <> 'text' then
    alter table public.profiles alter column role type text using role::text;
  end if;
end $$;

alter table public.profiles alter column role set default 'pendente';
update public.profiles set role = 'pendente' where role is null;
-- O padrão antigo era 'consultor ' (com espaço no fim): corrige quem nasceu assim
update public.profiles set role = btrim(role) where role <> btrim(role);

alter table public.profiles drop constraint if exists profiles_role_valido;
alter table public.profiles add constraint profiles_role_valido
  check (role in ('super_admin', 'operador', 'consultor', 'pendente')) not valid;

-- 3) Funções de permissão -----------------------------------------------------
--    SECURITY DEFINER = roda ignorando o RLS, o que evita recursão nas policies.
--    Quem ativou as duas etapas e não digitou o código nesta sessão é tratado
--    como pendente: a senha sozinha não abre nada.
create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
           select 1 from auth.mfa_factors f
           where f.user_id = auth.uid() and f.status = 'verified'
         )
         and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
      then 'pendente'
    else coalesce(
      (select p.role::text from public.profiles p where p.id = auth.uid()),
      'pendente'
    )
  end
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_atual() = 'super_admin'
$$;

create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_atual() in ('super_admin', 'operador')
$$;

-- Equipe trabalha em qualquer placa; consultor só nas que são dele
create or replace function public.pode_usar_consultor(p_consultor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_equipe()
      or (public.papel_atual() = 'consultor' and p_consultor = auth.uid())
$$;

create or replace function public.pode_ver_placa(p_placa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.placas
    where id = p_placa and public.pode_usar_consultor(consultor_id)
  )
$$;

-- Usada no Storage: a pasta da foto é o id da placa. Nome inválido só nega,
-- sem gerar erro de conversão.
create or replace function public.pode_ver_pasta_placa(p_pasta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.placas
    where id::text = p_pasta and public.pode_usar_consultor(consultor_id)
  )
$$;

revoke all on function public.papel_atual()                  from public, anon;
revoke all on function public.eh_admin()                     from public, anon;
revoke all on function public.eh_equipe()                    from public, anon;
revoke all on function public.pode_usar_consultor(uuid)      from public, anon;
revoke all on function public.pode_ver_placa(uuid)           from public, anon;
revoke all on function public.pode_ver_pasta_placa(text)     from public, anon;
grant execute on function public.papel_atual()               to authenticated;
grant execute on function public.eh_admin()                  to authenticated;
grant execute on function public.eh_equipe()                 to authenticated;
grant execute on function public.pode_usar_consultor(uuid)   to authenticated;
grant execute on function public.pode_ver_placa(uuid)        to authenticated;
grant execute on function public.pode_ver_pasta_placa(text)  to authenticated;

-- 4) Conta nova sempre nasce pendente -----------------------------------------
--    Vale mesmo que o gatilho antigo leia "role" dos metadados do cadastro, pois
--    roda em cima do INSERT em profiles, venha de onde vier.
create or replace function public.forcar_perfil_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.role := 'pendente';
  return new;
end;
$$;

drop trigger if exists forcar_perfil_pendente on public.profiles;
create trigger forcar_perfil_pendente
  before insert on public.profiles
  for each row execute function public.forcar_perfil_pendente();

-- Substitui a função antiga, que dava "consultor" a toda conta nova. Conta criada
-- pelo painel do Supabase não tem nome nos metadados: usa o início do e-mail.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas antigas sem perfil passam a aparecer na tela de Usuários, sem acesso
insert into public.profiles (id, nome)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nome'), ''), split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 5) Perfil: não troca de id e o sistema nunca fica sem nenhum admin -----------
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'O id do perfil não pode ser alterado';
  end if;

  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and not exists (
       select 1 from public.profiles
       where role = 'super_admin' and id <> old.id
     ) then
    raise exception 'O sistema precisa de pelo menos um super_admin';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil
  before update or delete on public.profiles
  for each row execute function public.proteger_perfil();

-- Função já existente, que protege o administrador principal: continua valendo,
-- só com o search_path fixo, como as demais SECURITY DEFINER
do $$
begin
  if to_regprocedure('public.protect_owner_role()') is not null then
    alter function public.protect_owner_role() set search_path = '';
  end if;
end $$;

-- 6) Remove TODAS as policies atuais das 5 tabelas ----------------------------
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

-- 7) Permissões de tabela: só o que o papel "logado" realmente usa ------------
revoke all on public.profiles, public.placas, public.pecas,
              public.reboques, public.status_historico from authenticated;

grant select, update, delete         on public.profiles         to authenticated;
grant select, insert, update, delete on public.placas           to authenticated;
grant select, insert, update, delete on public.pecas            to authenticated;
grant select, insert, update, delete on public.reboques         to authenticated;
grant select                         on public.status_historico to authenticated;

-- 8) PROFILES -----------------------------------------------------------------
--    Cada um lê o próprio perfil; só a equipe lê a lista de pessoas.
create policy "perfis proprio ou equipe le"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or (select public.eh_equipe()));

create policy "perfis admin gerencia"
  on public.profiles for update
  to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "perfis admin apaga"
  on public.profiles for delete
  to authenticated
  using ((select public.eh_admin()));

-- 9) PLACAS -------------------------------------------------------------------
create policy "placas permitidas le"
  on public.placas for select
  to authenticated
  using (public.pode_usar_consultor(consultor_id));

create policy "placas permitidas cadastra"
  on public.placas for insert
  to authenticated
  with check (public.pode_usar_consultor(consultor_id));

--    O "with check" impede o consultor de passar a placa para outra pessoa.
create policy "placas permitidas atualiza"
  on public.placas for update
  to authenticated
  using (public.pode_usar_consultor(consultor_id))
  with check (public.pode_usar_consultor(consultor_id));

create policy "placas apenas admin apaga"
  on public.placas for delete
  to authenticated
  using ((select public.eh_admin()));

-- 10) PEÇAS -------------------------------------------------------------------
--     O sistema só lê e adiciona peça. Alterar valor ou apagar: apenas o admin.
create policy "pecas permitidas le"
  on public.pecas for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

create policy "pecas permitidas cadastra"
  on public.pecas for insert
  to authenticated
  with check (public.pode_ver_placa(placa_id));

create policy "pecas apenas admin altera"
  on public.pecas for update
  to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "pecas apenas admin apaga"
  on public.pecas for delete
  to authenticated
  using ((select public.eh_admin()));

-- 11) REBOQUES ----------------------------------------------------------------
--     A tela tem botão de apagar, então quem acessa a placa pode apagar. A
--     exclusão fica registrada na tabela auditoria.
create policy "reboques permitidos le"
  on public.reboques for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

create policy "reboques permitidos cadastra"
  on public.reboques for insert
  to authenticated
  with check (public.pode_ver_placa(placa_id));

create policy "reboques apenas admin altera"
  on public.reboques for update
  to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "reboques permitidos apaga"
  on public.reboques for delete
  to authenticated
  using (public.pode_ver_placa(placa_id));

-- 12) STATUS_HISTORICO --------------------------------------------------------
--     Só leitura para todos. Quem grava é o gatilho abaixo.
create policy "historico permitido le"
  on public.status_historico for select
  to authenticated
  using (public.pode_ver_placa(placa_id));

-- Remove gatilho antigo que grave histórico, para não duplicar registro
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.placas'::regclass
      and not t.tgisinternal
      and p.prosrc ilike '%status_historico%'
      and t.tgname <> 'registrar_status'
  loop
    execute format('drop trigger %I on public.placas', r.tgname);
    raise notice 'Gatilho antigo de histórico removido: %', r.tgname;
  end loop;
end $$;

create or replace function public.registrar_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_historico (placa_id, status_anterior, status_novo, atualizado_por)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.status_historico (placa_id, status_anterior, status_novo, atualizado_por)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists registrar_status on public.placas;
create trigger registrar_status
  after insert or update of status on public.placas
  for each row execute function public.registrar_status();

-- 13) Campos da placa que não podem mudar pela API ----------------------------
--     auth.uid() vazio = manutenção feita pelo SQL Editor, que continua liberada.
create or replace function public.proteger_placa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id <> old.id or new.created_at is distinct from old.created_at then
    raise exception 'Este campo da placa não pode ser alterado';
  end if;
  if new.placa <> old.placa and not public.eh_admin() then
    raise exception 'Apenas o administrador pode corrigir a placa';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_placa on public.placas;
create trigger proteger_placa
  before update on public.placas
  for each row execute function public.proteger_placa();

-- 14) AUDITORIA ---------------------------------------------------------------
--     Guarda quem fez o quê e os valores antes e depois. Só o admin lê; ninguém
--     edita nem apaga pela API. A foto não entra no registro para não pesar.
create table if not exists public.auditoria (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  registro_id  text,
  acao         text not null,
  dados_antes  jsonb,
  dados_depois jsonb,
  usuario_id   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists auditoria_created_at_idx on public.auditoria (created_at desc);

alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

drop policy if exists "auditoria admin le" on public.auditoria;
create policy "auditoria admin le"
  on public.auditoria for select
  to authenticated
  using ((select public.eh_admin()));

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'imagem' end;
  depois jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'imagem' end;
begin
  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(depois, antes) ->> 'id', tg_op, antes, depois, auth.uid());
  return null;
end;
$$;

drop trigger if exists auditoria_pecas on public.pecas;
create trigger auditoria_pecas
  after insert or update or delete on public.pecas
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_reboques on public.reboques;
create trigger auditoria_reboques
  after insert or update or delete on public.reboques
  for each row execute function public.registrar_auditoria();

-- Na placa, mudança de status já fica no histórico; aqui entra o resto
drop trigger if exists auditoria_placas_apagar on public.placas;
create trigger auditoria_placas_apagar
  after delete on public.placas
  for each row execute function public.registrar_auditoria();

drop trigger if exists auditoria_placas_alterar on public.placas;
create trigger auditoria_placas_alterar
  after update on public.placas
  for each row
  when (old.consultor_id is distinct from new.consultor_id
        or old.placa is distinct from new.placa
        or old.dados_extra is distinct from new.dados_extra)
  execute function public.registrar_auditoria();

-- 15) Limites de tamanho e formato --------------------------------------------
--     NOT VALID = vale para o que entrar daqui para frente, sem mexer no antigo.
alter table public.placas drop constraint if exists placas_formato_valido;
alter table public.placas add constraint placas_formato_valido
  check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$') not valid;

alter table public.placas drop constraint if exists placas_dados_extra_tamanho;
alter table public.placas add constraint placas_dados_extra_tamanho
  check (dados_extra is null or octet_length(dados_extra::text) <= 65536) not valid;

alter table public.pecas drop constraint if exists pecas_nome_tamanho;
alter table public.pecas add constraint pecas_nome_tamanho
  check (char_length(nome) between 1 and 300) not valid;

alter table public.pecas drop constraint if exists pecas_valor_positivo;
alter table public.pecas add constraint pecas_valor_positivo
  check (valor > 0) not valid;

-- Fotos novas vão para o Storage; aqui só cabe o que o código antigo envia
alter table public.pecas drop constraint if exists pecas_imagem_tamanho;
alter table public.pecas add constraint pecas_imagem_tamanho
  check (imagem is null or octet_length(imagem) <= 7000000) not valid;

alter table public.reboques drop constraint if exists reboques_observacao_tamanho;
alter table public.reboques add constraint reboques_observacao_tamanho
  check (observacao is null or char_length(observacao) <= 500) not valid;

-- 16) Fotos de peça no Storage ------------------------------------------------
alter table public.pecas add column if not exists imagem_path text;

alter table public.pecas drop constraint if exists pecas_imagem_path_tamanho;
alter table public.pecas add constraint pecas_imagem_path_tamanho
  check (imagem_path is null or char_length(imagem_path) <= 200) not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pecas-imagens', 'pecas-imagens', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos pecas permitidas le" on storage.objects;
create policy "fotos pecas permitidas le"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'pecas-imagens'
         and public.pode_ver_pasta_placa((storage.foldername(name))[1]));

drop policy if exists "fotos pecas permitidas envia" on storage.objects;
create policy "fotos pecas permitidas envia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pecas-imagens'
              and public.pode_ver_pasta_placa((storage.foldername(name))[1]));

-- Permite desfazer o envio quando a peça não chega a ser salva. Trocar ou apagar
-- foto antiga fica só com o admin.
drop policy if exists "fotos pecas dono ou admin apaga" on storage.objects;
create policy "fotos pecas dono ou admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pecas-imagens'
         and (owner_id = auth.uid()::text or (select public.eh_admin())));

commit;

-- 17) Conferência -------------------------------------------------------------
select c.relname as tabela,
       c.relrowsecurity as rls_ligado,
       has_table_privilege('anon', c.oid, 'select') as anon_pode_ler
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- ============================================================================
--  DEPOIS DE RODAR
-- ----------------------------------------------------------------------------
--  1. Backup do 01: agora ele está trancado. Se as placas estão certas e você
--     não precisa mais dele, apague (não dá para desfazer):
--
--       drop table public.placas_backup_20261030;
--
--  2. Contas: confira quem existe (não precisa me enviar o resultado):
--
--       select u.email, p.nome, p.role, u.created_at, u.last_sign_in_at
--       from auth.users u left join public.profiles p on p.id = u.id
--       order by u.created_at desc;
--
--     Conta que você não reconhece: apague em Authentication > Users.
--
--  REVERTER (voltar às regras do 02):
--     Rode o 02-rls-politicas.sql inteiro e depois isto:
--
--       drop trigger if exists registrar_status on public.placas;
--       drop trigger if exists proteger_placa on public.placas;
--       drop trigger if exists proteger_perfil on public.profiles;
--       drop trigger if exists forcar_perfil_pendente on public.profiles;
--       grant insert on public.status_historico to authenticated;
--       create or replace function public.handle_new_user()
--       returns trigger language plpgsql security definer as $function$
--       begin
--         insert into public.profiles (id, nome, role)
--         values (new.id, new.raw_user_meta_data->>'nome', 'consultor');
--         return new;
--       end;
--       $function$;
--
--     O papel "operador" não existe no 02: quem estiver nele perde o acesso às
--     placas dos outros. Os dados não são afetados.
-- ============================================================================
