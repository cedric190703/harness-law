# Visa — due diligence tracée

**Pour chaque information du rapport, Visa montre le chemin qui y mène :
les documents parcourus, celui qui a été retenu, la page et la clause, et
l'extrait affiché à côté du texte rédigé.**

Il dit aussi ce qu'il a écarté et pourquoi, et ce qu'il n'a pas pu lire.

```bash
npm install
cp .env.example .env     # puis renseignez vos clés
npm run dev              # http://localhost:5180
npm test                 # typecheck + jeu de test
```

## Le problème

En due diligence, les juristes passent l'essentiel de leur temps sur ce qui
n'est pas du droit : naviguer une data room dont la structure leur est imposée,
trier des fichiers mal nommés, écarter les doublons et les brouillons, rattacher
les avenants aux contrats qu'ils modifient, puis lire chaque document en entier
pour en extraire quelques clauses.

Les outils d'IA accélèrent l'extraction mais **déplacent le problème** : sans
renvoi au passage exact et sans indication de ce qui n'a pas été lu, le juriste
doit rouvrir les documents pour tout contrôler.

**Notre but n'est pas de supprimer la vérification — elle reste sa
responsabilité — mais de la rendre rapide.** Le juriste ne refait pas la
recherche : il suit un raisonnement déjà tracé, et confirme ou corrige en
quelques secondes. Le temps rendu retourne là où est sa valeur : apprécier la
matérialité d'un risque, croiser les chantiers, repérer ce qui manque, et
traduire les constats en garanties, conditions suspensives ou ajustement de prix.

## La règle qui tient tout

> **Un constat n'entre au rapport que si le passage sur lequel il repose existe
> mot pour mot dans le document nommé.**

Un constat non appuyé est **rejeté**, et le rejet est consigné à l'écran. Le
juriste voit donc toujours soit une preuve, soit un trou. Jamais une affirmation
flottante.

Deux corollaires que l'interface porte partout :

- **Ce qui n'est pas prouvé est marqué « non établi ».** Le contrat de
  crédit-bail garanti est au dossier mais illisible : Visa dit qu'il ne peut pas
  établir l'encours, et ne reprend pas le chiffre avancé par le vendeur.
- **Un passage lu par machine n'a pas la force d'un passage lu dans un fichier.**
  Les constats issus d'un scan portent la mention « lu par reconnaissance » et
  demandent confirmation sur l'original.

## Un écran, deux volets

Il n'y a pas de menu à six entrées, pas d'écran à retrouver. **Le juriste lit son
rapport à gauche et vérifie à droite.**

```
┌─ Visa · Projet Sodimex · 16/21 lues · 1 non lue · 3 critiques · 4/20 relus ─ ⟳ ─┐
├────────────────────────────────────┬───────────────────────────────────────────┤
│ LE RAPPORT                         │ [ La preuve ] [ Le parcours ] [ Les pièces ]│
│ lu comme un document               │                                           │
│                                    │  ┌─ ce que dit la pièce ─┬─ ce qui est ─┐ │
│ ⌐ 16 pièces dépouillées sur 21 ¬   │  │  « extrait copié »    │   rédigé     │ │
│   1 non lue · 2 écartées           │  └───────────────────────┴──────────────┘ │
│   13 demandes sans réponse         │  le chemin · le droit · au contrat        │
│                                    │                                           │
│ ## Corporate                       ├───────────────────────────────────────────┤
│ ▌La garantie couvre la dette d'un  │ Journal des agents (en direct)            │
│  tiers…                 CORP-03.2  │ 11:56:45 Chercheur cherche « sûretés »… │
└────────────────────────────────────┴───────────────────────────────────────────┘
```

**À gauche, le rapport.** Pas une liste de fiches : le rapport lui-même, avec ses
intertitres et ses paragraphes. Les passages qui viennent d'un constat portent
leur numéro en exposant et s'ouvrent d'un clic. Ce qui n'a pas été lu est posé en
tête, avant les conclusions, parce que cela les borne.

**À droite, trois onglets et rien de plus.**

- **La preuve** — l'extrait de la pièce et le texte rédigé côte à côte, même
  largeur. Puis le chemin, le droit applicable, la clause proposée. On corrige la
  rédaction et on marque relu sans quitter l'écran.
- **Le parcours** — une ligne par pièce, un point par passage, de gauche à droite
  dans le temps. Une ligne pleine : la pièce a servi. Une ligne creuse : elle a
  été ouverte et n'a rien donné.
- **Les pièces** — le versement, la liste, les exports.

**Sous le volet droit, le journal des agents**, en direct pendant un passage.
Huit acteurs nommés — Trieur, Lecteur, Cadreur, Chercheur, Règles, Droit,
Contradicteur, Rédacteur — et chaque ligne qui a établi un constat y mène.

