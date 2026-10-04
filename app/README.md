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

## Les six écrans

| | Écran | Ce qu'il répond |
|---|---|---|
| 1 | **La data room** | Qu'est-ce qui a été lu, et qu'est-ce qui ne l'a pas été ? |
| 2 | **Les chantiers** | Que cherche-t-on, et où les conclusions s'arrêtent-elles ? |
| 3 | **Le tableau** | Qu'a-t-on relevé, et d'où cela vient-il ? |
| 4 | **Les constats** | L'extrait et la rédaction côte à côte, avec le chemin complet. |
| 5 | **Les réponses du vendeur** | Que dit-il, et que disent ses propres pièces ? |
| 6 | **Au contrat de cession** | Qu'en fait-on : garantie, condition suspensive, prix ? |

L'écran 4 est le cœur. L'extrait du document et le texte rédigé sont côte à côte,
même largeur, même hauteur : le juriste lit les deux d'un seul regard. En dessous,
le **fil de provenance** se déroule pas à pas —

```
 La question ─► N parcourus ─┬─► ✓ document retenu (clause, page) ─┐
                             ├─► ✕ écarté — version tronquée       │
                             └─► ✕ écarté — brouillon non signé    │
                                                                   ▼
            Le passage copié ─► Ce qui est rédigé ─► Le droit ─► Le contrat
```

## Le harnais

Sept étapes, chacune consignée dans la trace de l'audit.

| Étape | Ce qu'elle fait | Avec quoi |
|---|---|---|
| Triage | Ouvre chaque fichier, écarte doublons et brouillons avec leur motif | lecture locale |
| Reconnaissance | Lit les scans sans couche de texte | `mistral-ocr-latest` |
| Périmètre | Confronte ce qui est arrivé à la liste de demandes | lecture locale |
| Dépouillement | Cherche les clauses, question par question | motifs + barrière mot pour mot |
| Droit | Vérifie que la clause relevée tient en droit | Légifrance et Judilibre |
| Réponses | Éprouve chaque réponse du vendeur contre le registre | confrontation |
| Contrat | Traduit chaque risque en mécanisme de cession | règles de l'audit |

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
8. chaque écran se rend, y compris la fiche de chaque constat.

Ce jeu de test a attrapé deux erreurs réelles pendant la construction : des
renvois de clause qui désignaient l'article précédent, et un constat qui se
déclarait « non établi » alors que son passage le prouvait.

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
  documents.mjs     lecture, pagination, détection de clause, triage
  sondes.mjs        les 15 questions d'audit — le savoir-faire
  extraction.mjs    le moteur et la barrière mot pour mot
  piste.mjs         Légifrance et Judilibre
  mistral.mjs       reconnaissance de caractères, et état réel du modèle
  harnais.mjs       les sept étapes et la trace
  api.mjs           /api/audit, /api/document, /api/etat, relance en flux
src/
  types.ts          le vocabulaire de l'audit
  store.ts          l'état : l'écran, le constat ouvert, les filtres
  components/       le fil de provenance, les pièces partagées
  views/            les six écrans et le lecteur de document
skills/             les trois méthodes
dataroom/           les 21 fichiers de démonstration
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
