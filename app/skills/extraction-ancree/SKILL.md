---
name: extraction-ancree
description: "À employer pour tout relevé de clauses dans un lot documentaire : due diligence, revue de contrats, contrôle de conformité, confrontation d'un document à une référence. Impose que chaque information du rapport porte le chemin qui y mène — documents parcourus, document retenu, clause, page, passage copié — et qu'aucune affirmation n'entre au rapport sans un passage retrouvé mot pour mot. Suppose le triage déjà fait (voir triage-data-room)."
---

# Extraction ancrée

Les outils d'extraction existants vont vite, puis déplacent le problème : sans
renvoi au passage exact et sans indication de ce qui n'a pas été lu, le juriste
doit rouvrir les documents pour tout contrôler. **Le but n'est pas de supprimer
la vérification — elle reste sa responsabilité — mais de la rendre rapide.**

La règle qui tient tout :

> **Un constat n'entre au rapport que si le passage sur lequel il repose existe
> mot pour mot dans le document nommé.**

Un constat non appuyé est rejeté, et le rejet est consigné. Le juriste voit donc
toujours soit une preuve, soit un trou. Jamais une affirmation flottante.

## Étape 1 — Poser les questions avant de lire

L'audit ne se fait pas document par document : il se fait **question par
question**, par chantier. Écrire d'abord la liste des questions, chacune avec
*pourquoi* elle est posée — c'est ce qui permettra au juriste de juger si la
réponse est pertinente.

« Clause de changement de contrôle » n'est pas une question. « L'opération
déclenche-t-elle un droit de résiliation ou un accord à obtenir ? » en est une.

Chantiers usuels : corporate, contrats, social, fiscal, contentieux, données
personnelles. Les constats se croisent entre chantiers : une clause de
non-concurrence nulle au social fonde une demande au contentieux. Noter ces
renvois.

## Étape 2 — Parcourir, puis retenir

Pour chaque question, parcourir **tous** les documents retenus et les avenants.
Distinguer trois comptes, qui n'ont pas le même sens :

- **parcourus** : tous ceux qu'on a ouverts pour cette question ;
- **consultés** : ceux qui contenaient un passage répondant à la question ;
- **retenu** : celui, unique, sur lequel le constat repose.

Afficher les trois. « 15 parcourus, 3 consultés, 1 retenu » dit au juriste que
les 12 autres ont été lus sans rien trouver — ce qui est une information, pas un
silence.

**L'avenant l'emporte sur le contrat d'origine.** Quand les deux répondent, c'est
l'avenant qui donne le texte en vigueur, et le contrat d'origine est écarté avec
le motif « texte d'origine, modifié par un avenant postérieur ».

## Étape 3 — Copier, jamais reformuler

Le passage retenu est **copié** du document. Pas résumé, pas réécrit, pas
normalisé. Entre 15 et 80 mots : assez pour se tenir seul, assez court pour être
lu d'un regard.

Prendre le paragraphe qui porte l'occurrence. S'il dépasse, resserrer sur la
phrase. Ne jamais recoller deux morceaux éloignés : un passage recomposé ne se
retrouvera pas dans le document, et il sera donc rejeté.

Si le passage vient d'un modèle de langue plutôt que d'une recherche par motif,
la règle est la même : **il est ensuite retrouvé dans le fichier, ou rejeté.** Le
modèle accélère la recherche, il ne fonde aucun constat à lui seul.

## Étape 4 — Situer : clause et page

Un renvoi faux coûte plus cher qu'un renvoi absent : il détruit la confiance du
lecteur dans tout le rapport.

**Le piège le plus courant :** chercher l'intitulé qui *précède* le passage. Un
passage commence très souvent par son propre intitulé — « 14.2 — Le contrat sera
résilié… ». Ne regarder que ce qui précède conduit à annoncer l'article 14.1 pour
un passage de l'article 14.2.

Donc : chercher d'abord un intitulé **au début du passage lui-même**, et ne
remonter au précédent qu'à défaut. Une sous-clause numérotée (14.2) emprunte le
titre de son article (« Article 14.2 — RÉSILIATION »).

La page suit la convention du dossier, qu'il faut afficher avec le renvoi. Un
numéro de page sert à retrouver l'endroit, il ne fait pas autorité par lui-même.

## Étape 5 — Dire ce qui a été écarté, et pourquoi

Pour chaque constat, lister les documents consultés mais non retenus, avec le
motif : avenant lu pour établir le texte en vigueur, texte d'origine modifié,
passage proche mais moins précis, doublon tronqué, brouillon non signé.

C'est ce qui permet au juriste de **contester le tri en une seconde** au lieu de
refaire la recherche.

## Étape 6 — Distinguer « non établi » de « non chiffrable »

Deux situations à ne jamais confondre :

- **non établi** : le dossier ne permet pas de prouver le fait. Exemple : le
  montant d'une garantie dont le seul exemplaire est un scan illisible. Alors on
  ne cite aucun passage, on marque le constat « non établi », et **on ne reprend
  pas le chiffre avancé par le vendeur**.
- **fait établi, portée inconnue** : le document prouve le fait, mais la
  conséquence n'est pas chiffrable. Exemple : trois contrats manquent — c'est
  prouvé par la liste d'effectifs ; ce qu'ils contiennent est inconnu. Le constat
  est appuyé normalement, et c'est l'impact qui dit l'incertitude.

Marquer le second « non établi » brouillerait les deux et affaiblirait le
premier.

## Étape 7 — Analyser, du côté du client

Pour chaque constat non conforme, écrire :

- **la valeur relevée**, en une ligne : c'est la cellule du tableau ;
- **la rédaction**, qui paraîtra au rapport : les deux valeurs quand il y a un
  écart, avec leurs renvois ;
- **l'impact pour le client**, chiffré dès que les documents le permettent, en
  montrant le calcul (« 730 tonnes × 58 € = 42 340 € ») ;
- **la gravité** : *critique* (à traiter avant signature), *élevée* (changement
  défavorable important), *moyenne* (négociable), *faible* (information) ;
- **les renvois** vers les constats qui le renforcent.

## Étape 8 — Éprouver les réponses du vendeur

Les réponses du vendeur ne sont pas une source de faits : ce sont des
affirmations à éprouver. Pour chacune, confronter au registre des constats et
conclure : **inexacte**, **non vérifiable** (la pièce manque ou est illisible),
ou **confirmée**.

Une réponse ne peut être déclarée inexacte que si un constat appuyé sur un
passage retrouvé l'établit. Citer ce constat et ce passage.

Quand plusieurs réponses sont contredites, le dire au-delà de chaque point : la
fiabilité générale des déclarations se traduit au contrat, par l'élargissement
des déclarations et garanties et l'allongement de leur durée.

## Étape 9 — La barrière, avant de livrer

Repasser mécaniquement sur le registre et vérifier :

1. tout passage cité existe mot pour mot dans le document nommé ;
2. le renvoi (clause, page, ligne) désigne bien l'endroit du passage ;
3. aucun constat ne tire d'information d'un document illisible ou écarté ;
4. tout ce qui est affirmé sans preuve est marqué « non établi » ;
5. chaque réponse déclarée inexacte est appuyée sur un passage retrouvé ;
6. la couverture est exacte et le compte des non-lus n'est pas minoré.

Tant qu'un de ces six points échoue, le rapport n'est pas livrable.