## Le harnais

Sept étapes, chacune consignée dans la trace de l'audit.

| Acteur | Ce qu'il fait | Avec quoi |
|---|---|---|
| **Trieur** | Ouvre chaque fichier, écarte doublons et brouillons avec leur motif | lecture locale |
| **Lecteur** | Lit les scans sans couche de texte | `mistral-ocr-latest` |
| **Cadreur** | Confronte ce qui est arrivé à la liste de demandes | lecture locale |
| **Chercheur** | Cherche les clauses, question par question | motifs |
| **Règles** | Vérifie chaque passage mot pour mot et établit le constat | barrière mot pour mot |
| **Droit** | Contrôle que la clause relevée tient en droit | Légifrance et Judilibre |
| **Contradicteur** | Éprouve chaque réponse du vendeur contre le registre | confrontation |
| **Rédacteur** | Traduit chaque risque en mécanisme de cession | règles de l'audit |

Chaque action du journal porte les **pièces qu'elle a touchées**. C'est ce qui
permet au schéma du parcours de distinguer une pièce *ouverte* d'une pièce
*exploitée* — et donc de montrer celles qui n'ont rien donné.

L'interface **dit toujours quel moteur a répondu**. Annoncer un modèle qui n'a pas
tourné serait la première entorse à la promesse du produit : le champ `moteur` du
résultat décrit ce qui s'est réellement exécuté, et le bandeau de l'écran 1 le
reprend mot pour mot.

## Les skills

Le savoir-faire est écrit, relisible par un juriste, dans [`skills/`](skills) :

- [**triage-data-room**](skills/triage-data-room/SKILL.md) — aucun fichier écarté
  sans motif vérifiable. Traite les deux formes de doublon, dont la version
  tronquée, qui porte souvent le nom le plus rassurant.
- [**extraction-ancree**](skills/extraction-ancree/SKILL.md) — la barrière mot
  pour mot, les trois comptes (parcourus, consultés, retenu), et la distinction
  entre « non établi » et « fait établi, portée inconnue ».
- [**constat-vers-cession**](skills/constat-vers-cession/SKILL.md) — le choix du
  mécanisme : garantie, condition suspensive ou ajustement de prix.

## La data room de démonstration

21 fichiers, qui reproduisent ce qu'un juriste trouve vraiment :

- le même contrat deux fois, dont une **version tronquée qui a perdu l'article
  14.2** — précisément la clause de changement de contrôle ;
- un **brouillon « ne pas signer »** rangé à côté du bail signé, avec un loyer
  différent ;
- un **avenant séparé** qui porte l'engagement de volume de 4 200 à 5 600 tonnes ;
- un **scan sans couche de texte**, lu par reconnaissance : il révèle une garantie
  autonome de 850 000 € consentie pour la dette d'un **tiers** ;
- un **.pdf corrompu** : le crédit-bail garanti, donc un encours non établi ;
- **six réponses du vendeur, toutes contredites** par les pièces qu'il a
  lui-même versées ;
- 13 lignes de la liste de demandes restées sans réponse.

Aucun document réel, aucune donnée personnelle.

## Ce qui sort de l'application

Trois formats, et chacun répond à un usage différent.

| Sortie | Pour quoi | Ce qu'elle porte |
|---|---|---|
| **Le journal d'audit** (impression → PDF) | La pièce du dossier client | L'étendue de la revue, chaque constat avec son passage et son renvoi, les réponses du vendeur, les clauses, le journal des agents, et la ligne de signature |
| **Le rapport** (`.md`) | Le texte à reprendre dans ses conclusions | L'étendue de la revue en tête, puis les constats par chantier avec leurs renvois en italique |
| **Le tableau** (`.csv`) | Le tableur, pour trier et chiffrer | Une ligne par constat : clé stable, document, clause, page, origine du texte, pièces écartées, passage, rédaction, mécanisme, relu |

Le journal d'audit imprimé n'est pas une copie de l'écran : c'est ce qu'un
relecteur doit pouvoir contrôler **sans l'application**. Un constat ne s'y coupe
jamais entre deux pages, les renvois sont en clair, et la dernière page porte la
signature — parce que la vérification reste celle de l'avocat.

Le rapport et le tableau reprennent **la correction du juriste** quand il en a
écrit une, pas la rédaction d'origine.

## Le jeu de test

`npm run verif` contrôle les promesses du produit, dans l'ordre de leur
importance, sans navigateur :

1. tout passage cité existe **mot pour mot** dans le document nommé ;
2. le renvoi (clause, page, ligne) désigne bien l'endroit du passage ;
3. rien n'a été tiré d'un document illisible ou écarté ;
4. un passage lu par reconnaissance est signalé et demande confirmation, et le
   moteur ne s'attribue jamais un modèle qui n'a pas tourné ;
