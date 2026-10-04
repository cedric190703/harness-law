# Claude sur les tâches M&A du benchmark de Harvey (recherche du 4 octobre 2026)

## Ce qui est publié

Harvey ne publie aucun résultat tâche par tâche. Le niveau le plus fin, c'est
un score par domaine, calculé sur des tâches cachées.

| Modèle | Domaine | Score | Source |
|---|---|---|---|
| Fable 5, Opus 4.7, Opus 5 | Corporate M&A, tâches entières | 20 % | [Vals, 01/10/2026](https://www.vals.ai/benchmarks/hlab) |
| Opus 4.8, Opus 5.5, Fable 5.1, Sonnet 4.6 / 5 / 5.5 | idem | 0 % | idem |
| Meilleurs modèles (Gemini 4 Argon, Muse Spark) | idem | 20 %, personne ne fait mieux | idem |
| Opus 5 / Fable 5 / Sonnet 5.5 | M&A, critères réussis | 93,9 / 92,0 / 76,0 % | idem |
| Sonnet 5.5 / Fable 5.1 / Fable 5 | M&A, critères réussis (autre mesure) | 95,8 / 95,5 / 93,9 % | [Artificial Analysis](https://artificialanalysis.ai/evaluations/harvey-lab-aa) |
| Opus 4.7 / Sonnet 4.6 | « Transactions et fonds » | 15 % / 0 % | [Harvey, 26/05/2026](https://www.harvey.ai/blog/legal-agent-benchmark-initial-results) |
| Opus 5 | Due diligence M&A, critères réussis | 42,5 % ; 77,6 % avec des sous-agents ; 24,6 % via Claude Code | [Harvey, 08/09/2026](https://www.harvey.ai/blog/post-training-rlm-agents-for-m-and-a-diligence) |

Hypothèse non vérifiée : chaque domaine compterait 5 tâches. On le déduit de
120 tâches pour 24 domaines et d'une marge d'erreur de 20 points.

## Pourquoi Claude rate (sources publiques)

- **Tout ou rien.** Claude réussit 92 à 96 % des critères M&A, mais au mieux
  1 tâche sur 5. L'échec vient d'un ou deux points manqués, pas d'une
  incompétence générale.
- **Il lit trop peu.** En due diligence, les agents lisent entre 0,1 et 0,5 %
  de la data room. Avec Claude Code, Opus 5 s'arrête tôt et écrit des mémos
  plus courts.
- **Il cherche par mots-clés au lieu de croiser les pièces.** Il manque ce qui
  demande deux documents à la fois : un consentement de changement de contrôle
  absent, une preuve de propriété ou de bail manquante, un risque de licence
  libre ([Harvey, 17/07/2026](https://www.harvey.ai/blog/legal-agent-bench-m-and-a-due-diligence)).
- **Il est fragile sur les calculs en plusieurs étapes** : fiscalité, cascade
  de distribution d'un fonds ([Harvey, 09/06/2026](https://www.harvey.ai/blog/fable-5-now-available-in-harvey)).
  L'effet sur les tâches M&A chiffrées (fonds de roulement, QoE) est une
  inférence.

## Les tâches M&A du dépôt public

136 tâches dans `tasks/corporate-ma/`. Aucune ne figure dans `bench/split.json`.
Grilles non lues, pour pouvoir s'en servir comme test honnête.

Environ 60 tâches demandent de croiser des pièces. Ce sont les plus proches
de notre skill :

- `compare-target-representations-vs-diligence` (38 critères, 7 pièces)
- `review-disclosure-schedules-against-representations-for-completeness` (52, 5)
- `analyze-disclosure-schedule-markup-against-merger-agreement` (51, 6)
- `identify-disclosure-schedule-issues` (38, 5)
- `extract-change-of-control-provisions` (55, 8)
- `analyze-change-of-control-provisions-across-targets-material-contracts` (57, 19)
- `track-third-party-consents` (60, 9)
- `compare-closing-checklist-against-ma-agreement` (38, 2) : la moins chère à lancer
- `compare-closing-docs` (33, 12)
- `review-data-room-red-flag-review` (50, 13)

## Pas vérifié

- Les chiffres ci-dessus ont été lus par un agent de recherche sur les pages
  citées. Je ne les ai pas relus moi-même.
- On ne sait pas quelles tâches M&A Claude rate précisément : il faut le
  mesurer nous-mêmes.
