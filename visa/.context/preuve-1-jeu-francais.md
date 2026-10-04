# Preuve 1 : Visa mesuré sur un jeu de test en droit français

Mesure du 4 octobre 2026. Jeu : `app/src/eval/jeu-fr.ts` ; preuve des étiquettes : `app/scripts/prouver-jeu.ts` ;
mesure : `app/scripts/eval.ts` ; résultats détaillés : `app/src/eval/resultats-passage-a.json` et
`app/src/eval/resultats.json` (passage B). **Le jeu n'a pas encore été relu par un juriste** (voir la fin).

## En une phrase

Sur 58 affirmations juridiques dont chaque étiquette est prouvée sur Légifrance, Visa a signalé **les 30 affirmations
fausses** et n'en a mis **aucune en vert**, à chaque passage. Il n'a mis en rouge qu'une seule affirmation juste, et
seulement dans un passage sur deux : un arrêt trop long pour son juge. Son défaut : il est trop prudent. Environ une
affirmation juste sur deux finit en orange « à revoir » au lieu de vert.

## Les chiffres

Deux mesures complètes, sur un cache vide, avec le code final (correctifs ci-dessous) :

| | Passage A | Passage B |
|---|---|---|
| **Détection** : fausses (rouge ou orange attendu) que Visa ne met pas en vert | **100 % (30/30)** | **100 % (30/30)** |
| dont mises en rouge ou orange (le gris « à vérifier » exclu) | 100 % (30/30) | 100 % (30/30) |
| **Faux verts** : affirmations non vertes attendues (rouge, orange, gris) mises en vert | **0 / 33** | **0 / 33** |
| **Faux rouges** : affirmations justes mises en rouge | **0 / 25** | **1 / 25** (N1-7) |
| Affirmations justes confirmées en vert | 48 % (12/25) | 48 % (12/25) |
| Exactitude (même couleur qu'attendu) | 74 % (43/58) | 74 % (43/58) |
| Affirmations que Mistral n'a pas découpées | 0 / 58 | 0 / 58 |

Matrice du passage A (lignes = attendu, colonnes = obtenu) :

| attendu ↓ / obtenu → | vert | orange | rouge | gris |
|---|---|---|---|---|
| vert (25) | 12 | 12 | 0 | 1 |
| orange (8) | 0 | 8 | 0 | 0 |
| rouge (22) | 0 | 2 | 20 | 0 |
| gris (3) | 0 | 0 | 0 | 3 |

Exactitude par type d'erreur (passage A) :

| Type | Attendu | Exactes | Signalées | Faux verts |
|---|---|---|---|---|
| Décision inventée | rouge | 4/4 | 4/4 | 0 |
| Article inexistant | rouge | 4/4 | 4/4 | 0 |
| Pas en vigueur à la date des faits | rouge | 4/4 | 4/4 | 0 |
| La source ne dit pas ça | rouge | 8/10 | 10/10 | 0 |
| Texte modifié depuis les faits | orange | 5/5 | 5/5 | 0 |
| Circulaire invoquée comme obligatoire | orange | 3/3 | 3/3 | 0 |
| Référence floue ou absente | gris | 3/3 | 3/3 | 0 |
| Affirmation juste | vert | 12/25 | — | — |

Modèles : `mistral-large-latest` (= `mistral-large-2512`) pour le découpage et pour le juge.
Coût : environ 0,06 $ pour les 58 affirmations, à chaque passage (53 appels, 51 000 jetons en entrée et 23 000 en
sortie, prix public 0,5 $ / 1,5 $ par million). Durée : 8 et 13 minutes pour les 9 notes (passages A et B), 5 minutes
quand la clé n'est pas partagée. Le temps est dicté par la limite de la clé : 15 requêtes par minute sur Mistral Large,
partagée avec les autres agents de l'équipe (22 à 27 refus « trop de requêtes » relancés par passage).
Entre les passages A et B, une autre session a modifié `moteur.ts` pour ajouter la boucle de correction. Le juge et le
découpage n'ont pas changé.

## Le jeu de test

9 mini-notes « écrites par une IA » : licenciement (2023 et 2016), embauche, CDD et rupture conventionnelle,
contrat de distribution (2022), contrat conclu en 2015, achat en ligne, bail d'habitation, harcèlement moral (2011),
procédure civile. Chaque note a sa date des faits. Au total, 58 affirmations, chacune avec sa source citée.

| Étiquette | Nombre | Types |
|---|---|---|
| vert | 25 (43 %) | article ou arrêt réel, en vigueur à la date des faits, qui dit bien cela |
| rouge | 22 (38 %) | 4 articles inexistants, 4 décisions inventées, 4 textes pas en vigueur, 10 « ne dit pas ça » (chiffre, durée, condition faux) |
| orange | 8 (14 %) | 5 textes modifiés depuis les faits (la version des faits soutient l'affirmation), 3 circulaires présentées comme obligatoires |
| gris | 3 (5 %) | « jurisprudence constante », « la doctrine majoritaire », « les juges du fond admettent » |

Sources : Code du travail, Code civil, Code de la consommation, Code de procédure civile, Code pénal, loi du
6 juillet 1989, 6 arrêts réels de la Cour de cassation (dont Chronopost, Myr'Ho, l'arrêt du 11 mai 2022 sur le
barème), 3 circulaires réelles.

**Chaque étiquette est prouvée sur les bases officielles** par `bun scripts/prouver-jeu.ts` (58/58), sans modèle :

- existence de l'article ou de la décision (Légifrance, Judilibre) ; date réelle de la décision ;
- version applicable à la date des faits, avec ses dates de début et de fin, et contrôle de date attendu ;
- un extrait **mot pour mot** de cette version qui fonde l'étiquette (par exemple « cinq jours ouvrables » contre les
  « deux jours » affirmés), et pour un texte modifié, un extrait qui n'existe que dans la version actuelle ;
- inexistence : introuvable par Visa **et** absent de la recherche Légifrance des codes, à la date des faits et
  aujourd'hui ; décisions inventées : introuvables sur Légifrance (fonds JURI) et Judilibre ;
- circulaires : intitulé exact retrouvé dans le fonds des circulaires de Légifrance ;
- deux témoins (un article et un arrêt réels) retrouvés par la même méthode.

Le détail (lien Légifrance, version, extrait) est dans `app/src/eval/preuves.json`.

## Méthode

1. `verifierTexte()` est lancé sur chaque note, une par une, avec sa date des faits, sur un cache vide (rien n'est rejoué).
2. Chaque affirmation découpée par Mistral est reliée à l'affirmation attendue par recouvrement des mots du passage
   (sans les mots vides ni « article », « code »…). Un morceau d'affirmation est rattaché à son affirmation ;
   une affirmation qui en fusionne deux est rattachée aux deux. La couleur retenue est la pire des morceaux qui citent
   une source. Les phrases de faits (« Mme Durand a été licenciée le… ») ne correspondent à rien et sont listées à part.
3. Définitions : *détection* = fausses (rouge ou orange attendu) que Visa ne met pas en vert, une affirmation non
   découpée compte comme ratée ; *faux vert* = toute affirmation attendue non verte que Visa met en vert ;
   *faux rouge* = affirmation juste mise en rouge.
4. Seule la première vérification est mesurée. La boucle de correction (le rédacteur réécrit le mémo, puis Visa
   revérifie), ajoutée cet après-midi par une autre session, est arrêtée avant de démarrer.
5. Les pannes passagères du bac à sable PISTE (erreur 429, erreur 5xx, délai dépassé) sont relancées par le script de
   mesure. Sans cette relance, voir « Stabilité ».

Tests sans réseau du calcul (rattachement, matrice, taux) et de la cohérence du jeu : `src/eval/mesure.test.ts`.

## Où Visa se trompe (passage A)

| Affirmation | Attendu → obtenu | Cause |
|---|---|---|
| N1-3 préavis de deux mois (L1234-1) | vert → orange | Juge : « partiel », car la convention collective peut prévoir mieux. Nuance réelle mais secondaire. |
| N1-5 barème L1235-3, 4 ans = 3 à 5 mois | vert → gris | Juge : l'article est un tableau ; l'extrait cité (« 4 \| 4 \| 3 \| 5 ») n'existe pas mot pour mot, verdict écarté. Garde-fou correct. |
| N1-7 Cass. soc. 11 mai 2022, barème compatible avec l'OIT | vert → orange (A), **rouge (B)** | Juge : il ne lit que les 15 000 premiers caractères. La conclusion de l'arrêt (§ 22) est au-delà ; au passage B, il a conclu « ne soutient pas ». **Seul faux rouge vu sur toutes les mesures**, toujours celui-ci. |
| N3-2 renouvellement de la période d'essai (L1221-21) | vert → orange | Juge trop strict (« l'accord fixe aussi les conditions »). |
| N3-3 indemnité de fin de CDD de 10 % (L1243-8) | vert → orange | Juge : « pas due dans tous les cas » (exceptions de L1243-10). Défendable. |
| N3-5 homologation en 15 jours ouvrables (L1237-14) | vert → orange | Juge trop strict. |
| N6-2 garantie de conformité de deux ans (L217-3) | vert → orange | Juge : exceptions pour les biens numériques. Trop strict. |
| N6-3 clauses abusives (L212-1) | vert → orange | Juge : il manque « ou pour effet ». Trop strict. |
| N6-4 prescription biennale (L218-2) | vert → orange | Juge : le texte dit « biens ou services ». Trop strict. |
| N7-3 bail de trois ans (art. 10 loi 1989) | vert → orange | Juge : exceptions (ANAH). Trop strict. |
| N8-2 harcèlement moral (L1152-1) | vert → orange | Juge : la définition omise « susceptible de porter atteinte… ». Défendable. |
| N9-3 délai d'appel d'un mois (art. 538 CPC) | vert → orange | Juge : le texte parle de « recours par une voie ordinaire ». Trop strict. |
| N9-5 Cass. 2e civ. 17 sept. 2020 | vert → orange | Juge : la règle ne vaut que pour les appels formés après l'arrêt (§ 5). Nuance réelle. |
| N4-7 Chronopost « seulement en cas de faute lourde » | rouge → orange | Juge : « partiel » alors que l'arrêt dit l'inverse. Signalé, mais pas assez fort. |
| N7-2 prescription « cinq ans » (art. 7-1 loi 1989, réel : trois) | rouge → orange | Juge : « partiel » alors que le chiffre est faux. Signalé, mais pas assez fort. |

En résumé : **le découpage (Mistral) et la recherche des sources ne ratent rien** sur ce jeu. Toutes les
erreurs viennent du juge. Il répond « partiel » sur des détails, et parfois sur un chiffre faux. Ce n'est jamais
dangereux (pas de faux vert), mais c'est du bruit pour l'avocat.

## Correctifs apportés pendant la mesure (dans le code, pas encore commités)

1. **Code de procédure civile lu comme Code civil** (`codeVersLegitext`, `src/lib/sources.ts`). « procedure civile »
   contient « civil », testé en premier. L'article 9 du CPC renvoyait l'article 9 du Code civil (vie privée), et
   l'article 700 un article sur les servitudes. Même problème pour le Code de procédure pénale, lu comme le Code pénal.
   Sans correctif, les 5 citations du Code de procédure civile du jeu étaient cherchées dans le Code civil.
2. **Articles de lois non codifiées toujours en gris** (`chercherTexte`). Visa envoyait à Légifrance l'identifiant
   d'une version (« LEGITEXT…_07-03-2007 ») au lieu de l'identifiant du texte, d'où une erreur 400, prise pour une
   base injoignable. Et même corrigé, Visa lisait la loi entière dans sa version de 1989. Maintenant, « article 22 de
   la loi n° 89-462 » est cherché comme un article, avec ses versions (contrôle de date compris).
3. `cache.ts` : dossier de cache réglable (`VISA_CACHE_DIR`), pour mesurer sur un cache neuf sans toucher au cache de la démo.

Tests ajoutés dans `src/lib/regles.test.ts`. Sans le correctif 2 (passage 1), les 3 affirmations du bail sur la
loi de 1989 sortaient en gris.

## Stabilité

| Passage | Code | Détection | Faux verts | Faux rouges | Justes en vert |
|---|---|---|---|---|---|
| 1 | avant le correctif 2 | 30/30 | 0 | 0 | 11/25 |
| 2 | sans relance PISTE | 30/30 | 0 | 1 (N1-7) | 13/25 |
| 3 | sans relance PISTE | 30/30 | 0 | 0 | 11/25 |
| A | final | 30/30 | 0 | 0 | 12/25 |
| B | final | 30/30 | 0 | 1 (N1-7) | 12/25 |

Un autre passage, lancé pendant que l'autre session ajoutait la boucle de correction, a mesuré un code en cours de
modification. Il a été écarté (ses chiffres étaient pourtant identiques à ceux du passage A).

Aux passages 2 et 3, le bac à sable PISTE a eu des pannes (3 puis 10 affirmations en gris « base injoignable »).
Visa a bien mis du gris, jamais du vert. Mais en démo, une panne PISTE se voit : `piste.ts` ne relance pas.
La couleur d'une même affirmation varie d'un passage à l'autre seulement sur les cas limites du juge (N1-7, N3-5, N6-3, N9-5).

## Limites (à dire si on présente ces chiffres)

- **Jeu construit par un agent, pas par des juristes.** Chaque étiquette est prouvée mécaniquement sur le texte
  officiel, mais le jugement « juste / ne dit pas ça » est le mien. Relecture juriste nécessaire.
- **Petit échantillon.** 0 faux vert sur 30 fausses, c'est une borne haute d'environ 10 % à 95 % de confiance (règle de trois).
- **Notes plus propres qu'une vraie réponse d'IA** : une affirmation par paragraphe, références bien formées.
  Une vraie réponse de ChatGPT mélange plusieurs règles par phrase et cite « L. 1235-3 » sans le code.
- **Décisions inventées faciles** : leurs numéros (19-48.207, 21-44.180…) sont dans une plage que la Cour de cassation
  n'utilise pas. Une vraie hallucination réutilise souvent un vrai numéro avec un autre contenu. Exemple : le
  n° 13-17.983 du mémo de démo existe (2e civ., 19 juin 2014). Visa le traite alors en « ne dit pas ça » et en date fausse.
- **Circulaires** : Visa ne les cherche pas ; il les met en orange par principe. Une circulaire inventée serait orange,
  pas rouge. Non testé ici. Le contenu attribué aux circulaires n'est pas vérifié.
- **Judilibre en bac à sable** : une partie seulement des décisions. L'inexistence est prouvée sur Légifrance (JURI) et
  sur ce Judilibre-là.
- **Non testé** : pièces du dossier, décisions administratives, décrets et arrêtés, codes absents de la liste de Visa
  (Code de l'organisation judiciaire, etc. : gris « non identifiable »), date des faits détectée dans le texte (ici,
  elle est fournie), décisions longues autres que celle du 11 mai 2022.
- Le rattachement des affirmations est heuristique. Vérifié à la main au passage A : chaque affirmation attendue
  retrouve la bonne. Une phrase de faits (« Son contrat comporte une clause de non-concurrence… ») est aussi rattachée
  à N2-5, sans effet sur sa couleur, puisqu'elle ne cite aucune source. Deux autres phrases de faits restent hors jeu.

## Ce qu'il faudrait faire ensuite (par ordre d'effet)

1. **Juge** : réserver « partiel » aux omissions qui changent la solution, et classer un chiffre ou une durée contraire
   en « ne soutient pas ». Cela ferait passer environ 10 affirmations justes d'orange à vert.
2. **Juge** : sur les décisions longues, lui donner le passage pertinent ou tout le texte, pas les 15 000 premiers
   caractères. C'est la seule cause de faux rouge observée.
3. `piste.ts` : relancer une ou deux fois sur 429, 5xx ou délai dépassé.
4. Agrandir le jeu avec de vraies réponses de ChatGPT et Mistral relues par les juristes.

## Étiquettes à faire relire par un juriste

- **N1-3** (L1234-1, préavis) : vert, alors que le juge signale la réserve des conventions plus favorables.
- **N1-5** (barème L1235-3) : 4 ans complets entre le 3 septembre 2018 et le 15 juin 2023, soit 3 à 5 mois selon le tableau.
- **N3-3** (L1243-8) : vert malgré les exceptions de L1243-10 ; **N8-2** (L1152-1) : définition abrégée.
- **N9-5** (2e civ. 17 sept. 2020) : vert, mais l'arrêt diffère l'application de la règle dans le temps (§ 5).
- **N9-4** (art. 909 CPC) : orange « texte modifié » alors que le délai de trois mois est inchangé (réécriture de forme en 2024).
- **N9-2** (art. 750-1 CPC) : rouge « pas en vigueur » au 10 janvier 2023 (annulé par le Conseil d'État le
  22 septembre 2022, rétabli en mai 2023). À confirmer, vu l'effet rétroactif de l'annulation.
- **N5-1, N5-2** (art. 1112-1 et 1195 pour un contrat de 2015) : rouge « pas en vigueur ». L'article 1195 existait
  en 2015 avec un autre contenu.
- **N2-1 à N2-3** (faits de 2016) : orange, car juste à l'époque. La prescription de deux ans (L1471-1) dépend aussi
  des règles transitoires de 2017.
- **N4-7** (Chronopost) : rouge, car l'affirmation dit l'inverse de l'arrêt. Le juge de Visa dit « partiel ».
- **N3-6, N3-7, N6-6** : les circulaires existent, mais le contenu qu'on leur prête n'est pas vérifié.

## Pour relancer

```bash
cd visa/app
bun scripts/prouver-jeu.ts     # preuve des étiquettes sur Légifrance (sans modèle, ~3 min)
bun scripts/eval.ts            # mesure complète sur cache neuf (5 à 15 min selon la limite Mistral)
bun scripts/eval.ts --notes N1,N4 --sans-relance-piste
```
