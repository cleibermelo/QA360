# QAPulse

Acompanhamento mensal da cobertura de testes automatizados por equipe e aplicação (produto ou microsserviço). Os percentuais são informados manualmente.

> O `README.md` da raiz é gerado pelo Polygon e é sobrescrito; este arquivo documenta o QAPulse.

## Como executar

1. Instale as dependências e confie no certificado local conforme o [README.md](README.md) (`npm i`).
2. `npm run debug` e abra `https://localhost:4200`.
3. Testes: `npx ng test --watch=false --browsers=ChromeHeadless`.

## Telas

| Menu       | Rota          | Função                                                                                                                                                                   |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard  | `/dashboard`  | Gráfico de linha e tabela de conferência por aplicação e tipo de teste                                                                                                   |
| Records    | `/records`    | Tabela de registros (datagrid, igual a Teams) com "Create record", editar, histórico e excluir                                                                           |
| Teams      | `/teams`      | Lista de equipes (tabela do Polygon); criar e editar em modal (nome, aplicações e tipos de teste)                                                                        |
| SonarCloud | `/sonarcloud` | Cobertura de testes unitários vinda do SonarCloud: vários projetos, última medição de cada um no período e gráfico por período (meses sem medição aparecem como lacunas) |

O código, as rotas e os menus estão em inglês. Os textos das telas vêm dos arquivos de tradução (ver "Idiomas").

## Idiomas

Inglês (padrão), português de Portugal, espanhol e francês, pelo mecanismo de i18n do Polygon.

- Textos: `src/custom-code/assets/i18n/<cultura>/clientApp.components.lang.json` (`en-us`, `pt-pt`, `es-es`, `fr-fr`), todos com as mesmas chaves `RES_*`. No código, `Translator.t('Chave')` ou o pipe `translate`.
- Idiomas oferecidos: `src/custom-code/assets/configurations/i18n/supported-cultures.json`.
- Troca de idioma: menu da área de utilizador (avatar no canto superior direito) > "Change Language". A escolha fica no `localStorage` (`qapulse.language`) e a página recarrega ao trocar.
- `custom.services.ts` faz o menu funcionar sem autenticação (aplica a cultura antes de o Polygon carregar os textos e grava a escolha). O menu aparece porque `changeLanguageMenu` está ativo no `shell/config.json` e as culturas têm `showInLanguageSelection`.
- Ao incluir um texto, acrescente a chave nos quatro arquivos.

## Onde ficam os dados

**No Supabase.** Tabelas e regras em `supabase/schema.sql`; detalhes, segurança e pendências em `docs/supabase.md`. As policies de desenvolvimento (`supabase/dev-anon-policies.sql`) para o papel `anon` já foram removidas: só usuários logados leem e gravam, e não se deve executá-las de novo num banco com dados reais.

## Login (Supabase Auth)

- E-mail e senha, validados pelo Supabase; o app só guarda a sessão. Não há cadastro público: as contas são criadas por convite no painel do Supabase.
- Primeiro acesso: o link do convite abre `/set-password` (nova senha e confirmação). O tamanho mínimo vem de `supabase.passwordMinLength` e deve ser igual ao configurado no projeto.
- Sem sessão, qualquer rota vai para `/login`, que mostra "Welcome to QAPulse" no meio (espaço reservado também para conteúdo público no futuro). O shell mostra só o botão "Sign in" no canto superior direito, que abre o formulário num modal; o logo, o menu, o botão do menu, a busca e a área do utilizador ficam ocultos (`auth/signed-out-chrome.ts` e `styles/loader.scss`). Com sessão, `/login` vai para o dashboard. O "Logout" fica na área do utilizador (avatar), como nos produtos Polygon, e chama `signOut()`; `auth/polygon-user-area.ts` adapta o serviço de identidade do Polygon para mostrar nome, e-mail e o botão.
- No painel do Supabase (Authentication > URL Configuration), o Site URL e os Redirect URLs devem incluir o endereço do GitHub Pages e `https://localhost:4200`.

### Variáveis de ambiente

