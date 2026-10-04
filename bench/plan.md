# Skill « tableau de concordance » : améliorer un modèle sur le benchmark de Harvey

Plan du 4 octobre 2026. Rien n'est codé ni lancé.

## Ce qu'on a vérifié dans le dépôt de Harvey (github.com/harveyai/harvey-labs, MIT)

- 2 010 tâches publiques, documents compris (le dépôt pèse plus de 600 Mo).
- On peut brancher un skill : un dossier `lab_core/harness/skills/<nom>/` avec un `SKILL.md` (ajouté au prompt système) et des `scripts/` (copiés dans l'espace de travail de l'agent). Option `--skills` pour choisir les skills chargés, donc on peut comparer proprement avec et sans.
- Les skills déjà présents ne servent qu'aux formats de fichiers (docx, xlsx, pptx), et font 86 à 158 lignes.
- Il existe un connecteur Mistral (`mistral*`).
- Bac à sable sans réseau : les scripts du skill ne peuvent pas appeler d'IA, seulement du Python.
- Interdiction de lire `task.json` (sinon la tâche est notée en échec).
- Notation par défaut : deux juges (Sonnet 4.6 + GPT-5.5). Option `--judges` pour n'en garder qu'un.
- À installer sur le Mac : podman et pandoc (le script `scripts/setup.sh` s'en charge). uv et docker sont déjà là.
- Une tâche compte en moyenne 54 critères ; il faut les réussir tous.

## La tâche choisie : comparer un document à sa référence

152 tâches `compare-*`, réparties dans les 24 matières. Exemples : contrat de crédit comparé à la term sheet, closing comparé à la checklist, politique interne comparée à la réglementation, contrat signé comparé au dernier projet.

La grille se répète d'une tâche à l'autre. Pour chaque écart, il faut :
1. le trouver ;
2. citer les deux valeurs exactes (« 0,75 % dans la term sheet, 1,00 % dans le contrat ») ;
3. chiffrer l'impact (« ≈ 462 500 $ par an ») ;
4. recommander une correction.

Pourquoi cette tâche :
- c'est le métier de Visa : confronter une affirmation à sa source ;
- elle mesure directement la cause d'échec n°1 identifiée par Harvey, l'oubli ;
- les tâches se ressemblent, donc un seul skill couvre les 152 ;
- elle repose sur la rigueur documentaire plus que sur la connaissance du droit américain, donc elle se transpose au droit français.

## Le skill : la méthode de l'avocat (tableau de concordance)

1. **Inventaire.** Lister tous les documents. Dire lequel est la référence et lequel est comparé. Un script suit les documents lus.
2. **Une ligne par terme de la référence**, section par section, dans un fichier `concordance.csv` : le terme, la citation exacte, la section. On ne s'arrête pas aux « points importants ».
3. **Pour chaque ligne, retrouver le pendant** dans le document comparé (citation exacte et section). Statut : conforme, écart ou absent.
4. **Sens inverse** : relever ce qui figure dans le document comparé mais pas dans la référence (les ajouts).
5. **Contrôle par script** :
   - chaque citation existe mot pour mot dans son document (la règle d'or de Visa) ;
   - chaque ligne a un statut ;
   - chaque document a été lu.
6. **Pour chaque écart** : les deux valeurs, l'impact chiffré (calculé par script), la partie qu'il favorise, la recommandation, la priorité.
7. **Rédiger le rapport à partir du tableau**, pas de mémoire.
8. **Relire avant de rendre** : reprendre la consigne demande par demande, comparer le rapport au tableau, corriger, puis rendre.

## Bonnes pratiques de harness appliquées

Mesurées par Harvey dans ses premiers résultats de mai 2026 :
- vérifier puis corriger : +1,5 point ;
- rédiger sans relire : -1,2 point ;
- lire plus de 90 % des documents : +0,4 point ;
- faire l'analyse par du code : +0,3 point ;
- lancer des rafales d'outils sans direction : -0,5 point.

Bonnes pratiques de rédaction de skills et d'agents :
- `SKILL.md` court, de l'ordre de 150 lignes comme ceux de Harvey ;
- le travail mécanique dans des scripts, le jugement au modèle ;
- l'état gardé dans un fichier (le tableau) plutôt que dans la mémoire du modèle, pour résister aux longs dossiers ;
- une checklist à cocher ;
- un déclenchement ciblé : le skill est chargé pour toutes les tâches, donc il doit dire clairement qu'il ne s'applique qu'aux comparaisons.

## Mesure (honnête)

- **Ne pas apprendre sur le test.** On écrit le skill en ne regardant que 5 tâches (développement). On mesure sur 10 à 12 autres, tirées au hasard avec une graine fixe et dans des matières différentes, dont on ne lit pas les grilles.
- On ajoute 2 tâches hors comparaison pour vérifier que le skill ne dégrade rien.
- Deux conditions : skills de Harvey seuls, puis skills de Harvey + le nôtre. Même modèle, même effort de réflexion.
- On publie deux chiffres :
  - **tâches réussies**, le chiffre officiel, qui risque de rester à 0 sur un petit échantillon ;
  - **critères réussis**, plus sensible.
- On lance d'abord 1 seule tâche pour mesurer le coût et la durée réels, puis on fixe la taille de l'échantillon.

## Cas à valider

- Une référence et un document comparé, avec des écarts nets.
- Plusieurs références (term sheet + lettre d'engagement) ou plusieurs documents comparés (tout un jeu de closing).
- Une référence qui est un texte réglementaire et non un contrat.
- Des documents plus longs que le contexte : le tableau sur disque doit tenir.
- Un terme sans écart : écrire « conforme », ne rien inventer.
- Un écart caché dans une définition (par exemple l'EBITDA redéfini) : lire les définitions.
- Un livrable en .xlsx ou en .docx : passer par les skills de Harvey.
- Une tâche qui n'est pas une comparaison : le skill ne doit pas s'activer.
- La limite de 200 tours : le skill ne doit pas faire exploser le nombre de tours.

## Lien avec Visa

« Visa, c'est une méthode de vérification. On l'a branchée sur le benchmark de Harvey : +X points sur les tâches de comparaison. En France, la même méthode, avec Légifrance et Judilibre comme référence. »

## Pas vérifié

- Le coût et la durée par tâche sur ces tâches précises (le chiffre de 51 $ et 22 min concerne Opus 4.7, toutes tâches confondues).
- Si podman s'installe et tourne sur ce Mac.
- Le score de départ du modèle choisi sur ces 152 tâches (seul le score global est connu : Mistral Medium 3.5 = 0,4 %).
