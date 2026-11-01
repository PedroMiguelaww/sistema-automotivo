import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// Testa as regras de acesso em um Postgres de verdade, rodando na memória.
// Não acessa o Supabase: as partes do Supabase (auth e storage) são imitadas abaixo.

const db = new PGlite()

const IDS = {
  admin: '00000000-0000-0000-0000-000000000001',
  operador: '00000000-0000-0000-0000-000000000002',
  ana: '00000000-0000-0000-0000-000000000003',
  beto: '00000000-0000-0000-0000-000000000004',
  novo: '00000000-0000-0000-0000-000000000005',
  semPerfil: '00000000-0000-0000-0000-000000000006',
  antigo: '00000000-0000-0000-0000-000000000007',
}
const PLACA_ANA = '10000000-0000-0000-0000-000000000001'
const PLACA_BETO = '10000000-0000-0000-0000-000000000002'

function arquivo(nome: string) {
  return readFileSync(new URL(`../supabase/${nome}`, import.meta.url), 'utf8')
}

async function rodarArquivo(nome: string) {
  await db.exec(arquivo(nome))
}

async function como<T>(
  usuario: string | null,
  acao: () => Promise<T>,
  aal: 'aal1' | 'aal2' = 'aal1'
): Promise<T> {
  const claims = usuario ? JSON.stringify({ sub: usuario, aal, role: 'authenticated' }) : ''
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
  await db.exec(`set role ${usuario ? 'authenticated' : 'anon'}`)
  try {
    return await acao()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims', '', false)`)
  }
}

async function linhas(sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, params)).rows
}

async function falha(acao: () => Promise<unknown>, descricao: string) {
  await assert.rejects(acao, `deveria falhar: ${descricao}`)
}

// 1) Imita o que o Supabase já traz ------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;

  create schema auth;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;

  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb,
    email_confirmed_at timestamptz,
    created_at timestamptz default now(),
    last_sign_in_at timestamptz
  );
  create table auth.mfa_factors (id uuid primary key, user_id uuid, status text);

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select (auth.jwt() ->> 'sub')::uuid
  $$;

  create schema storage;
  grant usage on schema storage to authenticated;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id bigint generated always as identity primary key,
    bucket_id text, name text, owner_id text
  );
  alter table storage.objects enable row level security;
  grant select, insert, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  -- Como o Supabase faz por padrão: tabela nova em public nasce aberta
  alter default privileges in schema public grant all on tables to anon, authenticated;

  create table public.profiles (id uuid primary key, nome text not null, role text default 'consultor ');
  create table public.placas (
    id uuid primary key default gen_random_uuid(),
    placa text unique not null,
    status text not null default 'Aguardando avaliação',
    consultor_id uuid,
    dados_extra jsonb,
    created_at timestamptz default now()
  );
  create table public.pecas (
    id uuid primary key default gen_random_uuid(),
    placa_id uuid references public.placas on delete cascade,
    nome text, valor numeric, imagem text, created_at timestamptz default now()
  );
  create table public.reboques (
    id uuid primary key default gen_random_uuid(),
    placa_id uuid references public.placas on delete cascade,
    data timestamptz, observacao text
  );
  create table public.status_historico (
    id uuid primary key default gen_random_uuid(),
    placa_id uuid references public.placas on delete cascade,
    status_anterior text, status_novo text, atualizado_por uuid,
    created_at timestamptz default now()
  );

  -- Gatilho antigo PERIGOSO: confia no papel enviado no cadastro
  create function public.handle_new_user() returns trigger language plpgsql security definer as $$
  begin
    insert into public.profiles (id, nome, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', 'sem nome'),
            coalesce(new.raw_user_meta_data ->> 'role', 'consultor'));
    return new;
  end $$;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();

  -- Proteção real do banco: o administrador principal não perde o papel
  create function public.protect_owner_role() returns trigger language plpgsql security definer as $$
  begin
    if old.id = '${IDS.admin}' and new.role <> 'super_admin' then
      raise exception 'Não é permitido alterar o papel do administrador principal';
    end if;
    return new;
  end $$;
  create trigger prevent_owner_role_change before update on public.profiles
    for each row execute function public.protect_owner_role();

  -- Gatilho antigo de histórico: precisa ser removido para não duplicar
  create function public.historico_antigo() returns trigger language plpgsql security definer as $$
  begin
    insert into public.status_historico (placa_id, status_novo) values (new.id, new.status);
    return null;
  end $$;
  create trigger historico_antigo after update on public.placas
    for each row execute function public.historico_antigo();

  insert into auth.users (id, email, raw_user_meta_data) values
    ('${IDS.admin}', 'admin@teste', '{"nome":"Admin","role":"super_admin"}'),
    ('${IDS.operador}', 'operador@teste', '{"nome":"Operador"}'),
    ('${IDS.ana}', 'ana@teste', '{"nome":"Ana"}'),
    ('${IDS.beto}', 'beto@teste', '{"nome":"Beto"}'),
    ('${IDS.antigo}', 'conta.antiga@teste', '{}');

  -- Situações reais do banco: conta sem perfil e papel com espaço no fim
  delete from public.profiles where id = '${IDS.antigo}';
  update public.profiles set role = 'consultor ' where id = '${IDS.beto}';

  insert into public.placas (id, placa, consultor_id, dados_extra) values
    ('${PLACA_ANA}', 'ANA1A11', '${IDS.ana}', '{"Beneficiário":"Cliente da Ana"}'),
    ('${PLACA_BETO}', 'BET1B22', '${IDS.beto}', '{"Beneficiário":"Cliente do Beto"}');
