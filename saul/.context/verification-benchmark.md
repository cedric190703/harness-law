# Couche de vérification et benchmarks : l'idée et les problèmes

4 octobre 2026. Cadrage, rien de nouveau n'est codé.

## L'idée en une phrase

Prouver avec des chiffres qu'une couche de vérification des sources (la méthode
Visa : « sans preuve, rien n'est vert ») fait mieux réussir une IA juridique sur
un benchmark reconnu.

## Deux approches, un seul moteur

| | A. Couche externe (MCP) | B. Skill (la méthode dans l'agent) |
|---|---|---|
| Quand | après la réponse : un vérificateur relit | pendant le travail : l'agent se vérifie |
| Contre quoi | le texte officiel (Légifrance, Judilibre) | les pièces du dossier |
| Se branche sur | n'importe quelle IA (ChatGPT, Legora, Hector…) | le prompt de l'agent + des scripts Python |
| Attrape | décision inventée, texte pas en vigueur à la date des faits, mauvais rang, « ne dit pas ça » | citation fausse, et les oublis si on tient un tableau de complétude |
| Se mesure sur | notre jeu de test français | le benchmark de Harvey (LAB) |

Le cœur commun : **chaque citation doit exister mot pour mot dans sa source**.
Le MCP, c'est le produit (Visa). Le skill, c'est la preuve chiffrée.

## Les problèmes

1. **On ne peut pas brancher un MCP sur le benchmark de Harvey.** Vérifié dans
   leur code : bac à sable coupé d'internet (`--network=none`), 7 outils fixes
   (bash, read, write, edit, glob, grep, finish), aucune trace de MCP. Sur LAB,
   seule l'approche skill est possible, avec des scripts sans réseau. Modifier
   leur harness pour ajouter un MCP donnerait un chiffre qui n'est plus
   comparable au classement.
2. **LAB ne teste pas les sources officielles.** Les tâches portent sur les
   pièces d'un dossier, en droit américain. Ce qui se transpose : « chaque
   citation existe mot pour mot dans sa pièce ». La date des faits et le rang
   des normes ne sont mesurés par aucun benchmark public.
3. **Vérifier ce qui est écrit ne suffit pas à monter le score.** La cause
   n°1 d'échec sur LAB, c'est l'oubli : un seul critère raté et la tâche est
   ratée. Une couche qui ne contrôle que les citations ne voit pas ce qui
   manque. Il faut aussi un contrôle de complétude (le tableau de concordance :
   chaque terme de la référence a sa ligne).
4. **Le chiffre officiel risque de rester à 0.** Mistral Medium 3.5 réussit
   0,4 % des tâches. Sur 10 tâches, « 0 avant, 0 après » ne prouve rien. Il
   faut publier aussi la part des critères réussis (plus sensible).
5. **Les premiers essais n'ont rien mesuré.** Mistral Medium : refusé pour
   limite de débit (erreur 429). Codestral : s'arrête au premier tour sans
   ouvrir un seul document (0 critère sur 33, 0 fichier lu sur 3), avec ou
   sans skill. Le juge était un modèle Mistral, pas les juges officiels
   (Sonnet 4.6 + GPT-5.5), donc rien de comparable au classement.
6. **Coût et durée.** Repère Harvey : ~51 $ et ~22 min par tâche (Opus 4.7,
   toutes tâches). 10 tâches × 2 conditions × 2 modèles = 40 lancements. À
   mesurer sur 1 tâche avant de lancer le reste.
7. **Ne pas tricher sans le vouloir.** Mise au point sur les 5 tâches de
   développement seulement ; mesure sur les 10 tâches de test sans lire leurs
   grilles. Sinon le « +X points » ne tient pas devant Stanford.

## Ce qu'on peut prouver

- **Preuve 1, LAB (Harvey)** : « même modèle, avec et sans notre skill : +X
  points de critères réussis sur les tâches de comparaison ».
- **Preuve 2, jeu de test français (fait maison)** : « sur N affirmations
  piégées (décision inventée, texte abrogé, pas en vigueur à la date des faits,
  circulaire présentée comme obligatoire), Visa en attrape X %, et zéro faux
  vert ». C'est le seul endroit où le MCP Légifrance / Judilibre est mesuré.

## Décisions à prendre

1. **Modèle pour LAB** : Mistral (le jury, mais 0,4 % et des limites de
   débit), Claude (~11 %, plus de marge pour voir un effet), ou les deux.
2. **Juges** : les deux juges officiels (il faut une clé OpenAI) ou un seul.
3. **Jeu français** : qui l'écrit (les juristes) et combien d'affirmations.

## Pas vérifié

- Le sens exact de deux passages du message dicté (« functional niveau
  verification », « mirror ») : interprétés ici comme les deux approches A et B.
- Si la relance automatique ajoutée pour Mistral suffit à passer la limite de
  débit : aucun lancement réussi depuis.
- Le coût réel d'une tâche, et si le skill aide : aucun chiffre pour l'instant.
