# QA360 - Supabase

Estado: **app integrado ao Supabase** (projeto `vqozovkvyqdqrztmbypy`, região eu-west-1). Equipes, aplicações, registros e histórico são lidos e gravados no banco. O acesso às telas exige login (Supabase Auth, e-mail e senha, contas por convite).

## Arquivos

| Arquivo                                                 | Para quê                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/schema.sql`                                   | Cria as tabelas, restrições, gatilho de histórico, dados iniciais (tipos de teste, equipe TOCT e 4 aplicações) e liga RLS com acesso para usuários autenticados. Pode rodar mais de uma vez. |
| `supabase/dev-anon-policies.sql`                        | **Só desenvolvimento.** Libera leitura e escrita para quem não está logado. Tem o bloco para remover no final.                                                                               |
| `supabase/migrate-test-types.sql`                       | Migra um banco criado com a lista antiga de tipos de teste (e2e_api, e2e_ui, contract, security) para a atual. Rodar uma vez.                                                                |
| `src/custom-code/environments/**/*.json`                | Bloco `supabase` (URL, chave pública e tamanho mínimo da senha) lido em tempo de execução.                                                                                              |
| `src/custom-code/auth/`                                 | Cliente único do Supabase, sessão e proteção das rotas.                                                                                                                                      |
| `src/custom-code/data/coverage.repository.ts`           | Contrato de armazenamento que o store usa.                                                                                                                                                   |
| `src/custom-code/data/supabase-coverage.repository.ts`  | Implementação com `@supabase/supabase-js`.                                                                                                                                                   |
| `src/custom-code/data/in-memory-coverage.repository.ts` | Implementação em memória, usada só nos testes unitários.                                                                                                                                     |

## Tabelas

| Tabela                   | Conteúdo                                             | Regras garantidas no banco                                                                                                        |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `test_types`             | Lista gerenciada de tipos de teste (`key`, `active`) | Ativos: unit, integration, api, ui. Inativo: performance                                                                          |
| `teams`                  | Equipes                                              | Nome único (sem diferenciar maiúsculas), até 60 caracteres                                                                        |
| `applications`           | Aplicações de uma equipe (`team_id`)                 | Nome único em todas as equipes (uma aplicação não pode estar em duas equipes); apagar a equipe apaga as aplicações                |
| `application_test_types` | Tipos de teste de cada aplicação                     | Só tipos que existem em `test_types`                                                                                              |
| `coverage_entries`       | Valor atual por aplicação + tipo + ano + mês         | Percentual de 0 a 100 com 2 casas, mês de 1 a 12, observação até 200 caracteres, **um único registro por aplicação + tipo + mês** |
| `coverage_history`       | Valor anterior e data de cada alteração              | Preenchido por gatilho ao mudar percentual ou observação; regravar o mesmo valor não cria histórico                               |

A equipe de um registro vem da aplicação (`applications.team_id`). Os ids são `uuid` gerados pelo banco.

Continuam validados no app (não dá para expressar como constraint simples): "toda equipe precisa de pelo menos uma aplicação", "toda aplicação precisa de pelo menos um tipo de teste" e "só registrar cobertura de tipo ativo e habilitado na aplicação".

## Como o app usa o banco

- `CoverageStore` valida a operação, grava pelo repositório e **recarrega tudo** do banco, então a tela sempre mostra o que está salvo. O histórico vem do gatilho do banco.
- O repositório do app é escolhido em `src/custom-code/custom.services.ts` (`CoverageRepository` → `SupabaseCoverageRepository`).
- Salvar uma equipe faz vários pedidos em sequência (equipe, aplicações, tipos de teste). Se um falhar no meio, o app recarrega e mostra o que de fato ficou salvo.
- Falha ao carregar ou gravar mostra uma mensagem (toast) nos 4 idiomas.
- Cliente único (`auth/supabase.client.ts`) com sessão guardada pelo `supabase-js`; os pedidos de dados usam o token do usuário logado. Os dados só são carregados depois do login.

## Segurança (importante)

A chave publishable fica no código do navegador por desenho. O que protege os dados são as policies do banco. Hoje `supabase/dev-anon-policies.sql` está ativo: **qualquer pessoa com a URL e a chave lê e altera os dados.** Aceitável só para teste sem dados reais.

Antes de usar dados reais:

1. Login: **feito** (e-mail e senha). Falta só o passo 2.
2. Remover as policies `anon` (bloco comentado no fim de `supabase/dev-anon-policies.sql`). As policies para `authenticated` do `schema.sql` já cobrem os usuários logados.

Nunca coloque a chave `service_role` / secret no código do app.

## Pendências e decisões

1. **Login**: implementado; falta remover as policies `anon`.
2. **Um banco ou um por ambiente** (dv, st, pd): a URL e a chave ficam no bloco `supabase` de cada arquivo de ambiente; dv, st e sx estão vazios.
3. **Plano gratuito**: projetos sem uso por cerca de uma semana são pausados e precisam ser reativados no painel.
4. Salvar equipe não é uma transação única; se virar problema, trocar por uma função SQL (RPC) que faça tudo de uma vez.