5. ce qui est affirmé sans preuve est marqué « non établi » ;
6. chaque réponse du vendeur déclarée inexacte est appuyée sur un passage
   retrouvé ;
7. la couverture est exacte — la somme des documents classés égale le nombre de
   fichiers versés, et le compte des non-lus ne peut pas être minoré ;
8. le rapport lu dit la même chose que le registre — même rédaction, même
   gravité, même renvoi — et le schéma ne dit pas qu'une pièce a servi quand rien
   n'en a été tiré ;
9. chaque volet se rend, y compris la preuve de chacun des constats ;
10. un dossier se travaille sur plusieurs jours : relecture et notes survivent à
    un nouveau passage, un versement est annoncé, les identifiants hors périmètre
    sont refusés.

Ce jeu de test a attrapé plusieurs erreurs réelles pendant la construction : des
renvois de clause qui désignaient l'article précédent, un constat qui se déclarait
« non établi » alors que son passage le prouvait, et des identifiants de constat
positionnels auxquels la relecture du juriste se rattachait — un versement les
décalait, et la validation changeait de constat.

Le schéma du parcours a lui aussi servi de contrôle : en montrant une pièce
retenue dont rien n'avait été tiré, il a révélé que les motifs de recherche
exigeaient une espace littérale là où les documents juridiques coupent leurs
lignes. Deux questions d'audit trouvaient le vide en silence.

## Les clés

Les clés vivent dans `.env`, **hors du dépôt**, et **sans préfixe `VITE_`** :
une variable `VITE_*` entre dans le bundle et devient lisible par quiconque ouvre
les outils de développement. Le navigateur n'appelle que notre propre `/api`,
servi par [`server/api.mjs`](server/api.mjs).

| Clé | Pour quoi | État constaté |
|---|---|---|
| `MISTRAL_API_KEY` | reconnaissance de caractères, et extraction assistée | fonctionne |
| `PISTE_CLIENT_ID` / `_SECRET` | Légifrance et Judilibre | fonctionne en bac à sable |
| `PISTE_ENV` | `sandbox` ou `production` | la production refuse ces identifiants |

Le bac à sable PISTE renvoie de **vraies** données : les trois versions datées de
l'article L. 1235-3, et 706 décisions sur la contrepartie financière d'une clause
de non-concurrence.

## Le code

```
server/
  documents.mjs     lecture, pagination, détection de clause, triage, dates d'acte
  sondes.mjs        les questions d'audit — le savoir-faire
  extraction.mjs    le moteur, le pliage des accents, la barrière mot pour mot
  journal.mjs       les huit acteurs, et le schéma du parcours
  redaction.mjs     le rapport en blocs, pour être lu comme un document
  piste.mjs         Légifrance et Judilibre
  mistral.mjs       reconnaissance de caractères, et état réel du modèle
  dossiers.mjs      les dossiers, l'historique, le travail du juriste
  rapport.mjs       les exports .md et .csv
  harnais.mjs       l'enchaînement, la trace, l'écart avec le passage précédent
  api.mjs           les dossiers, l'audit en flux, le versement, les exports
src/
  types.ts          le vocabulaire de l'audit
  store.ts          l'état : le dossier, le constat choisi, l'onglet
  views/Rapport.tsx le volet gauche — le rapport lu comme un document
  views/Preuve.tsx  le volet droit — la pièce et la rédaction côte à côte
  views/Parcours.tsx  le schéma en couloirs
  views/Pieces.tsx  le versement, la liste, les exports
  views/Audit.tsx   la sortie imprimée
  components/Journal.tsx  le journal des agents, en direct
skills/             les trois méthodes
dossiers/sodimex/   le dossier de démonstration : 21 pièces, l'historique
verif/jeuDeTest.tsx le jeu de test
```

## Ce qui reste à faire

- **Extraction assistée par le modèle.** `mistral.mjs` expose
  `chercherPassage` : le modèle propose un passage, qui passe ensuite la même
  barrière mot pour mot. Le branchement dans `extraction.mjs` reste à faire ; les
  motifs tiennent la place en attendant, et le bandeau le dit.
- **Compte PISTE en production.** Le bac à sable est immédiat ; la production est
  une étape à part, au délai non documenté.
- **Relance incrémentale.** Dire ce qui change quand le vendeur verse de nouveaux
  documents, plutôt que de recalculer en silence.
- **Export du rapport** en .docx, avec les renvois en notes de bas de page.

## D'où vient ce produit

Les recherches du matin sont dans [`../recherches/`](../recherches). Le constat
qui a conduit à ce produit : les outils de data room citent l'endroit du
document, mais aucun ne dit ce qu'il n'a pas lu, ni ne vérifie que la clause
relevée tient au regard du droit en vigueur.
