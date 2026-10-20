# SonarCloud: branches `master` e `main`

Como os projetos da organização `cegidgroup` estão configurados no SonarCloud em relação às branches e o que o QAPulse faz a respeito.

## Situação encontrada

No SonarCloud, cada projeto tem uma **branch principal**. O dashboard do SonarCloud e a API de histórico (`measures/search_history`) leem, por padrão, **só essa branch**.

Em muitos projetos a branch principal ainda se chama **`master`**, mas os pipelines já analisam a branch **`main`**. Para o SonarCloud, a `main` é uma branch secundária (tipo `SHORT`), e as análises dela não entram na principal.

Resultado: o histórico da `master` pára na data em que o repositório passou a usar `main`, mesmo que o projeto continue sendo analisado.

### Exemplo: `iberia_lithium-product-tech.apps.server`

| Branch no SonarCloud | Papel      | Última análise | Cobertura |
| -------------------- | ---------- | -------------- | --------- |
| `master`             | Principal  | 17/04/2026     | 56,5%     |
| `main`               | Secundária | 20/10/2026     | 70,2%     |

O dashboard do SonarCloud mostra "Last analysis: 17 Apr 2026" e 56,5%, embora o projeto tenha sido analisado depois disso.

### Alcance

Numa varredura dos 136 projetos filtrados por `iberia` (20/10/2026):

- **49 projetos** tinham análises mais recentes fora da branch principal. Quase todos seguem o padrão `master` principal e `main` mais recente.
- Alguns projetos aparecem como "sem análise" porque a `master` nunca foi analisada, mas têm dados na `main`. Exemplo: `iberia_lithium-product-tech.cbms.server` (análise na `main` em 12/10/2026).
- Alguns têm análises em outras branches, como `feature/...` e `release/...`. Essas não entram no QAPulse.

## O que o QAPulse faz

O job de sincronização (`scripts/sonar-sync/sync.mjs`) lê o histórico de cobertura da **branch principal** e também das **branches extras** configuradas, e junta os pontos. Em cada mês vale a medição de **data mais recente**, de qualquer das branches.

- As branches extras vêm da variável `SONAR_EXTRA_BRANCHES`, com padrão `main` (definida no workflow `.github/workflows/sonar-sync.yml` e no `.env.example`). Aceita vários nomes separados por vírgula.
- Projeto sem a branch extra continua normalmente, sem erro.
- Com a variável vazia, o job volta a ler só a branch principal.
- Os meses sem análise continuam como lacuna e nunca são preenchidos com valores de outros meses.

Efeito na carga de 21/10/2026: 44 projetos passaram a usar dados da `main`, e a carga gravou 853 linhas (antes, 761).

| Projeto       | Antes                  | Depois                 |
| ------------- | ---------------------- | ---------------------- |
| `apps.server` | último em abril, 56,5% | outubro, 70,2% (20/10) |
| `srs.server`  | fevereiro              | junho (29/06)          |
| `cbms.server` | sem linhas             | 1 mês (12/10)          |

## Pontos de atenção

- **Valores de 0% na `main`.** Vários projetos aparecem com 0% na `main`, por exemplo `usg.server`, `cbms.server` e `ids.server` (este tinha 41,5% na `master`, em fevereiro). É o valor que o SonarCloud reporta. Provavelmente o pipeline da `main` não envia o relatório de cobertura. Vale confirmar com a equipe antes de tomar esses 0% como cobertura real.
- **`main` precisa ser a branch de produção.** O job assume que sim. Se algum projeto usar outro nome, acrescente-o em `SONAR_EXTRA_BRANCHES`.
- **Projetos com erro 404.** Cerca de nove projetos, como `iberia_ekon-product-la`, continuam com aviso 404 porque o SonarCloud não entrega o histórico deles nem pela `main`. Isso não depende do código do QAPulse.

## Correção na origem (opcional)

A correção definitiva é no SonarCloud, por quem administra a organização: em cada projeto, em **Administration > Branches and Pull Requests**, renomear a branch principal de `master` para `main` (pode ser preciso apagar antes a `main` secundária que já existe). Depois disso, o dashboard do SonarCloud e o histórico padrão passam a refletir a `main`. O job continua funcionando, e a leitura da branch extra vira redundante, mas inofensiva.

## Como conferir

A API de branches mostra a principal e as demais de um projeto, com a data da última análise:

```text
https://sonarcloud.io/api/project_branches/list?project=<chave-do-projeto>
```

O histórico de uma branch específica usa o parâmetro `branch`:

```text
https://sonarcloud.io/api/measures/search_history?component=<chave-do-projeto>&branch=main&metrics=coverage&ps=1000
```

Os dois exigem sessão ativa no SonarCloud, porque os projetos são privados.
