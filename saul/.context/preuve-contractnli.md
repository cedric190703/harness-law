# Preuve ContractNLI : Visa contre le modèle seul

Mesure du 4 octobre 2026. Script : `app/scripts/contractnli.ts`. Résultats complets, paire par paire :
`app/src/eval/contractnli-resultats.json`. Calculs testés sans réseau : `app/src/eval/contractnli.test.ts`.

## En une phrase

Sur 150 paires (contrat, hypothèse) d'un benchmark public de Stanford, Visa ramène les **faux verts de 28 % à 3 %**
et, quand il met du vert, il a raison **81 % du temps contre 58 %** pour le modèle seul. Le prix à payer : il ne
confirme qu'**un quart des vraies affirmations (26 % contre 78 %)**, et son exactitude sur les trois étiquettes du jeu
tombe de 61 % à 36 %. Point important : sur ce jeu, **ce n'est pas le garde-fou mot pour mot qui supprime les faux
verts, c'est la posture d'avocat adverse**. Le garde-fou n'en a évité aucun ; il a écarté 23 verdicts (15 %),
dont 2 verts justes.

## Le tableau

Même modèle pour les deux conditions : `mistral-large-latest` (essayé en premier, il a répondu ; c'est aussi le
juge par défaut de Visa). Contrat entier dans les deux cas. 150 paires : 50 Entailment, 50 Contradiction,
50 NotMentioned.

| | A, modèle seul | B, Visa | B sans le garde-fou |
|---|---|---|---|
| **Faux verts** (NON Entailment déclarées Entailment) | **28 % (28/100)** | **3 % (3/100)** | 3 % (3/100) |
| dont sur Contradiction | 14 % (7/50) | 4 % (2/50) | 4 % (2/50) |
| dont sur NotMentioned | 42 % (21/50) | 2 % (1/50) | 2 % (1/50) |
| Fiabilité des verts (précision Entailment) | 58 % (39/67) | **81 % (13/16)** | 83 % (15/18) |
| Verts confirmés (rappel Entailment) | **78 % (39/50)** | 26 % (13/50) | 30 % (15/50) |
| Exactitude, trois étiquettes | **61 % (91/150)** | 36 % (54/150) | 42 % (63/150) |
| F1 macro | **0,555** | 0,301 | 0,323 |
| F1 Entailment / Contradiction / NotMentioned | 0,667 / 0,694 / 0,305 | 0,394 / 0,509 / 0,000 | 0,441 / 0,527 / 0,000 |
| Exactitude « vert ou pas vert » | 74 % (111/150) | 73 % (110/150) | 75 % (112/150) |
| Part de gris (verdict écarté, « non vérifié ») | — | 15 % (23/150) | — |
| Exactitude sur les paires non grises | — | 43 % (54/127) | — |

Intervalles de confiance à 95 % (Wilson) : faux verts A 20 à 38 %, B 1 à 9 % ; verts confirmés A 65 à 87 %, B 16 à
40 %. Les deux écarts sont nets. Appariement : les 3 faux verts de Visa sont aussi des faux verts du modèle seul ;
Visa évite 25 des 28 faux verts de A et n'en crée aucun (test de McNemar exact, p ≈ 6 × 10⁻⁸).

Matrices de confusion (lignes = étiquette attendue, colonnes = réponse) :

| A, modèle seul | Entailment | Contradiction | NotMentioned |
|---|---|---|---|
| Entailment | 39 | 11 | 0 |
| Contradiction | 7 | 43 | 0 |
| NotMentioned | 21 | 20 | 9 |

| B, Visa | Entailment | Contradiction | NotMentioned | gris |
|---|---|---|---|---|
| Entailment | 13 | 32 | 0 | 5 |
| Contradiction | 2 | 41 | 0 | 7 |
| NotMentioned | 1 | 38 | 0 | 11 |

### Qualité des preuves de Visa

