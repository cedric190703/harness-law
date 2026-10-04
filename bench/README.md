# Benchmark de Harvey : notre couche de vérification

Objectif : améliorer le score d'un modèle (Mistral, Claude) sur le benchmark public de Harvey (Legal Agent Bench, https://github.com/harveyai/harvey-labs) en ajoutant notre skill de vérification `skills/cross-document-review`.

## La tâche visée

Les 152 tâches « comparer un document à sa référence » : contrat de crédit comparé à la term sheet, jugement comparé à l'accord de médiation, police d'assurance comparée au cahier des charges, etc. Pour être réussie, une tâche doit valider tous ses critères : chaque écart trouvé, les deux valeurs citées, l'impact chiffré et une recommandation.

## Ce que fait le skill

Il applique la méthode de l'avocat, le tableau de concordance :

1. Il convertit tous les documents en texte (`extract_text.py`).
2. Il liste les chiffres qui n'apparaissent que dans un seul document (`check.py candidates`) : ce sont les écarts probables.
3. Il tient un tableau d'écarts avec des citations mot pour mot (`ledger.jsonl`).
4. Il bloque tant qu'il reste un défaut (`check.py ledger`) : une citation introuvable dans le texte, une ligne incomplète, un document non lu, un chiffre suspect non traité.
5. Il vérifie que le rapport final reprend chaque écart avec ses deux valeurs (`check.py report`), puis relit la consigne avant de rendre.

## Mesure

- `split.json` : 5 tâches de développement (seules autorisées pour mettre au point le skill), 10 tâches de test tirées au sort (graine 20261004), et 2 tâches témoins hors comparaison.
- On compare deux conditions, les skills de Harvey seuls puis les skills de Harvey avec le nôtre, avec le même modèle et le même effort de réflexion.
- On publie deux chiffres : la part des tâches réussies (le chiffre officiel) et la part des critères réussis.

Le plan détaillé est dans `plan.md`, l'état de l'art dans `benchmarks.md`.

## Installation (macOS)

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/harveyai/harvey-labs
cd harvey-labs
git sparse-checkout set --no-cone '/lab_core/' '/scripts/' '/docs/' '/pyproject.toml' '/uv.lock' '/tasks/**/task.json'
git sparse-checkout add $(python3 -c "import json;s=json.load(open('../bench/split.json'));print(' '.join('/tasks/'+t+'/' for t in s['dev']+s['test']+s['controle']))")
bash scripts/setup.sh   # installe uv, pandoc et podman, puis télécharge l'image du bac à sable
```

Clés nécessaires dans `.env` : `MISTRAL_API_KEY` et `ANTHROPIC_API_KEY`. `OPENAI_API_KEY` est facultative : elle sert au second juge.

## État

- [x] Skill v1 : méthode, scripts d'extraction et de contrôle
- [x] Script qui lance les deux conditions et calcule les scores (`bench/run.py`)
- [ ] Premier lancement sur 1 tâche, pour mesurer le coût et la durée
- [ ] Mise au point sur les 5 tâches de développement
- [ ] Mesure sur les 10 tâches de test (Mistral, puis Claude)

## Lancer

```bash
cp .env.example .env               # puis remplir les clés
python3 bench/run.py --model mistral-medium-3.5 --set one     # 1 tâche, avec et sans skill
python3 bench/run.py --model claude-sonnet-5-5 --set dev --parallel 4
python3 bench/run.py --summary
```
