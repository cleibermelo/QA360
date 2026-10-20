# Cobertura: SonarCloud vs. relatório da release

O QAPulse mostra o **Coverage do SonarCloud**. O relatório de cobertura da release (Azure DevOps) mostra outra coisa. Os dois estão corretos, mas medem de formas diferentes e não devem ser comparados diretamente.

Os números abaixo são do projeto `iberia_lithium-product-tech.apps.server`, no build de 04/09/2026 (branch `main`).

## 1. A fórmula

| Fonte                        | O que mede                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| **SonarCloud: Coverage**     | Linhas **e** ramificações (condições como `if` e `switch`) somadas numa única percentagem |
| **Release: Line coverage**   | **Só linhas**                                                                             |
| **Release: Branch coverage** | Só ramificações, mostrada à parte                                                         |

A fórmula do SonarCloud é:

```text
Coverage = (linhas cobertas + condições cobertas) / (linhas a cobrir + condições a cobrir)
```

No `apps.server`: `(14 038 + 2 825) / (22 177 + 5 121) = 61,8%`.

## 2. O escopo: o que entra na conta

|                 | SonarCloud                                  | Release                            |
| --------------- | ------------------------------------------- | ---------------------------------- |
| Linhas a cobrir | **22 177**                                  | **152 358**                        |
| O que entra     | Só o código que não foi excluído da análise | Todos os arquivos dos 9 assemblies |

O projeto no SonarCloud costuma excluir da cobertura os projetos de teste, o código gerado e outros arquivos. O relatório da release não faz essa exclusão e por isso conta muito mais linhas.

## 3. Resultado lado a lado (mesmo build)

| Métrica                           | SonarCloud | Release      |
| --------------------------------- | ---------- | ------------ |
| **Cobertura mostrada no QAPulse** | **61,8%**  | (não existe) |
| Cobertura de linhas               | 63,3%      | 65,9%        |
| Cobertura de ramificações         | 55,2%      | 28,6%        |

A cobertura de linhas difere pouco. A de ramificações difere muito, porque a release inclui código com muitas ramificações sem teste que o SonarCloud exclui.

## 4. Qual usar

- **Acompanhar a evolução por equipe e projeto:** o SonarCloud. É a ferramenta de referência da organização e qualquer pessoa confere o mesmo número lá. É o que o QAPulse mostra.
- **O 65,9% da release:** serve para ver a cobertura **de linhas** de um build específico. Não deve ser comparado com o do QAPulse, porque a fórmula e o escopo são outros.

Regra para a conversa: se o número do QAPulse bate com o do SonarCloud, está certo.

## 5. De onde vêm os dados do QAPulse

- Um job diário (GitHub Actions) lê a cobertura de cada projeto na API do SonarCloud e grava no Supabase o **último valor de cada mês**.
- Muitos projetos ainda têm `master` como branch principal no SonarCloud, enquanto os pipelines já analisam a `main`. O job lê as duas e, em cada mês, vale a medição de data mais recente.
- Os meses sem análise no SonarCloud aparecem como lacuna no gráfico e nunca são preenchidos com valores de outros meses.
- Um valor de **0%** na `main` indica que o pipeline não enviou relatório de cobertura ao SonarCloud nessa análise. Vale confirmar com a equipe do projeto.
