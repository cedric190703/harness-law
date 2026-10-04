# Les skills de l'audit

Trois méthodes, écrites pour être relues par un juriste et exécutées par le
harnais. Elles ne décrivent pas le code : elles décrivent **ce qu'un senior
exige** avant de signer un rapport.

| Skill | Ce qu'elle garantit |
|---|---|
| [triage-data-room](triage-data-room/SKILL.md) | Aucun fichier n'est écarté sans motif vérifiable, et ce qui n'a pas été lu est dit. |
| [extraction-ancree](extraction-ancree/SKILL.md) | Aucune affirmation n'entre au rapport sans un passage retrouvé mot pour mot. |
| [constat-vers-cession](constat-vers-cession/SKILL.md) | Aucun risque ne reste sans traduction au contrat de cession. |

Le code qui les applique est dans [`../server/`](../server) :
`documents.mjs` pour la première, `extraction.mjs` et `sondes.mjs` pour la
deuxième, `sondes.mjs` encore pour la troisième. Le jeu de test
([`../verif/jeuDeTest.tsx`](../verif/jeuDeTest.tsx)) vérifie mécaniquement que
les garanties annoncées ici tiennent.
