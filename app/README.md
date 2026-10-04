# Visa

**Visa vérifie chaque phrase d'une réponse d'IA juridique sur le texte officiel, et garde la preuve.**

On ne construit pas une IA juridique de plus. On construit le contrôle technique
de toutes les autres : Visa marche sur un texte rédigé avec ChatGPT, Legora,
Hector ou Doctrine, parce qu'il ne regarde que le résultat et les sources.

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # typecheck + jeu de test
```

Visa fonctionne sans aucune clé : il lit alors les sources mises en cache dans
`src/data/sources.ts`, et le bandeau de l'écran le dit. Pour interroger les
vraies bases, copiez `.env.example` en `.env` et renseignez un compte PISTE.

## La règle de la maison

> **Sans preuve, rien n'est vert.**

Une API en panne, une citation floue, une référence absente : la ligne passe au
gris « non vérifié ». Jamais au vert par défaut. C'est la seule règle qui rend
un outil de vérification utilisable par un avocat.

## Les quatre contrôles

Sur chaque affirmation, toujours les mêmes quatre questions, dans le même ordre.

| | La question | Ce qu'elle attrape |
|---|---|---|
| 1 | **Elle existe ?** | Le numéro de pourvoi ou l'article inventé. |
| 2 | **En vigueur à la date des faits ?** | Le barème de 2017 appliqué à des faits de 2016 ; l'article abrogé. |
| 3 | **Quel rang ?** | La circulaire invoquée comme si elle liait le juge. |
| 4 | **Elle dit bien cela ?** | La vraie décision à laquelle on fait dire autre chose — l'erreur la plus dangereuse, parce que la plus difficile à voir. |

Le verdict d'ensemble d'une affirmation est **le plus sévère** de ses quatre
contrôles.

## Les six écrans

L'interface est écrite pour un juriste, pas pour un ingénieur : six écrans
numérotés dans l'ordre où on les traverse, et aucun jargon technique.

1. **Accueil** — ce que fait Visa, ce que veulent dire les quatre couleurs, vos dossiers.
2. **Soumettre un texte** — le texte, et la date des faits. Rien d'autre à renseigner.
3. **Le déroulé** — les six étapes du contrôle sur un schéma qui se lit de gauche à droite. Chaque carte s'ouvre sur ses tâches, une par une, avec la preuve de chacune.
4. **Le rapport** — une ligne par affirmation ; on en ouvre une et on voit les quatre contrôles, le texte officiel avec le passage surligné, la pyramide des normes, la frise des versions, et ce que l'adversaire opposerait.
5. **Le raisonnement** — le fil complet d'une affirmation, pas par pas, jusqu'à la conclusion. Voir ci-dessous.
6. **Le journal d'audit** — sources, identifiants, versions comparées, verdicts, relecture du juriste. Export PDF par l'impression du navigateur.

## Le fil du raisonnement

C'est l'écran qui répond à la question qu'on pose à toute IA juridique :
**« d'où sort cette conclusion ? »**

Le fil se lit de gauche à droite et se déroule pas par pas, dans l'ordre où Visa
les a franchis :

```
 L'affirmation ──► La référence ──► La requête ──► La source ──┬─► 1. Elle existe ?      ──┐
                      citée          envoyée       retrouvée    ├─► 2. En vigueur ?       ──┤
                                                               ├─► 3. Quel rang ?        ──┼──► L'avocat ──► LA
                                                               └─► 4. Elle dit cela ?    ──┘    adverse      CONCLUSION
```

Chaque pas se clique et se lit en entier : ce que Visa a fait, **la requête
exacte** envoyée à la base, ce qu'il a constaté, ce qu'il en déduit, et l'outil
employé. La conclusion ne nomme pas seulement une couleur : elle dit **quoi
faire** — retirer la référence, corriger la version citée, ne pas la présenter
comme obligatoire, ou déposer en l'état.

Deux partis pris :

- **Les quatre contrôles sont toujours montrés**, même quand l'un d'eux ne peut
  rien conclure. Un contrôle sauté serait un contrôle invisible.
- **Rien n'est écrit à la main.** Le fil est *dérivé* du dossier — citation,
  source retrouvée, contrôles, contradiction. Il ne peut donc jamais raconter
  autre chose que ce que le rapport conclut, et le jeu de test vérifie
  précisément cet invariant.

L'animation n'est pas décorative : elle dit qu'un verdict est le bout d'une
chaîne, et non une opinion rendue d'un bloc. `prefers-reduced-motion` affiche le
fil complet, sans mouvement.

## Le déroulé, étape par étape

```
 Le texte ──► Découpage ──┬─► Légifrance ──┐
                          │                │   ┌──────────────────────┐
                          │                ├──►│ 1. Elle existe ?     │
                          └─► Judilibre ───┘   │ 2. En vigueur ?      │──► Contradiction ──► Journal
                                               │ 3. Quel rang ?       │
                                               │ 4. Elle dit cela ?   │
                                               └──────────────────────┘
