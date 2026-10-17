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

**No Supabase** (projeto configurado em `src/custom-code/data/supabase.config.ts`). Tabelas e regras em `supabase/schema.sql`; detalhes, segurança e pendências em `docs/supabase.md`. O app ainda não tem login e usa as policies de desenvolvimento (`supabase/dev-anon-policies.sql`): não use dados reais até implementar o login.

## Estrutura (`src/custom-code`)

- `domain/`: modelos, regras de validação, histórico de registros e dados iniciais. Sem dependência do Angular.
- `data/`: store com signals (`coverage.store.ts`) e repositórios de armazenamento (Supabase no app, memória nos testes).
- `pages/`: telas (`dashboard`, `records`, `teams`). `shared/`: seletor de equipe e feedback (toast e confirmação).
- `components/coverage-line-chart/`: gráfico de linha sobre o `chart.js` que já acompanha o Polygon.
