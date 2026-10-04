# Brief hackathon — LLM x Law Paris #2 (dimanche 4 octobre 2026)

## Le hackathon (vérifié sur la page Luma)

- **Aujourd'hui, 8h30 → 22h30.** Organisé par **Stanford Law + Mistral AI**.
- Partenaires : **Legora, Hector AI, Jus Mundi**, Sciences Po. Mentors : HEC IA, UN AI for Good.
- Thème unique : *« working demos or prototypes that address real-world legal challenges with a focus on **trustworthy AI integration** »*.
- Éditions passées : Jus Mundi au jury et API fournie ; les gagnants ont fait un graphe de connaissance (Stanford) et un assistant d'arbitrage (Cambridge).
- **Introuvable en ligne, à demander sur place** : heure de rendu, durée du pitch, critères, jury, prix, crédits Mistral / API fournies.

## Ce qu'on a appris (les manques)

1. **La confiance est LE problème.** Enquête CNB 2025 (4 457 avocats) : 64 % utilisent ChatGPT, 46 % citent les erreurs comme limite n°1, 70 % des réfractaires « n'ont pas confiance ».
2. **Les hallucinations arrivent devant les juges français.** 2 145 décisions dans la base Charlotin (HEC), dont 14 en France. TA Orléans, 29/12/2025 : 17 références fictives dans une requête. TJ Périgueux, 18/12/2025 : premier avocat visé.
3. **Même les outils pro se trompent** : Stanford 2024, Lexis+ AI 17 %, Westlaw AI 33 % d'hallucinations. Étude août 2026 sur le droit français : jusqu'à ~50 % d'erreurs.
4. **Personne ne vérifie la date et le rang des sources.** Les outils existants (Clearbrief, KeyCite) sont américains. Aucun ne contrôle « en vigueur à la date des faits » ni la hiérarchie des normes en droit français. Un papier ICML 2026 le décrit comme un problème de recherche ouvert.
5. **Le CNB exige la traçabilité depuis mars 2026** (guide déontologie & IA) : documenter les usages de l'IA. Aucun outil ne fournit ce journal.
6. **Les petits sont oubliés.** Legora et Harvey vendent sur devis aux gros cabinets (~95 k$/an en moyenne pour Legora). 36 % des avocats exercent seuls (~27 000). Hector fait déjà le contentieux pour cabinets, Ordalie coûte 75 €/mois.

## L'idée recommandée : **Visa**

> « Vu l'article… » : le visa est la liste des textes en tête d'un jugement.
> **Visa vérifie chaque phrase d'une réponse d'IA juridique sur le texte officiel, et garde la preuve.**

**On ne construit pas une IA juridique de plus. On construit le contrôle technique de toutes les autres.**
Ça marche sur ChatGPT, Legora, Hector, Doctrine. On est complémentaires des partenaires du jury, pas concurrents.

### Ce que fait Visa

L'avocat colle un mémo, des conclusions ou une note écrite avec l'IA, puis il indique la date des faits. Visa :

1. **Découpe** le texte en affirmations, chacune avec sa source citée.
2. **Retrouve la source officielle** : Légifrance pour les articles et lois, Judilibre pour les décisions.
3. **Vérifie 4 choses, affirmation par affirmation :**
   - **Existe ?** Décision ou article introuvable → rouge.
   - **En vigueur à la date des faits ?** On compare la version citée à la version applicable, côte à côte.
   - **Quel rang ?** Pyramide des normes visible ; alerte si une circulaire est invoquée comme si elle était obligatoire.
   - **Dit-elle vraiment ça ?** Un 2e agent joue l'avocat adverse et conteste. Il doit citer le passage exact, et on vérifie mot pour mot que ce passage existe dans le texte officiel (le juge lui-même ne peut pas halluciner).
4. **Montre le raisonnement** de chaque agent, étape par étape.
5. **Exporte un journal d'audit** (PDF) : sources, versions, verdicts, validation de l'avocat. Prêt pour le guide CNB.

**Règle d'or : sans preuve, rien n'est vert.** API en panne, citation floue → gris « non vérifié », jamais vert par défaut.

### La démo (3 minutes)

Accroche : *« Le 29 décembre 2025, le tribunal administratif d'Orléans a relevé 17 références inventées dans la requête d'un avocat. »*

On colle un mémo de licenciement / clause de non-concurrence, écrit « par ChatGPT », qui a l'air parfait. Visa affiche 12 affirmations : 7 vertes, 3 orange, 2 rouges. On clique :

- 🔴 un arrêt de la Cour de cassation qui **n'existe pas** ;
- 🔴 un vrai arrêt qui **ne dit pas ce qu'on lui fait dire** ;
- 🟠 le **barème Macron** (art. L.1235-3, ordonnances de septembre 2017) appliqué à des faits de **2016** : pas en vigueur à la date des faits ;
- 🟠 une **circulaire** invoquée comme si elle liait le juge ;
- 🟢 Cass. soc. 10 juillet 2002 (contrepartie financière de la non-concurrence) : bonne source, passage surligné. *(Numéro exact à confirmer par nos juristes.)*

Fin : bouton « Exporter le journal d'audit » → le PDF pour le dossier client.

### Pourquoi ça peut gagner

