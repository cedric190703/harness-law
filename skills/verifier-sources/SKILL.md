---
name: verifier-sources
description: Vérifie chaque affirmation d'une réponse d'IA juridique (mémo, conclusions, note) sur le texte officiel — Légifrance, Judilibre ou les pièces du dossier — et produit une carte HTML des sources (affirmations à gauche, sources à droite, liens verts, orange, rouges ou gris, passage exact au clic). Utiliser sur /verifier-sources, « vérifie les sources de… », « est-ce que ces articles existent », « fais la carte des sources », ou quand on colle une réponse d'IA juridique à contrôler.
---

# /verifier-sources

Tu fais deux choses : **découper** la réponse et **jouer l'avocat adverse**.
Les scripts font le reste : retrouver les textes officiels, contrôler la date
et le rang, vérifier tes extraits mot pour mot et dessiner la carte.

**Règle d'or : sans preuve, rien n'est vert.** Tu ne décides jamais d'une
couleur. Tu ne complètes jamais un texte officiel avec ta mémoire.

## 1. Préparer le dossier

- Choisis un nom court, par exemple `memo-martin`. Le dossier est
  `saul/app/.cache/cartes/<nom>/` : il n'est jamais envoyé sur GitHub.
- Écris-y `reponse.txt` : la réponse à vérifier, **copiée telle quelle**.
- Pièces du dossier (contrat, courrier…) : un fichier texte par pièce dans
  `pieces/`, nommé comme dans la réponse et rangé dans l'ordre des pièces.
  Exemple : `pieces/1 - Contrat de travail.txt`. Pour un .docx ou un .pdf,
  convertis d'abord en texte (`pandoc` ou `pdftotext`).
- Date des faits : prends celle que donne la personne, sinon celle du texte.
  Si aucune n'existe, demande-la. Sans réponse, continue : la carte affichera
  un avertissement.

## 2. Découper : `affirmations.json`

Une affirmation = une règle, une solution de jurisprudence, un délai, un
montant ou un fait tiré d'une pièce. Ignore la politesse et les transitions.

```json
{
  "date_faits": "2016-03-15",
  "affirmations": [
    {
      "passage": "copie EXACTE de la phrase dans reponse.txt",
      "resume": "l'affirmation en une phrase simple",
      "sources": [
        { "brut": "article L. 1235-3 du Code du travail", "type": "article_code",
          "code": "Code du travail", "numero": "L1235-3" },
        { "brut": "Cass. soc., 10 juillet 2002, n° 00-45.135", "type": "decision",
          "juridiction": "Cass. soc.", "date": "2002-07-10", "numero_affaire": "00-45.135" },
        { "brut": "pièce n° 1", "type": "piece", "numero": "1" }
      ]
    }
  ]
}
```

- `passage` : copie caractère pour caractère. Le script refuse une reformulation.
- `type` : `article_code`, `decision`, `loi`, `ordonnance`, `decret`, `arrete`,
  `circulaire`, `piece` ou `autre`.
- Pour une loi ou un décret, mets son numéro dans `numero` (ex. `2017-1387`).
- `sources` : seulement les sources **citées dans la réponse**, à l'appui de
  cette affirmation. Liste vide si rien n'est cité. N'en ajoute jamais.

## 3. Retrouver les sources

```bash
cd saul/app && bun scripts/carte.ts preparer .cache/cartes/<nom> [--date AAAA-MM-JJ]
```

Si le script refuse le découpage, corrige `affirmations.json` et relance. Il
liste ensuite les éléments **à juger** (un fichier `textes/<id>.txt` pour
chacun) et ceux qu'il a déjà tranchés seul : introuvable, circulaire, base non
connectée.

## 4. Jouer l'avocat adverse : `jugements.json`

Pour chaque élément à juger, lis `textes/<id>.txt` en entier. Tu défends la
partie adverse : tu cherches ce qui cloche, sans complaisance.

```json
[
  { "id": "A1-1", "verdict": "SOUTIENT",
    "raisonnement": ["ce que dit l'affirmation", "ce que dit le texte", "l'écart éventuel", "la conclusion"],
    "extrait": "copie EXACTE d'au moins dix mots du texte officiel",
    "correction": "" }
]
```

- `verdict` :
  - `SOUTIENT` : le texte dit bien cela.
  - `PARTIEL` : le texte dit quelque chose de proche, mais l'affirmation exagère ou oublie une condition.
  - `NE_SOUTIENT_PAS` : le texte ne dit pas cela, ou dit le contraire.
  - `HORS_SUJET` : le texte ne traite pas de la question.
- `extrait` : copié **entre les deux lignes de tirets** du fichier. Un extrait
  introuvable mot pour mot fait écarter ton verdict (gris).
- Tu juges **uniquement sur le texte du fichier**, dans la version de la date
  des faits. Si le texte ne permet pas de trancher, réponds `HORS_SUJET`.
- `correction` : ce que dit vraiment le texte, en une phrase. Vide si `SOUTIENT`.

## 5. Conclure et montrer la carte

```bash
cd saul/app && bun scripts/carte.ts conclure .cache/cartes/<nom>
open .cache/cartes/<nom>/carte.html
```

Si le script signale un extrait introuvable, recopie l'extrait exact puis
relance `conclure`. Ne change pas ton verdict pour faire passer un élément au vert.

## 6. Proposer les corrections : `reecritures.json`

`conclure` liste les passages orange ou rouges. Le script tranche seul les cas
sans texte sûr (décision introuvable : « source à trouver » ; circulaire sans
texte de rang supérieur vérifié dans la réponse ; texte pas en vigueur : « à
réécrire à la main »). Pour les autres, il indique « à proposer », avec les
fichiers `textes/<clé>.txt` utilisables et la référence exacte à citer.

```json
[
  { "id": "A4", "source": "A4-1",
    "passage": "le passage réécrit, juste à la date des faits, qui cite la source comme indiqué",
    "extrait": "copie EXACTE d'au moins dix mots du texte de cette source",
    "explication": "une phrase : ce qui change et pourquoi" }
]
```

- Garde la phrase d'origine ; change seulement ce qui est faux ou imprécis.
- Cite uniquement la référence donnée par le script. Toute autre référence
  (article, pourvoi, numéro de texte) fait écarter la proposition.
- Si le texte ne permet pas d'écrire un passage juste, n'écris rien pour cette
  affirmation : elle reste « à réécrire à la main ».

Relance `conclure` : le panneau de détail de la carte montre la proposition
(barré / souligné), sa source et l'extrait vérifié mot pour mot.

## 7. Répondre

En 5 à 8 lignes, en français courant :

- le compte : « 12 affirmations : 7 vérifiées, 3 à revoir, 2 fausses » ;
- une ligne par rouge et par orange, avec la raison en mots simples et la
  correction retenue s'il y en a une ;
- le chemin de la carte ;
- ce qui n'a pas pu être vérifié : base non connectée, date des faits inconnue,
  affirmations sans source.

## Si ça bloque

- « Bases officielles NON connectées » : il manque les clés PISTE dans
  `saul/app/.env.local` (`PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`). Les sources
  officielles restent grises. Les pièces du dossier, elles, sont vérifiées.
- Une base injoignable ou une référence sans numéro donne du gris, jamais du vert.
- Les réponses de Légifrance et Judilibre sont gardées dans `saul/app/.cache/` :
  une carte se rejoue à l'identique, même sans réseau.
