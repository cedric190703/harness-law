# Protocole de production des constats

Appliquer le tableau de concordance de `skills/cross-document-review` au dossier de due diligence, avec les adaptations suivantes. Ce protocole produit un dossier JSON pour `due_diligence.review` ; il ne modifie pas les grilles ni les scores du benchmark Harvey.

1. Reprendre le client, le périmètre de mission, la date de référence et les livrables demandés. Ne pas assimiler absence de pièce à absence de risque.
2. Inventorier les pièces via `due_diligence.review.inventory(Path(...))`. Conserver le chemin original et le SHA256. L’extraction ne constitue pas une consultation. Lire les textes utiles avec les limites et pièces non lues consignées.
3. Comparer versions, parties, dates et objet avant de retenir une pièce. Exclure un projet non signé uniquement avec justification documentaire ; un nom de fichier ne prouve rien. Rattacher chaque avenant à son contrat avec `documents[path].parent`. Ne pas faire disparaître l’original.
4. Écrire un constat par fait vérifiable : `id`, `topic`, `workstream`, `statement`, `priority` (Critique, Élevée, Modérée, Faible), `impact`, `recommendation`, `selection_reason`, `consulted`, `evidence`. Priorités et recommandations restent proposées au juriste. Citer tous les passages nécessaires aux composantes factuelles du constat.
5. Pour chaque preuve : `path`, `sha256`, `clause`, `quote` exact, `page` pour le PDF ou `line_start` et `line_end` pour le texte. Ne pas fabriquer une pagination pour les TXT, CSV ou DOCX. Identifier les synthèses vendeur comme telles. Une clause absente n’a pas de citation inventée : formuler une limite de périmètre et une question.
6. Séparer le fait, son interprétation, son impact et l’action proposée (garantie, condition suspensive, consentement, ajustement de prix, investigation). Expliquer les hypothèses et calculs. Utiliser `links` pour renvoyer aux autres constats concernés.
7. Renseigner `question`, éventuellement `seller_response`, `response_source`, `owner` et `due_date`. Une réponse vendeur ne valide pas automatiquement le constat ; rapprocher la réponse des pièces.
8. Laisser `validation` à `à valider`. Seul le juriste renseigne `validé`, `reviewer` et `reviewed_at`. Le système contrôle l’ancrage documentaire, pas la justesse juridique. Ne jamais inventer un relecteur.
9. Générer les livrables et résoudre les erreurs d’ancrage. Les limites non résolues doivent rester affichées. Relire les tableaux : mêmes IDs et faits dans la revue, le Word et l’Excel, aucune conclusion orpheline de ses preuves.
10. À chaque nouveau versement, comparer au registre précédent, revoir les sources modifiées et les pièces ajoutées, puis repasser les constats concernés devant le juriste. Le contrôle local remet prudemment toutes les validations à reprendre si l’inventaire change.

La citation retrouvée prouve seulement que le texte cité existe au bon emplacement dans la bonne version. Elle ne prouve ni que l’agent a tout lu, ni que le constat découle logiquement du passage, ni que le contrat est signé ou applicable.