`)

// 2) Roda os scripts na ordem real -------------------------------------------
await rodarArquivo('00-auditoria.sql')
await rodarArquivo('01-normalizar-dados-0800.sql')
await rodarArquivo('02-rls-politicas.sql')

// Confirma o problema antes da correção: o backup do 01 fica aberto
const antes = await como(null, () => linhas('select placa from public.placas_backup_20261030'))
assert.equal(antes.length, 2, 'antes do 04, o backup deveria estar exposto')

await rodarArquivo('04-seguranca.sql')
await rodarArquivo('04-seguranca.sql') // rodar duas vezes não pode quebrar nada
await rodarArquivo('03-diagnostico.sql')

const [contaAntiga] = await linhas('select nome, role from public.profiles where id = $1', [IDS.antigo])
assert.deepEqual(contaAntiga, { nome: 'conta.antiga', role: 'pendente' }, 'conta antiga sem perfil fica sem acesso')
const [semEspaco] = await linhas('select role from public.profiles where id = $1', [IDS.beto])
assert.equal(semEspaco.role, 'consultor', 'papel com espaço é corrigido')

// Papéis são definidos pelo admin, como na tela nova
await db.exec(`
  update public.profiles set role = 'super_admin' where id = '${IDS.admin}';
  update public.profiles set role = 'operador' where id = '${IDS.operador}';
  update public.profiles set role = 'consultor' where id in ('${IDS.ana}', '${IDS.beto}');