Sur les 100 paires Entailment ou Contradiction (les seules qui ont des passages de preuve officiels), l'extrait cité
par l'avocat adverse a été retrouvé mot pour mot 88 fois. Parmi ces 88 :

- **93 % (82/88) recoupent un passage de preuve officiel du jeu** ;
- 90 % des caractères de l'extrait tombent dans un passage de preuve (moyenne) ;
- 89 % des passages touchés sont des passages de preuve ; l'extrait couvre 69 % des passages de preuve en moyenne
  (un seul extrait, alors que la preuve officielle compte souvent plusieurs passages).

Sur les 54 verdicts justes, mêmes ordres de grandeur (93 % recoupent la preuve officielle). Quand Visa cite, il cite
le bon endroit.

### Pourquoi l'exactitude de Visa baisse

1. **Visa n'a pas de vraie case « non mentionné ».** Sur 150 verdicts, l'avocat adverse n'a jamais répondu
   HORS_SUJET : quand le contrat ne parle pas de la question, il répond NE_SOUTIENT_PAS (« le texte ne dit pas
   cela »), traduit en Contradiction. D'où un F1 NotMentioned nul. Pour Visa, ce n'est pas grave (rien n'est vert),
   pour ContractNLI c'est une erreur.
2. **L'avocat adverse chicane les affirmations vraies.** 26 des 50 paires Entailment reçoivent PARTIEL : l'hypothèse
   du jeu est volontairement générale (« peut partager des informations avec des tiers »), le contrat ajoute des
   conditions, et Visa signale l'omission. Dans l'app, c'est un orange « à revoir », pas un rouge ; pour le jeu,
   c'est une erreur. Le phénomène se concentre sur quatre hypothèses (partage avec les salariés, usage limité,
   notification en cas de divulgation forcée, partage avec des tiers).
3. **Le garde-fou écarte 15 % des verdicts.** Causes : 10 citations coupées par « [...] », 8 extraits vides (le juge
   ne cite rien quand il conclut que le texte n'en parle pas), 5 citations où le juge a omis ou changé quelques
   mots. Analyse complémentaire, sans nouvel appel : en acceptant une citation coupée par « [...] » dont chaque
   morceau figure mot pour mot dans l'ordre, les gris passent de 23 à 15 et l'exactitude de 36 % à 39 %, sans aucun
   faux vert de plus (toujours 3).

## Trois exemples

**1. Visa évite un faux vert (paire `357:nda-17`, attendu Contradiction).** Hypothèse : « Receiving Party may create
a copy of some Confidential Information in some circumstances. » Le modèle seul répond Entailment. Visa répond
PARTIEL et cite, mot pour mot : « Unless expressly authorized in writing by the Disclosing Party, the Receiving Party
agrees to retain the Confidential Information in confidence and shall not copy or disclose the Confidential
Information ». L'extrait tombe entièrement dans le passage de preuve officiel du jeu. Pas de vert, et la preuve est
la bonne.
Ce n'est pas le garde-fou qui a joué ici (l'extrait est vérifié), c'est la posture d'avocat adverse : aucun faux
vert de ce passage n'a été évité par le garde-fou seul.

**2. Le garde-fou coûte un vert juste (paire `606:nda-3`, attendu Entailment).** Hypothèse : « Confidential
Information may include verbally conveyed information. » Visa répond SOUTIENT, à raison, mais son extrait saute
deux mots du contrat (« its Representatives (defined below) to the Receiving Party » devient « its Representatives
to the Receiving Party »). Le garde-fou rejette l'extrait : gris, « à vérifier à la main ». C'est le comportement
voulu (sans preuve exacte, pas de vert), mais il a un coût : 2 verts justes perdus sur ce passage.

