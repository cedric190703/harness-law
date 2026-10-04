# Interroger Légifrance et Judilibre

Notes techniques, relevées le 4 octobre 2026 :
- dans le serveur MCP open source https://github.com/Ktulu-Analog/mcp-legifrance ;
- dans la spécification publique de Judilibre (https://github.com/Cour-de-cassation/judilibre-search, fichier `public/JUDILIBRE-public-swagger.json`).

**Rien n'a encore été testé avec de vrais identifiants.**

## Accès (PISTE, gratuit)

1. Créer un compte sur https://piste.gouv.fr/registration et valider l'email.
2. Dans « Applications », cliquer sur « Créer une application ».
3. L'abonner aux API **Légifrance** et **JUDILIBRE**, et accepter leurs conditions d'utilisation (pour Judilibre en production, sans cela l'accès est refusé).
4. Récupérer le `client_id` et le `client_secret`.

Le **bac à sable** et la **production** ont des identifiants distincts. Le bac à sable est accessible tout de suite ; la production est une étape à part, au délai non documenté.

| | Bac à sable | Production |
|---|---|---|
| Jeton | `https://sandbox-oauth.piste.gouv.fr/api/oauth/token` | `https://oauth.piste.gouv.fr/api/oauth/token` |
| Légifrance | `https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app` | `https://api.piste.gouv.fr/dila/legifrance/lf-engine-app` |
| Judilibre | `https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0` | `https://api.piste.gouv.fr/cassation/judilibre/v1.0` |

**Jeton** : un `POST` en `application/x-www-form-urlencoded` avec `grant_type=client_credentials`, `client_id`, `client_secret` et `scope=openid`. Il est ensuite envoyé en `Authorization: Bearer …`. Il dure environ 1 h.

## Légifrance : les appels utiles (tous en POST, corps JSON)

| Besoin | Appel | Corps |
|---|---|---|
| Article d'un code par son numéro | `/consult/getArticleWithIdAndNum` | `{"id": "LEGITEXT000006072050", "num": "L1235-3"}` |
| Toutes les versions d'un article | `/consult/getArticleByCid` | `{"cid": "<cid de l'article>"}` → `listArticle` |
| Article par identifiant | `/consult/getArticle` | `{"id": "LEGIARTI…"}` |
| Recherche | `/search` | `{"fond": "...", "recherche": {...}}` |
| Décision de justice | `/consult/juri` | `{"textId": "JURITEXT…"}` |
| Loi, décret, ordonnance | `/consult/lawDecree` | `{"textId": "...", "date": "AAAA-MM-JJ"}` |
| Circulaire | `/consult/circulaire` | `{"id": "..."}` |

**Ce que renvoie un article**
- `id`, `cid`, `num`, `texte` / `texteHtml`, `etat`, `dateDebut`, `dateFin`.
- Les dates arrivent en **millisecondes**. Une fin en **2999** veut dire « pas de date de fin ».
- **États possibles** : `VIGUEUR`, `VIGUEUR_DIFF`, `ABROGE`, `ABROGE_DIFF`, `ANNULE`, `PERIME`, `TRANSFERE`, `MODIFIE`.

**Fonds de recherche** (la valeur exacte compte : un fond invalide donne une erreur 500)

| Fond | Contenu |
|---|---|
| `CODE_ETAT` / `CODE_DATE` | Codes (état actuel / version à une date) |
| `LODA_ETAT` / `LODA_DATE` | Lois, ordonnances, décrets |
| `JURI` | Jurisprudence judiciaire |
| `CETAT` | Jurisprudence administrative |
| `CONSTIT` | Conseil constitutionnel |
| `JORF` | Journal officiel |
| `KALI` | Conventions collectives |
| `CIRC` | Circulaires |
| `CNIL` | Délibérations CNIL |

**Champs utiles** (`typeChamp`)
- `NUM_ARTICLE` (codes) ;
- `NUM` (numéro de loi ou décret) ;
- `NUM_AFFAIRE` (numéro de pourvoi, fond `JURI`) ;
- `NUM_DEC` (fonds `CETAT` et `CONSTIT`).

Exemple : trouver un arrêt par son numéro de pourvoi.

```json
{"fond": "JURI", "recherche": {
  "champs": [{"typeChamp": "NUM_AFFAIRE", "criteres": [{"typeRecherche": "EXACTE", "valeur": "00-45.135", "operateur": "ET"}], "operateur": "ET"}],
  "operateur": "ET", "pageSize": 5, "pageNumber": 1, "sort": "PERTINENCE", "typePagination": "DEFAUT"}}
```

Le résultat se lit dans `results[0].titles[0].id` (un identifiant `JURITEXT…`), à passer ensuite à `/consult/juri`.

**Identifiants des codes les plus cités**

| Code | Identifiant |
|---|---|
| Code civil | `LEGITEXT000006070721` |
| Code du travail | `LEGITEXT000006072050` |
| Code de commerce | `LEGITEXT000005634379` |
| Code pénal | `LEGITEXT000006070719` |
| Code de procédure civile | `LEGITEXT000006070716` |
| Code de la consommation | `LEGITEXT000006069565` |
| Code de la sécurité sociale | `LEGITEXT000006073189` |
| Code général des impôts | `LEGITEXT000006069577` |
| Code monétaire et financier | `LEGITEXT000006072026` |
| Code de la propriété intellectuelle | `LEGITEXT000006069414` |

## Judilibre (Cour de cassation) : appels en GET

| Appel | Paramètres principaux |
|---|---|
| `/search` | `query`, `field`, `jurisdiction`, `chamber`, `date_start`, `date_end`, `page_size`, `page` |
| `/decision` | `id` (et `query` pour surligner) |
| `/taxonomy` | `id` (listes de valeurs : chambres, champs…) |
| `/export` | export par lots |

**Ce que renvoie une décision** : `text` (intégral, pseudonymisé), `zones` (exposé, moyens, motivations, dispositif), `number` / `numbers` (pourvois), `decision_date`, `chamber`, `solution`, `ecli`, `visa` (les textes appliqués).

**Pièges**
- La couverture historique de Judilibre ne remonte pas forcément aux arrêts anciens (non vérifié). Pour un arrêt ancien, passer d'abord par le fond `JURI` de Légifrance.
- Mettre les réponses en cache : il y a des limites d'appels, et la démo doit survivre à une coupure du wifi.