`)

// 3) Backup e quem não está logado -------------------------------------------
await falha(() => como(null, () => linhas('select * from public.placas_backup_20261030')), 'anon lê backup')
await falha(() => como(IDS.ana, () => linhas('select * from public.placas_backup_20261030')), 'logado lê backup')
await falha(() => como(null, () => linhas('select * from public.placas')), 'anon lê placas')
await falha(() => como(null, () => linhas('select * from public.profiles')), 'anon lê perfis')

// 4) Conta nova: mesmo pedindo admin no cadastro, nasce pendente ---------------
await db.query(
  `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'novo@teste', '{"nome":"Invasor","role":"super_admin"}')`,
  [IDS.novo]
)
const [perfilNovo] = await linhas('select role from public.profiles where id = $1', [IDS.novo])
assert.equal(perfilNovo.role, 'pendente')

await como(IDS.novo, async () => {
  assert.equal((await linhas('select * from public.placas')).length, 0, 'pendente não vê placa')
  assert.equal((await linhas('select * from public.pecas')).length, 0, 'pendente não vê peça')
  const perfis = await linhas('select id from public.profiles')
  assert.deepEqual(perfis.map((p) => p.id), [IDS.novo], 'pendente só vê o próprio perfil')
  await falha(
    () => linhas(`insert into public.placas (placa, consultor_id) values ('NOV1A11', $1)`, [IDS.novo]),
    'pendente cadastra placa'
  )
  await falha(
    () => linhas(`update public.profiles set role = 'super_admin' where id = $1 returning id`, [IDS.novo]).then((r) => {
      if (r.length === 0) throw new Error('bloqueado pelo RLS')
    }),
    'pendente vira admin'
  )
})

// Conta criada pelo painel, sem nome nos metadados, ganha perfil com o início do e-mail
await db.query(`insert into auth.users (id, email) values ($1, 'sem.perfil@teste')`, [IDS.semPerfil])
const [perfilGarantido] = await linhas('select nome, role from public.profiles where id = $1', [IDS.semPerfil])
assert.deepEqual(perfilGarantido, { nome: 'sem.perfil', role: 'pendente' })

// 5) Consultor -----------------------------------------------------------------
await como(IDS.ana, async () => {
  const placas = await linhas('select placa from public.placas')
  assert.deepEqual(placas.map((p) => p.placa), ['ANA1A11'], 'consultor só vê as placas dele')

  const perfis = await linhas('select id from public.profiles')
  assert.deepEqual(perfis.map((p) => p.id), [IDS.ana], 'consultor não lista os colegas')

  await linhas(`insert into public.placas (placa, consultor_id) values ('ANA2A22', $1)`, [IDS.ana])
  await falha(
    () => linhas(`insert into public.placas (placa, consultor_id) values ('ANA3A33', $1)`, [IDS.beto]),
    'consultor cadastra para outro'
  )
  await falha(
    () => linhas(`update public.placas set consultor_id = $1 where id = $2`, [IDS.beto, PLACA_ANA]),
    'consultor transfere placa'
  )
  await falha(
    () => linhas(`update public.placas set placa = 'XXX1X11' where id = $1`, [PLACA_ANA]),
    'consultor troca o número da placa'
  )

  const alterouOutra = await linhas(`update public.placas set status = 'Pintura' where id = $1 returning id`, [PLACA_BETO])
  assert.equal(alterouOutra.length, 0, 'consultor não altera placa de outro')

  // histórico nasce do banco, com o usuário verdadeiro
  await linhas(`update public.placas set status = 'Pintura' where id = $1`, [PLACA_ANA])
  const historico = await linhas(
    `select status_anterior, status_novo, atualizado_por from public.status_historico
     where placa_id = $1 and status_novo = 'Pintura'`,
    [PLACA_ANA]
  )
  assert.deepEqual(historico, [
    { status_anterior: 'Aguardando avaliação', status_novo: 'Pintura', atualizado_por: IDS.ana },
  ])

  await falha(
    () => linhas(
      `insert into public.status_historico (placa_id, status_novo, atualizado_por) values ($1, 'Falso', $2)`,
      [PLACA_ANA, IDS.beto]
    ),
    'consultor forja histórico'
  )
  await falha(() => linhas(`delete from public.status_historico`), 'consultor apaga histórico')

  // peças: adiciona, mas não altera nem apaga
  const [peca] = await linhas(
    `insert into public.pecas (placa_id, nome, valor) values ($1, 'Farol', 100) returning id`,
    [PLACA_ANA]
  )
  const alterouValor = await linhas(`update public.pecas set valor = 1 where id = $1 returning id`, [peca.id])
  assert.equal(alterouValor.length, 0, 'consultor não altera valor de peça')
  const apagouPeca = await linhas(`delete from public.pecas where id = $1 returning id`, [peca.id])
  assert.equal(apagouPeca.length, 0, 'consultor não apaga peça')
  await falha(
    () => linhas(`insert into public.pecas (placa_id, nome, valor) values ($1, 'Intrusa', 1)`, [PLACA_BETO]),
    'consultor adiciona peça em placa de outro'
  )

  // reboque: pode apagar, mas fica rastro
  const [reboque] = await linhas(
    `insert into public.reboques (placa_id, data) values ($1, now()) returning id`,
    [PLACA_ANA]
  )
  const apagouReboque = await linhas(`delete from public.reboques where id = $1 returning id`, [reboque.id])
  assert.equal(apagouReboque.length, 1, 'consultor apaga reboque da própria placa')

  assert.equal((await linhas('select * from public.auditoria')).length, 0, 'consultor não lê auditoria')
  await falha(() => linhas(`delete from public.auditoria`), 'consultor apaga auditoria')

  const apagouPlaca = await linhas(`delete from public.placas where id = $1 returning id`, [PLACA_ANA])
  assert.equal(apagouPlaca.length, 0, 'consultor não apaga placa')
})

const rastro = await linhas(
  `select acao, usuario_id from public.auditoria where tabela = 'reboques' and acao = 'DELETE'`
)
assert.deepEqual(rastro, [{ acao: 'DELETE', usuario_id: IDS.ana }], 'exclusão de reboque deixa rastro')

// 6) Operador -------------------------------------------------------------------
await como(IDS.operador, async () => {
  const placas = await linhas('select placa from public.placas')
  assert.ok(placas.length >= 3, 'operador vê todas as placas')
  assert.ok((await linhas('select id from public.profiles')).length >= 5, 'operador lista as pessoas')

  await linhas(`insert into public.placas (placa, consultor_id) values ('OPE1A11', $1)`, [IDS.ana])
  await linhas(`update public.placas set status = 'Consertando' where id = $1`, [PLACA_BETO])

  const virouAdmin = await linhas(`update public.profiles set role = 'super_admin' where id = $1 returning id`, [IDS.operador])
  assert.equal(virouAdmin.length, 0, 'operador não muda papel')
  const apagou = await linhas(`delete from public.placas where id = $1 returning id`, [PLACA_BETO])
  assert.equal(apagou.length, 0, 'operador não apaga placa')
  assert.equal((await linhas('select * from public.auditoria')).length, 0, 'operador não lê auditoria')
})

// 7) Admin ----------------------------------------------------------------------
await como(IDS.admin, async () => {
  const liberou = await linhas(`update public.profiles set role = 'consultor' where id = $1 returning id`, [IDS.novo])
  assert.equal(liberou.length, 1, 'admin libera conta')
  await linhas(`update public.profiles set role = 'pendente' where id = $1`, [IDS.novo])

  await falha(
    () => linhas(`update public.profiles set role = 'chefe' where id = $1`, [IDS.novo]),
    'papel inexistente'
  )
  await falha(
    () => linhas(`update public.profiles set role = 'consultor' where id = $1`, [IDS.admin]),
    'tirar o último admin'
  )
  await falha(() => linhas(`delete from public.profiles where id = $1`, [IDS.admin]), 'apagar o último admin')

  assert.ok((await linhas('select * from public.auditoria')).length > 0, 'admin lê auditoria')
  await falha(() => linhas(`delete from public.auditoria`), 'nem o admin apaga auditoria')
})

// 8) Duas etapas: com o fator ativo, a senha sozinha não abre nada ---------------
await db.query(`insert into auth.mfa_factors values (gen_random_uuid(), $1, 'verified')`, [IDS.admin])
await como(IDS.admin, async () => {
  assert.equal((await linhas('select * from public.placas')).length, 0, 'admin sem o código não vê nada')
})
await como(
  IDS.admin,
  async () => {
    assert.ok((await linhas('select * from public.placas')).length > 0, 'admin com o código vê tudo')
  },
  'aal2'
)

// Fator que nunca foi confirmado não trava a conta
await db.query(`insert into auth.mfa_factors values (gen_random_uuid(), $1, 'unverified')`, [IDS.ana])
await como(IDS.ana, async () => {
  assert.equal((await linhas('select * from public.placas')).length > 0, true, 'fator não confirmado não bloqueia')
})

// 9) Limites --------------------------------------------------------------------
await como(IDS.ana, async () => {
  await falha(
    () => linhas(`insert into public.placas (placa, consultor_id) values ('inválida', $1)`, [IDS.ana]),
    'placa fora do formato'
  )
  await falha(
    () => linhas(`insert into public.pecas (placa_id, nome, valor) values ($1, 'Grátis', 0)`, [PLACA_ANA]),
    'peça com valor zero'
  )
  await falha(
    () => linhas(`insert into public.pecas (placa_id, nome, valor, imagem) values ($1, 'Foto', 1, repeat('x', 7000001))`, [PLACA_ANA]),
    'foto gigante no banco'
  )
})

// 10) Fotos no Storage ------------------------------------------------------------
const [bucket] = await linhas(`select public from storage.buckets where id = 'pecas-imagens'`)
assert.equal(bucket.public, false, 'bucket de fotos precisa ser privado')

await como(IDS.ana, async () => {
  await linhas(
    `insert into storage.objects (bucket_id, name, owner_id) values ('pecas-imagens', $1, $2)`,
    [`${PLACA_ANA}/foto.jpg`, IDS.ana]
  )
  await falha(
    () => linhas(
      `insert into storage.objects (bucket_id, name, owner_id) values ('pecas-imagens', $1, $2)`,
      [`${PLACA_BETO}/foto.jpg`, IDS.ana]
    ),
    'foto em placa de outro'
  )
  await falha(
    () => linhas(
      `insert into storage.objects (bucket_id, name, owner_id) values ('pecas-imagens', 'nao-e-uuid/foto.jpg', $1)`,
      [IDS.ana]
    ),
    'pasta inválida'
  )
  assert.equal((await linhas('select * from storage.objects')).length, 1)
})
await como(IDS.beto, async () => {
  assert.equal((await linhas('select * from storage.objects')).length, 0, 'outro consultor não vê a foto')
})

await db.close()
console.log('OK — todas as regras de acesso passaram')