**3. Erreur de Visa : un faux vert avec une preuve vérifiée (paire `606:nda-4`, attendu Contradiction).**
Hypothèse : « Receiving Party shall not use any Confidential Information for any purpose other than the purposes
stated in Agreement. » Visa répond SOUTIENT et cite, mot pour mot : « shall not use Confidential Information for any
purpose other than in connection with the Evaluation ». La citation existe bien, mais une autre clause du contrat la
contredit : « either party shall be free to use for any purpose the residuals (defined below) resulting from access
to or work with Confidential Information » (c'est le passage de preuve officiel). Même erreur sur `521:nda-4`.
Leçon : le garde-fou prouve que la citation existe, pas qu'aucune autre clause ne la contredit. C'est la « négation
par exception » que les auteurs du jeu décrivent comme la difficulté principale des contrats.

## Méthode

- **Jeu** : ContractNLI, Koreeda et Manning, « ContractNLI: A Dataset for Document-level Natural Language Inference
  for Contracts », Findings of EMNLP 2021 (https://stanfordnlp.github.io/contract-nli/). Licence CC BY 4.0
  (fichier `LICENSE` du zip, vérifié), conditions d'usage de Hitachi America (fichier `TERMS`). Zip officiel
  téléchargé le 4 octobre 2026 dans `~/lab-claude-code/contractnli/` (SHA-256
  `e03fc77bbf8b53e2976a250e81d8a294bc3d5e5fb014521e477dee9340d6287b`), avec l'article.
- **Échantillon** : split de test (123 contrats, 2 091 paires : 968 Entailment, 220 Contradiction, 903 NotMentioned).
  Paires triées par contrat puis hypothèse, tirage de Fisher-Yates avec le générateur mulberry32 et la graine
  20261004, 50 par étiquette, entrelacées. La liste des 150 identifiants est dans le fichier de résultats.
- **A, modèle seul** : un prompt court qui demande Entailment, Contradiction ou NotMentioned en JSON, l'hypothèse et
  le contrat entier.
- **B, Visa** : `PROMPT_JUGE` de `src/lib/moteur.ts`, inchangé (seul ajout : il est exporté). Message au format de
  Visa : AFFIRMATION = l'hypothèse, SOURCE CITÉE = le contrat, TEXTE OFFICIEL = le contrat entier. Puis
  `jugementVerifie` de `src/lib/controles.ts` (garde-fou `contientVerbatim`). Correspondance : SOUTIENT → Entailment ;
  NE_SOUTIENT_PAS et PARTIEL → Contradiction ; HORS_SUJET → NotMentioned ; extrait introuvable → gris.
- **Faux vert** : paire NON Entailment déclarée Entailment. Un gris n'est jamais un faux vert.
- **F1 macro** : moyenne des F1 des trois étiquettes ; un gris compte comme une erreur.
- **Qualité des preuves** : l'extrait retrouvé est replacé dans le contrat (même normalisation que le garde-fou),
  puis comparé aux passages de preuve officiels du jeu, en caractères et en passages (phrases ou items, découpage
  officiel). Si l'extrait apparaît plusieurs fois, on garde la meilleure occurrence.
- **Appels** : température 0, mode JSON, séquentiels, espacés de 4,5 s (limite de 15 requêtes par minute, partagée
  avec les autres mesures de l'équipe), relancés sur 429 et erreurs serveur, gardés en cache dans
  `app/.cache/contractnli/` : relancer `bun scripts/contractnli.ts` reprend après une coupure et rejoue à l'identique.

## Durée et coût

300 appels, 801 720 jetons en entrée et 45 610 en sortie, soit **environ 0,47 $** au prix de Mistral Large repris de
`scripts/eval.ts` (0,50 $ et 1,50 $ par million de jetons ; prix non revérifié). **54 minutes** de bout en bout pour
le passage complet (plus 41 s de pilote sur 3 paires), dont 19 minutes de temps de réponse cumulé de Mistral ; le
reste est de l'attente due à la limite de débit (65 refus 429, tous relancés, aucune erreur finale). Le fichier de
résultats a ensuite été régénéré depuis le cache (0 appel) pour ajouter l'analyse des gris : les chiffres sont
identiques.

## Comparaison avec les scores publiés

L'article (tableaux 3 et 4) rapporte, sur tout le split de test, avec des modèles **entraînés** sur le split
d'entraînement :

| Système | Exactitude | F1 Contradiction | F1 Entailment |
|---|---|---|---|
| Vote majoritaire | 0,674 | 0,083 | 0,428 |
| Span NLI BERT large (le modèle des auteurs) | 0,875 | 0,357 | 0,834 |
| DeBERTa v2 xlarge affiné sur CUAD (meilleur score de l'article) | 0,892 | 0,405 | 0,859 |

Ces chiffres **ne se comparent pas directement** aux nôtres : leurs modèles sont entraînés sur ce jeu, ils notent les
2 091 paires dans leur proportion réelle (11 % seulement de Contradiction), et ils moyennent par hypothèse. Notre
échantillon est équilibré, ce qui gonfle le F1 Contradiction. Pour situer quand même : en repondérant le rappel de
chaque étiquette par sa part réelle dans le test, l'exactitude estimée serait d'environ 53 % pour le modèle seul et
21 % pour Visa, sous le vote majoritaire. Ce n'est pas la question que Visa cherche à résoudre (Visa veut ne jamais
mettre un faux vert, pas classer en trois cases), mais il faut le dire. Je n'ai pas cherché de scores publiés de
modèles génériques sans entraînement sur ContractNLI : aucun chiffre de ce type n'est cité ici.

## Limites

- **Le jeu ne pose pas la question de Visa.** ContractNLI demande trois cases ; Visa répond « la source dit-elle
  cela ? ». L'absence de mention et la contradiction tombent toutes deux dans NE_SOUTIENT_PAS, et PARTIEL a été
  compté comme Contradiction. Les chiffres « faux verts », « fiabilité des verts » et « vert ou pas vert » sont ceux
  qui correspondent à l'usage de Visa ; l'exactitude à trois étiquettes le désavantage par construction.
- **Petit échantillon** : 150 paires, 50 par étiquette, une seule graine, un seul modèle, un seul passage
  (température 0, mais Mistral n'est pas parfaitement déterministe). Les écarts sur les faux verts et les verts
  confirmés sont nets ; les petits écarts (par exemple 73 % contre 74 % en « vert ou pas vert ») ne le sont pas.
- **Langue** : prompts en français, contrats et hypothèses en anglais. Le prompt de Visa a été écrit pour du droit
  français et des sources officielles, pas pour des contrats américains.
- **Contrat entier** : l'app Visa coupe le texte officiel à 15 000 caractères ; ici les deux conditions reçoivent le
  contrat entier (37 des 150 paires portent sur un contrat plus long). Visa tel quel aurait perdu des preuves sur
  ces paires.
- **Étiquettes du jeu** : certaines paraissent discutables à la relecture (par exemple `452:nda-16`, où le contrat
  impose bien de rendre les informations, étiqueté Contradiction). Je n'ai rien corrigé : les étiquettes officielles
  font foi.
- **Garde-fou** : il vérifie qu'une citation existe, pas qu'elle suffit. L'exemple 3 montre qu'un extrait exact peut
  fonder un faux vert quand une autre clause le contredit.
- **Prix** : repris du script de la première preuve, non revérifié sur mistral.ai.

## Ce que ça suggère pour Visa (non testé)

- Accepter les citations coupées par « [...] » si chaque morceau est exact et dans l'ordre : 8 gris en moins sur ce
  passage, aucun faux vert en plus.
- Demander à l'avocat adverse de chercher aussi une clause contraire avant de dire SOUTIENT (exemple 3).
- Distinguer « le texte n'en parle pas » de « le texte dit le contraire » dans les verdicts, pour qu'un rouge soit
  plus parlant.
