# QA360

Acompanhamento mensal da cobertura de testes automatizados por equipe e aplicação (produto ou microsserviço). Os percentuais são informados manualmente.

> O `README.md` da raiz é gerado pelo Polygon e é sobrescrito; este arquivo documenta o QA360.

## Como executar

1. Instale as dependências e confie no certificado local conforme o [README.md](README.md) (`npm i`).
2. `npm run debug` e abra `https://localhost:4200`.
3. Testes: `npx ng test --watch=false --browsers=ChromeHeadless`.

## Telas

| Menu      | Rota         | Função                                                                                            |
| --------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Dashboard | `/dashboard` | Gráfico de linha e tabela de conferência por aplicação e tipo de teste                            |
| Records   | `/records`   | Tabela de registros (datagrid, igual a Teams) com "Create record", editar, histórico e excluir    |
| Teams     | `/teams`     | Lista de equipes (tabela do Polygon); criar e editar em modal (nome, aplicações e tipos de teste) |

O código, as rotas e os menus estão em inglês. Os textos das telas vêm dos arquivos de tradução (ver "Idiomas").

## Idiomas

Inglês (padrão), português de Portugal, espanhol e francês, pelo mecanismo de i18n do Polygon.

- Textos: `src/custom-code/assets/i18n/<cultura>/clientApp.components.lang.json` (`en-us`, `pt-pt`, `es-es`, `fr-fr`), todos com as mesmas chaves `RES_*`. No código, `Translator.t('Chave')` ou o pipe `translate`.
- Idiomas oferecidos: `src/custom-code/assets/configurations/i18n/supported-cultures.json`.
- Troca de idioma: menu da área de utilizador (avatar no canto superior direito) > "Change Language". A escolha fica no `localStorage` (`qa360.language`) e a página recarrega ao trocar.
- `custom.services.ts` faz o menu funcionar sem autenticação (aplica a cultura antes de o Polygon carregar os textos e grava a escolha). O menu aparece porque `changeLanguageMenu` está ativo no `shell/config.json` e as culturas têm `showInLanguageSelection`.
- Ao incluir um texto, acrescente a chave nos quatro arquivos.

## Onde ficam os dados

**No Supabase.** Tabelas e regras em `supabase/schema.sql`; detalhes, segurança e pendências em `docs/supabase.md`. As policies de desenvolvimento (`supabase/dev-anon-policies.sql`) valem só para o papel `anon`: o login protege as telas, mas não o banco. Não use dados reais até as policies serem trocadas por regras para usuários autenticados.

## Login (Supabase Auth)

- E-mail e senha, validados pelo Supabase; o app só guarda a sessão. Não há cadastro público: as contas são criadas por convite no painel do Supabase.
- Primeiro acesso: o link do convite abre `/set-password` (nova senha e confirmação). O tamanho mínimo vem de `supabase.passwordMinLength` e deve ser igual ao configurado no projeto.
- Sem sessão, qualquer rota vai para `/login`, que mostra "Welcome to QA360" no meio (espaço reservado também para conteúdo público no futuro). O shell mostra só o botão "Sign in" no canto superior direito, que abre o formulário num modal; o logo, o menu, o botão do menu, a busca e a área do utilizador ficam ocultos (`auth/signed-out-chrome.ts` e `styles/loader.scss`). Com sessão, `/login` vai para o dashboard. O "Logout" fica na área do utilizador (avatar), como nos produtos Polygon, e chama `signOut()`; `auth/polygon-user-area.ts` adapta o serviço de identidade do Polygon para mostrar nome, e-mail e o botão.
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
- Ao mudar textos ou menus, aumente `version` no `env.pd.json` para invalidar o cache de traduções dos navegadores.

## Estrutura (`src/custom-code`)

- `domain/`: modelos, regras de validação, histórico de registros e dados iniciais. Sem dependência do Angular.
- `auth/`: cliente único do Supabase, sessão (signals), regra de acesso (`access.ts`) e o componente que protege as rotas.
- `data/`: store com signals (`coverage.store.ts`) e repositórios de armazenamento (Supabase no app, memória nos testes).
- `pages/`: telas (`dashboard`, `records`, `teams`, `login`, `logout`). `shared/`: seletor de equipe e feedback (toast e confirmação).
- `components/coverage-line-chart/`: gráfico de linha sobre o `chart.js` que já acompanha o Polygon.