O Polygon lê `assets/environment.json` em tempo de execução (origem: `src/custom-code/environments/debug/environment.json` e `deploys/env.*.json`). O bloco do Supabase é:

```json
"supabase": {
  "url": "https://<project-ref>.supabase.co",
  "anonKey": "<chave pública (anon/publishable)>",
  "passwordMinLength": 6
}
```

- Use somente a chave pública. A chave `service_role` nunca deve aparecer no app nem no repositório.
- Arquivos `.env`, `.env.local` e `.env.*.local` estão no `.gitignore`, mas o app não os lê.
- Ao mudar textos ou menus, aumente `version` no `package.json` (e no `package-lock.json`) para invalidar o cache de traduções dos navegadores: o gerador do Polygon copia esse valor para o `version` dos arquivos de ambiente, então alterar só o `env.pd.json` não adianta.

## Cobertura do SonarCloud

Um job diário lê a cobertura dos projetos da organização no SonarCloud e grava, em `sonar_coverage_monthly`, o **último valor medido de cada mês** por projeto (`project_key` + `month`, sempre o dia 1; meses sem medição não são preenchidos). A tela **SonarCloud** só lê essa tabela.

- Código: `scripts/sonar-sync/` (`sync.mjs`, `sonar-client.mjs`, `supabase-writer.mjs`) e a regra de agrupamento em `src/custom-code/domain/sonar-coverage.ts` (com testes). O job não instala dependências: usa o `fetch` do Node 22.
- Tabela, RLS e a view `sonar_projects` estão em `supabase/schema.sql` (rode o arquivo no SQL Editor). Usuários autenticados só leem; a gravação é feita pela service role, que ignora o RLS.
- Agendamento: `.github/workflows/sonar-sync.yml` (todo dia às 06:00 UTC e manual em Actions > Sync SonarCloud coverage > Run workflow). O agendamento e o botão só existem depois que o workflow estiver na `main`.
- Secrets do repositório (Settings > Secrets and variables > Actions): `SONAR_TOKEN`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A organização (`cegidgroup`) e o filtro (`iberia`) estão no próprio workflow.
- Branches: vários projetos ainda têm `master` como branch principal no SonarCloud, enquanto os pipelines já analisam `main`, que o SonarCloud trata como branch secundária (o dashboard do SonarCloud e a API padrão leem só a principal). Por isso o job lê também as branches de `SONAR_EXTRA_BRANCHES` (padrão `main`) e junta os históricos: em cada mês vale a medição de data mais recente, de qualquer das branches. Para ler só a branch principal, deixe a variável vazia.
- Erros: token inválido (401) interrompe a execução; projeto sem permissão ou não encontrado (403/404) vira aviso e o job continua; os demais erros de um projeto são contados e o job termina com falha.

### Executar manualmente

Copie `.env.example` para `.env` (não versionado), preencha e rode:

```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item "Env:$($Matches[1].Trim())" $Matches[2].Trim() } }
node --experimental-strip-types scripts/sonar-sync/sync.mjs
```

- Sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (ou com `--dry-run`) nada é gravado: o script só lista o que gravaria.
- `--only=chave1,chave2` limita a execução a esses projetos.
- `--quiet` esconde nomes de projetos e percentagens do log, deixando só contagens. É o padrão no GitHub Actions, porque os logs de um repositório público são públicos.
- Para conferir, compare o último valor de um projeto com o que o SonarCloud mostra; um projeto sem análise de cobertura não gera linhas.

## Estrutura (`src/custom-code`)

- `domain/`: modelos, regras de validação, histórico de registros e dados iniciais. Sem dependência do Angular.
- `auth/`: cliente único do Supabase, sessão (signals), regra de acesso (`access.ts`) e o componente que protege as rotas.
- `data/`: store com signals (`coverage.store.ts`) e repositórios de armazenamento (Supabase no app, memória nos testes).
- `pages/`: telas (`dashboard`, `records`, `teams`, `login`, `logout`). `shared/`: seletor de equipe e feedback (toast e confirmação).
- `components/coverage-line-chart/`: gráfico de linha sobre o `chart.js` que já acompanha o Polygon.
