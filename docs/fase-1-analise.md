# Fase 1: análise do projeto

## Situação encontrada

- Angular 20 com Polygon 20. O código próprio fica em `src/custom-code`; `src/generated-code` é gerado.
- Rotas em `custom.routes.ts`, carregadas dentro do `LayoutRootComponent` do shell. O menu lateral é configurado em `assets/configurations/menu/config.json`.
- Não havia persistência (sem API, banco ou `HttpClient`). Só existe o `StorageService` do Polygon, baseado em `localStorage`.

## Componentes Polygon usados

| Necessidade                                 | Componente                                             |
| ------------------------------------------- | ------------------------------------------------------ |
| Menu lateral, cabeçalho, breadcrumbs        | Shell (`menu/config.json`, `ViewTitleService`)         |
| Selects                                     | `po-single-select`, `po-multi-select`                  |
| Campos                                      | `po-input`, `po-numeric-input`                         |
| Botões, mensagens de erro                   | `po-button`, `po-inline-message`                       |
| Confirmação, feedback e formulário em modal | `DialogService`, `ToastMessageService`, `ModalService` |
| Tabela da lista de equipes                  | `po-datagrid-viewer-all-data` (`@polygon/qbuilder`)    |

## Criado fora do Polygon (justificativa)

- **Gráfico de linha** (`coverage-line-chart`): o Polygon só oferece `po-chart-widget`, que depende de dashboards configurados e de um endpoint HTTP. O wrapper usa o `chart.js`, que já é dependência do Polygon, com as cores do tema (`--chart-*`).
- **Tabelas**: a lista de equipes usa o `po-datagrid-viewer` do Polygon, com uma fonte de dados em memória. As tabelas menores de Records e do Dashboard são HTML com os tokens do tema, porque o datagrid exige configuração e fonte de dados, o que é desproporcional para elas.

## Decisões

- Fase atual só de UI, com dados em memória. Banco: Supabase ou Neon, em fase posterior.
- Contexto de equipe compartilhado entre as telas pelo store.
- Textos em pt-BR direto nos templates (o projeto não tem `pt-br` no i18n).
- Tipos de teste iniciais por aplicação (suposição a confirmar): APIs com Unitário, Integração e E2E de API; Usage, SRS e CBMS com Unitário e Integração.
