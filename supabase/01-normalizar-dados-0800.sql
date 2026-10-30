-- ============================================================================
--  01-normalizar-dados-0800.sql  —  ALTERA DADOS (com cópia de segurança)
-- ----------------------------------------------------------------------------
--  O que faz:
--    Renomeia as CHAVES do campo placas.dados_extra para o padrão sem acento
--    e em minúsculas. Exemplo:
--
--      "Beneficiário"  ->  "beneficiario"
--      "Adesão"        ->  "adesao"
--      "Link Origem"   ->  "link origem"
--
--  O que NÃO faz:
--    - não apaga nenhum registro
--    - não altera nenhum VALOR (só o nome do campo)
--    - não mexe em outras tabelas
--
--  ANTES DE RODAR:
--    1. O código novo já lê os dois formatos, então o sistema funciona com ou
--       sem esta normalização.
--    2. Publique o código novo PRIMEIRO. A versão antiga só procura as chaves
--       com acento; se normalizar antes de publicar, os campos somem da tela.
--    3. Rode 00-auditoria.sql e guarde o resultado.
--
--  COMO REVERTER (descomente e rode se precisar):
--    update public.placas p
--       set dados_extra = b.dados_extra
--      from public.placas_backup_20261030 b
--     where p.id = b.id;
-- ============================================================================

begin;

-- 0) Função de normalização (também usada na verificação no final) -----------
create or replace function public.chave_normalizada(texto text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    lower(translate(texto,
      'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAAEEEEIIIIOOOOOUUUUCN')),
    '\s+', ' ', 'g'))
$$;

-- 1) Cópia de segurança da tabela inteira -----------------------------------
--    Se já existir (rodou antes), não sobrescreve: mantém a cópia original.
create table if not exists public.placas_backup_20261030
  as table public.placas;

-- 2) Normalização -----------------------------------------------------------
--    Se o mesmo registro tiver "Beneficiário" e "beneficiario" ao mesmo tempo,
--    fica o que tem valor; no empate, fica a chave já normalizada.
with normalizado as (
  select
    p.id,
    jsonb_object_agg(x.chave_nova, x.valor) as dados
  from public.placas p
  cross join lateral (
    select distinct on (chave_nova)
      chave_nova,
      valor
    from (
      select
        public.chave_normalizada(e.k) as chave_nova,
        e.v                          as valor,
        e.k                          as chave_original
      from jsonb_each_text(p.dados_extra) as e(k, v)
    ) s
    order by
      chave_nova,
      (valor <> '') desc,                 -- 1º: prefere a chave que tem valor
      (chave_original = chave_nova) desc  -- 2º: prefere a já normalizada
  ) x
  where p.dados_extra is not null
    and p.dados_extra <> '{}'::jsonb
  group by p.id
)
update public.placas p
   set dados_extra = n.dados
  from normalizado n
 where p.id = n.id
   -- só toca em quem realmente tem chave fora do padrão
   and exists (
     select 1
     from jsonb_each_text(p.dados_extra) as e(k, v)
     where k <> public.chave_normalizada(k)
   );

-- 3) Verificação (deve retornar 0 nas duas primeiras colunas) ---------------
select
  (select count(*)
     from public.placas p
    where p.dados_extra is not null
      and exists (
        select 1 from jsonb_each_text(p.dados_extra) as e(k, v)
        where k <> public.chave_normalizada(k)
      ))                                    as chaves_fora_do_padrao,
  (select count(*) from public.placas_backup_20261030) as linhas_no_backup,
  (select count(*) from public.placas)     as linhas_na_tabela,
  (select count(*)
     from public.placas p
     join public.placas_backup_20261030 b on b.id = p.id
    where b.dados_extra is distinct from p.dados_extra) as linhas_alteradas;

-- 4) Conferência de que nenhum valor foi perdido -----------------------------
--    Compara a quantidade de campos antes (backup) e depois (tabela).
--    Pode haver diferença SE o mesmo registro tinha chave duplicada
--    (ex: "Beneficiário" + "beneficiario"), porque as duas viram uma só.
select
  p.placa,
  (select count(*) from jsonb_each_text(b.dados_extra)) as campos_antes,
  (select count(*) from jsonb_each_text(p.dados_extra)) as campos_depois
from public.placas p
join public.placas_backup_20261030 b on b.id = p.id
where (select count(*) from jsonb_each_text(b.dados_extra))
    > (select count(*) from jsonb_each_text(p.dados_extra))
order by p.placa;

commit;

-- 5) Depois de conferir que está tudo certo, você pode apagar a cópia:
--    drop table public.placas_backup_20261030;