```

**La contradiction** mérite un mot. Un second agent joue l'avocat adverse et
doit citer un passage exact à l'appui de son objection. Visa vérifie ensuite ce
passage **mot pour mot** dans le texte officiel : s'il ne l'y retrouve pas,
l'objection est écartée. Le contradicteur non plus n'a pas le droit d'inventer.

Cette vérification est faite à l'affichage, par `passageDansSource`, et non lue
dans une donnée stockée. Elle regarde le texte courant **et** chaque version
connue, parce qu'une objection peut reposer sur la version applicable aux faits
plutôt que sur celle en vigueur aujourd'hui.

## Le code

```
src/
  types.ts              le vocabulaire : verdicts, contrôles, sources, étapes
  store.ts              l'état : l'écran, le dossier, l'avancement du contrôle
  styles.css            du papier plutôt qu'un terminal
  data/sources.ts       les sources officielles mises en cache (démo hors ligne)
  data/dossier.ts       le mémo piégé et ses 14 affirmations — notre jeu de test
  engine/etapes.ts      les six étapes et leurs tâches séparées
  engine/raisonnement.ts  le fil d'une affirmation, dérivé du dossier
  engine/piste.ts       Légifrance et Judilibre, et la vérification mot pour mot
  engine/mistral.ts     le découpage et la contradiction
  components/           le schéma du contrôle, le fil du raisonnement, la pyramide, la frise
  views/                les six écrans
verif/jeuDeTest.tsx     le jeu de test, sans navigateur
```

### Brancher les vraies bases

`engine/piste.ts` est écrit et prêt : jeton OAuth, `getArticleWithIdAndNum`,
`getArticleByCid` pour les versions, recherche au fonds `JURI` par numéro de
pourvoi, `consult/juri`, et Judilibre. Les identifiants des dix codes les plus
cités y sont listés.

Deux pièges relevés dans les recherches, traités dans le code : les dates
Légifrance arrivent en millisecondes, et une fin d'application en **2999**
signifie « pas de date de fin ». Le bac à sable et la production ont des
identifiants distincts ; `VITE_PISTE_ENV` choisit.

## Le jeu de test

`npm run verif` contrôle trois choses, sans navigateur :

1. chaque écran se rend sans planter, y compris la fiche de chacune des 14 affirmations ;
2. tout passage surligné existe mot pour mot dans le texte officiel ;
3. le fil du raisonnement dit la même chose que le rapport — même verdict, quatre
   contrôles toujours présents, numérotation sans trou, requête complète, et une
   conclusion qui dit quoi faire ;
4. le verdict rendu correspond au verdict attendu par des juristes.

Le jeu de test couvre les cas que Visa doit attraper : décision inventée, vraie
décision à la mauvaise portée, article abrogé, article en vigueur aujourd'hui
mais pas à la date des faits, décision postérieure aux faits, circulaire
présentée comme obligatoire, et affirmation sans aucune source.

## Ce qui reste à faire

- **Relecture juriste des sources de démonstration.** Les numéros de pourvoi et
  les extraits de `data/sources.ts` sont tenus pour exacts mais n'ont pas été
  recoupés sur Légifrance avec de vrais identifiants.
- **Compte PISTE en production.** Le bac à sable est immédiat ; la production est
  une étape à part, au délai non documenté.
- **Import de pièces du dossier**, pour vérifier aussi les faits (« signé le
  3 mars » quand la pièce 4 dit « 3 mai ») — l'extension data room.

## D'où vient ce produit

Le brief et les chiffres sont dans [`../recherches/`](../recherches), notamment
[06-idee-visa.md](../recherches/06-idee-visa.md). En trois points :

- **La confiance est le problème.** Enquête CNB 2025 : 64 % des avocats utilisent ChatGPT, 46 % citent les erreurs comme limite n°1.
- **Les hallucinations arrivent devant les juges français.** TA Orléans, 29 décembre 2025 : 17 références fictives dans une requête.
- **Personne ne vérifie la date ni le rang.** Clearbrief et KeyCite sont américains ; aucun outil trouvé ne contrôle « en vigueur à la date des faits » ni la hiérarchie des normes en droit français. Et depuis mars 2026, le CNB demande un journal des usages de l'IA que personne ne fournit.
