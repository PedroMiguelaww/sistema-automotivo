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
npm test             # parser do 0800 e regras de acesso (Postgres local, não usa o Supabase)
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
  page.tsx                 login, código de duas etapas e "esqueci minha senha"
  redefinir-senha/         nova senha pelo link do e-mail
  (main)/                  área logada (navbar + avatar)
    placas/                cadastro de placa (0800 + OCR)
    mecanica/              etapas e histórico de status
    pecas/                 peças e valores
    reboque/               registros e contagens
    perfil/                placas, usuários (admin) e duas etapas
components/                ListaPlacas, PlacaDetalhe, GuardaAcesso, GerenciarUsuarios...
lib/
  supabase.ts              cliente do navegador
  campos0800.ts            chaves normalizadas + leitura compatível
  mensagem0800.ts          parser da mensagem do 0800
  consultor.ts             identifica o consultor citado na mensagem
  busca.ts                 filtros de busca (placa/beneficiário/consultor)
  duasEtapas.ts            verifica se a sessão ainda precisa do código
  fotos.ts                 limites e caminho das fotos de peça
  links.ts                 confere o link que vem na mensagem do 0800
  moeda.ts                 valores em reais
  papeis.ts                papéis e como aparecem na tela
  ocr.ts                   worker único do Tesseract
  status.ts                etapas e cores
  reboque.ts               utilidades de data
  texto.ts                 normalização de texto
scripts/copiar-ocr.mjs     copia os arquivos do OCR para public/ocr
supabase/                  SQL de auditoria, normalização e permissões
tests/                     parser do 0800 e regras de acesso (npm test)
proxy.ts                   porteiro das rotas internas (Next 16)
```

## Modelo de dados (Supabase)

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (= auth.users), `nome`, `role` (`super_admin` \| `operador` \| `consultor` \| `pendente`) |
| `placas` | `id`, `placa` (único), `status`, `consultor_id`, `dados_extra` (jsonb), `created_at` |
| `pecas` | `id`, `placa_id`, `nome`, `valor`, `imagem` (coluna antiga, sem uso), `imagem_path` (Storage), `created_at` |
| `reboques` | `id`, `placa_id`, `data`, `observacao` |
| `status_historico` | `id`, `placa_id`, `status_anterior`, `status_novo`, `atualizado_por`, `created_at` (gravado pelo banco) |
| `auditoria` | `tabela`, `registro_id`, `acao`, `dados_antes`, `dados_depois`, `usuario_id`, `created_at` (só o admin lê) |

`dados_extra` guarda os campos do 0800 com **chave normalizada** (`beneficiario`, `veiculo`, `adesao`, ...). Registros antigos com acento continuam legíveis via `lerCampo()`.

## Segurança

- RLS deve estar **ativo em todas as tabelas** com policies por operação.
- `proxy.ts` e `GuardaAcesso` só evitam abrir tela vazia. A proteção real dos dados é o RLS.
- Não existe cadastro público: contas são criadas pelo administrador e nascem sem acesso.

### Papéis

| Papel | O que pode |
|---|---|
| `super_admin` | Tudo: liberar contas, corrigir placa, alterar e apagar peça, apagar placa, ler a auditoria |
| `operador` | Ver e trabalhar em todas as placas (atendimento e oficina) |
| `consultor` | Ver e trabalhar só nas placas dele |
| `pendente` | Nada. É o papel de toda conta nova |

### Criar um usuário

1. Supabase > Authentication > Users > Add user > **Create new user**, com senha temporária e "Auto Confirm".
2. No sistema, em Perfil > Usuários, o administrador escolhe o papel da pessoa.
3. A pessoa usa "Esqueci minha senha" para definir a própria senha.

Não use "Invite user": o convite não funciona com o fluxo de login deste sistema.

Se alguém perder o celular das duas etapas: Authentication > Users > a pessoa > remover o fator.

### Configurações no painel do Supabase

- Authentication > Sign In / Providers: desligar **Allow new users to sign up**.
- Authentication > URL Configuration: **Site URL** com o endereço do sistema e `https://<endereço>/redefinir-senha` em **Redirect URLs**.
- Authentication > Emails: configurar um SMTP próprio. O e-mail padrão do Supabase tem limite baixo de envios e só entrega para membros da organização.

### SQLs (rodar no Supabase > SQL Editor, nesta ordem)

| Arquivo | O que faz | Mexe em dados? |
|---|---|---|
| `supabase/00-auditoria.sql` | Mostra tabelas, RLS, policies e colunas atuais | Não (só leitura) |
| `supabase/01-normalizar-dados-0800.sql` | Padroniza as chaves antigas do `dados_extra` | Sim, com cópia de segurança |
| `supabase/02-rls-politicas.sql` | Regras antigas. Substituído pelo 04; serve só para reverter | Sim (policies) |
| `supabase/03-diagnostico.sql` | Mostra em um só resultado o que conferir na segurança | Não (só leitura) |
| `supabase/04-seguranca.sql` | Papéis, regras de acesso, histórico, auditoria e bucket de fotos | Permissões; não apaga dados |

Ordem de publicação: **`04` primeiro, código logo depois**. O código novo grava
as fotos no bucket que o `04` cria. A lista de placas lê o `dados_extra` já
normalizado pelo `01`.

Pendências conhecidas: carro finalizado que volta à oficina não pode abrir novo atendimento (placa é única);
falta definir por quanto tempo os dados de clientes ficam guardados (LGPD).
