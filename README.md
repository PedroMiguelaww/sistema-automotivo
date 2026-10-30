# Sistema Automotivo — Proseg

Sistema interno de acompanhamento de atendimentos automotivos: cadastro de placas a partir da mensagem do 0800 (ou foto via OCR), controle de etapas na mecânica, peças com valor e registro de reboques.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4**
- **Supabase** (Auth + Postgres com RLS)
- **Tesseract.js** para ler placa/valor em foto (roda no navegador)

## Rodando local

```bash
npm install
cp .env.example .env.local   # e preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

Verificações:

```bash
npx tsc --noEmit     # tipos
npm run lint         # eslint
npm test             # testes do parser do 0800
npm run build        # build de produção
```

## Variáveis de ambiente

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (chave pública) |

A `anon key` é pública por design. A segurança dos dados vem do **RLS** no banco, não da chave. Nunca use a `service_role` no cliente.

## Estrutura

```
app/
  page.tsx                 login
  cadastro/                criação de conta
  (main)/                  área logada (navbar + avatar)
    placas/                cadastro de placa (0800 + OCR)
    mecanica/              etapas e histórico de status
    pecas/                 peças e valores
    reboque/               registros e contagens
    perfil/                minhas placas / todas (admin)
components/                ListaPlacas, PlacaDetalhe, SeletorPlaca, Toast...
lib/
  supabase.ts              cliente do navegador
  campos0800.ts            chaves normalizadas + leitura compatível
  mensagem0800.ts          parser da mensagem do 0800
  busca.ts                 filtros de busca (placa/beneficiário/consultor)
  ocr.ts                   worker único do Tesseract
  status.ts                etapas e cores
  reboque.ts               utilidades de data
  texto.ts                 normalização de texto
supabase/                  SQL de auditoria, normalização e permissões
tests/                     testes do parser do 0800 (npm test)
proxy.ts                   porteiro das rotas internas (Next 16)
```

## Modelo de dados (Supabase)

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (= auth.users), `nome`, `role` (`consultor` \| `super_admin`) |
| `placas` | `id`, `placa` (único), `status`, `consultor_id`, `dados_extra` (jsonb), `created_at` |
| `pecas` | `id`, `placa_id`, `nome`, `valor`, `imagem`, `created_at` |
| `reboques` | `id`, `placa_id`, `data`, `observacao` |
| `status_historico` | `id`, `placa_id`, `status_anterior`, `status_novo`, `atualizado_por`, `created_at` |

`dados_extra` guarda os campos do 0800 com **chave normalizada** (`beneficiario`, `veiculo`, `adesao`, ...). Registros antigos com acento continuam legíveis via `lerCampo()`.

## Segurança

- RLS deve estar **ativo em todas as tabelas** com policies por operação.
- `proxy.ts` só evita abrir tela vazia sem login. A proteção real dos dados é o RLS.

### SQLs (rodar no Supabase > SQL Editor, nesta ordem)

| Arquivo | O que faz | Mexe em dados? |
|---|---|---|
| `supabase/00-auditoria.sql` | Mostra tabelas, RLS, policies e colunas atuais | Não (só leitura) |
| `supabase/01-normalizar-dados-0800.sql` | Padroniza as chaves antigas do `dados_extra` | Sim, com cópia de segurança |
| `supabase/02-rls-politicas.sql` | Coloca a permissão no banco (consultor só vê o dele) | Sim (policies) |

Ordem de publicação: **código primeiro, SQL depois**. O código novo lê os dois
formatos de chave; a versão antiga só entende as chaves com acento.

Pendências conhecidas: apagar reboque ainda não deixa rastro (soft delete),
fotos de peça ainda em base64 (mover para Storage).
