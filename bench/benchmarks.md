# Benchmarks pour juger l'IA en droit (recherche du 4 octobre 2026)

## Harvey

- **Legal Agent Bench (LAB)** — mai 2026. Plus de 1 200 tâches longues, 24 domaines, 75 000 critères écrits par des avocats.
  L'agent reçoit un dossier client (Word, Excel, PDF) et doit rendre un vrai livrable. Une tâche ne compte que si **tous** ses critères passent.
  Notation par deux IA juges (GPT 5.5 + Claude Sonnet 4.6). Code et une partie des tâches publics : https://github.com/harveyai/harvey-labs
  Classement Vals au 1er octobre 2026 : Muse Spark 1.2 = 25,4 %, Gemini 4 Argon = 19,6 %, Claude Fable 5 = 11,3 %, Claude Opus 4.8 = 9,6 %, **Mistral Medium 3.5 = 0,4 %**.
  Les modèles passent ~90 % des critères un par un mais ratent presque toutes les tâches entières.
  Critique (LawNext) : c'est le leader du marché qui définit ce qu'est « du bon travail juridique ».
  https://www.vals.ai/benchmarks/hlab
- **BigLaw Bench: Research** — mars 2026, avec Snorkel. Recherche de jurisprudence américaine de bout en bout, avec citations. Privé.
- **BigLaw Bench** (2024) — le premier, tâches de cabinet d'affaires, privé.

## Vals AI (indépendant, utilisé par la presse)

- **Vals Legal AI Report (VLAIR)** — fév. 2025. Compare les produits (Harvey, CoCounsel, Vincent, Oliver) à des avocats humains sur 7 tâches. Harvey en tête sur 5 tâches.
- **Legal Research Bench** — recherche juridique US, construit avec des cabinets (Reed Smith, McDermott…). Écarts énormes selon le domaine (santé 80, famille 27). Privé.
- **CaseLaw v2** — jurisprudence canadienne, archivé depuis mai 2026.
- Tous les classements : https://www.vals.ai/benchmarks

## Académiques

- **LegalBench** (Stanford, 2023) — 162 tâches de raisonnement juridique US. Saturé : les 8 meilleurs modèles tiennent en 2,5 points.
- **Stanford « Hallucination-Free? »** (2024) — Lexis+ AI 17 %, Westlaw AI 33 % de réponses fausses ou trompeuses.
- **LexAgentHallu** (sept. 2026) — 3 414 cas, classe les hallucinations des agents juridiques en 27 types ; montre l'effet « bonne réponse, mauvaise raison ». https://arxiv.org/abs/2609.09754
- **PLawBench** (2026) — consultation, cas pratique, rédaction, noté par grilles.

## En français

- **Aucun benchmark public sur le droit français.**
- **BSARD** (Maastricht, 2022) — 1 100 questions de citoyens belges, en français, reliées aux bons articles de loi. https://github.com/maastrichtlawtech/bsard
- **LLeQA / bLLeQA** — 1 868 questions juridiques en français avec réponses d'experts fondées sur les articles (droit belge). https://huggingface.co/datasets/maastrichtlawtech/lleqa

## Ce que ça veut dire pour Visa

- Aucun de ces benchmarks ne vérifie qu'un texte était **en vigueur à la date des faits** ni le **rang de la norme**. C'est le trou.
- Pitch Stanford : « on publie notre propre jeu de test : N affirmations sur le droit français, X % des fausses citations attrapées ».
- Prudence sur le 0,4 % de Mistral au LAB : Mistral co-organise. À utiliser comme « même les meilleurs modèles échouent », pas contre Mistral.

## Pas vérifié

- Le dépôt GitHub de Harvey n'a pas été ouvert (quelle part des tâches est vraiment publique ?).
- Langue et juridiction de LexAgentHallu : non précisées dans le résumé.
- L'« étude d'août 2026, ~50 % d'erreurs sur le droit français » du brief : introuvable par recherche web.

## Où Claude (et les autres) bloquent, et pourquoi

Sources : Harvey « LAB initial results » (mai 2026), « LAB: Law Firm Knowledge », classement Vals du 1er octobre 2026, Stanford « Hallucination-Free? » section 6.3.

- Claude Fable 5 : 11,25 % des tâches réussies au LAB (10,4 % sans repli sur Opus 4.8), alors qu'il passe ~90 % des critères un par un.
- Résultats de mai : Opus 4.7 était premier avec 7,1 %, le plus « auto-correcteur », fort en synthèse (transactions, fonds). GPT-5.5 était meilleur pour fouiller les documents (réglementaire, startups).
- Coût : Opus 4.7, environ 51 $ et 22 min par tâche.
- Domaines les plus durs : successions et trusts, sanctions internationales, marchés de capitaux. Certains domaines sont à 0 pour tous les modèles.
- Causes d'échec (Harvey) :
  1. Recherche incomplète dans le dossier : il raisonne bien sur ce qu'il trouve, mais ne trouve pas tout et ne sait pas quand continuer à chercher. Quand la tâche demande de lister beaucoup d'éléments, le score tombe à 0 %.
  2. Un seul oubli fait échouer la tâche : clause manquante, document ignoré, détail de juridiction faux, partie de la consigne sautée.
  3. Rédiger sans se relire : -1,2 point. Vérifier puis corriger : +1,5 point (le meilleur levier mesuré).
- Causes d'hallucination (Stanford, sur Lexis/Westlaw/Practical Law, pas sur Claude), part des réponses fausses :
  - mauvaise recherche (mauvais sujet) : 20 à 47 %
  - source inapplicable (mauvaise juridiction, abrogée, renversée) : 23 à 38 %
  - vraie source qu'on fait parler à tort : 28 à 61 %
  - complaisance avec une prémisse fausse : 0 à 6 %
- Lien avec Visa : les causes 2 et 3 de Stanford correspondent exactement aux contrôles « en vigueur / rang » et « dit-elle vraiment ça ». Visa ne détecte pas les **oublis** (la cause n°1 de Harvey).
- Pas vérifié : aucune source publique ne détaille les échecs de Claude tâche par tâche. Les chiffres de mai (Opus 4.7) et d'octobre (Fable 5) ne sont pas directement comparables (version du benchmark différente).