| Qui juge | Ce qu'il veut voir | Ce qu'on montre |
|---|---|---|
| Stanford Law | IA de confiance, évaluable | vérification affirmation par affirmation, taux mesuré sur un jeu de test |
| Mistral | usage de ses modèles, souveraineté | 100 % Mistral (Magistral pour le raisonnement visible), données en France |
| Legora / Hector / Jus Mundi | pas un concurrent de plus | une couche de confiance qu'ils pourraient brancher (API) |
| Avocats | « je peux plaider ça ? » | la source officielle surlignée + le journal CNB |

### Business (pour le pitch)

- **Cible 1 :** les ~27 000 avocats seuls, qui utilisent déjà ChatGPT. Abonnement ~29–49 €/mois, sans devis.
- **Cible 2 :** une API « couche de confiance » vendue aux éditeurs (Legora, Hector, Doctrine…).
- **Canal :** les barreaux et le CNB, pour qui la conformité au guide de mars 2026 est un argument.

## Idées écartées, et pourquoi

- **« Legora pour les petits cabinets »** : trop large pour 12 h. Hector (partenaire) et Ordalie le font déjà.
- **Analyse de data room seule** : Legora, Harvey Vault, Luminance et Kira le font déjà, et Legora est dans la salle. **On la garde en extension** : « le même moteur sur une data room, chaque point rouge ancré au document ET à la loi en vigueur ». Si on a le temps, on ajoute l'import de pièces du dossier pour vérifier aussi les faits (« signé le 3 mars » alors que la pièce 4 dit « 3 mai »).
- **Cerveau juridique / graphe** : c'est le cœur de Jus Mundi ; difficile de montrer une valeur en 12 h.

## Plan (à ajuster quand on connaît l'heure de rendu)

| Heure | Dev (Youssef + Claude) | Juristes | Business |
|---|---|---|---|
| 10h15–10h45 | compte PISTE (Légifrance + Judilibre), clé Mistral | valider l'idée, demander les règles | demander règles, jury, durée du pitch |
| 10h45–13h | chaîne : découpe → recherche des sources → juge | écrire le mémo piégé + les verdicts attendus (= notre jeu de test) | interviewer 5–10 avocats présents (« vous vérifiez comment ? ») |
| 13h–17h | interface (texte coloré + panneau source + pyramide + raisonnement), cache des sources | règles de hiérarchie, contenu du journal d'audit | deck + chiffres marché |
| 17h–19h | export du journal, 2e mémo, robustesse | tester sur leurs propres cas | répétition du pitch |
| 19h–… | gel du code, vidéo de secours de la démo | | pitch |

## Les cas à tester (le jeu de test)

**Cas normaux**
- Article en vigueur, bien cité → vert.
- Vraie décision qui soutient l'affirmation → vert, passage surligné.

**Erreurs à attraper**
- Décision inventée (numéro de pourvoi inexistant) → rouge « introuvable ».
- Vraie décision, mauvaise portée → rouge « ne dit pas ça ».
- Article abrogé (ex. ancienne numérotation du Code du travail, avant 2008) → rouge.
- Article en vigueur aujourd'hui mais pas à la date des faits → orange, avec les deux versions côte à côte.
- Circulaire ou réponse ministérielle présentée comme obligatoire → orange « rang inférieur ».

**Cas limites**
- Citation floue (« la jurisprudence constante ») → gris « non vérifiable ».
- Date des faits absente → on demande, sinon date du jour + avertissement.
- Mémo sans aucune source → message clair.
- API lente ou en panne → gris « non vérifié », jamais vert.
- Le juge invente une citation → rejetée par la vérification mot pour mot.

## Pièges

- Créer le compte PISTE **tout de suite**. Le bac à sable est immédiat, la production est une étape à part, au délai inconnu. Plan B : mettre en cache les sources de la démo.
- Aucun vrai document client dans la démo.
- Hector annonce aussi de la « vérification des sources ». Notre différence : on est **indépendants** (on marche sur n'importe quelle IA), et on vérifie **la date des faits, la hiérarchie des normes et le journal CNB**.

## Sources principales

- Événement : https://luma.com/zwtvzkvp
- Enquête CNB/Viavoice 2025 : https://cnb.avocat.fr/medias/file/telechargez-l-enquete-l-ia-et-la-profession-d-avocat---volet-avocats0-6994caccab94e7.18267903.pdf
- Guide CNB déontologie & IA (17/03/2026) : https://cnb.avocat.fr/actualite/le-cnb-adopte-un-guide-sur-la-deontologie-et-l-intelligence-artificielle
- Base des hallucinations (Charlotin) : https://www.damiencharlotin.com/hallucinations/
- Jurisprudence française sur les hallucinations : https://www.lexbase.fr/article-juridique/132589747-commentairelintelligenceartificiellegenerativealepreuvedupretoirelemergencedunejurispruden
- Stanford, hallucinations : https://arxiv.org/abs/2405.20362
- Vérification des sources juridiques, problème ouvert (ICML 2026) : https://arxiv.org/abs/2609.17546
- API PISTE (Légifrance, Judilibre) : https://piste.gouv.fr/registration — serveur MCP Légifrance : https://github.com/Ktulu-Analog/mcp-legifrance
- Statistiques de la profession : https://www.justice.gouv.fr/sites/default/files/2026-06/statistique_profession_avocat_2024.pdf
- Hector AI : https://www.hector.legal/
- Legora, prix et cible : https://sacra.com/c/legora/
- Clio, petits cabinets 2026 : https://www.clio.com/about/press/2026-solo-small-firm-report/
