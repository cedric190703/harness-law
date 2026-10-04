# Adaptation de la revue documentaire à la due diligence

Socle : branche `youssef/bench-revue`, commit `13c8f0e`. Périmètre demandé : aider le juriste à vérifier les constats et améliorer les livrables tabulaires.

## Parcours et architecture

Conserver le benchmark comparatif existant. Ajouter un parcours local Python + HTML autonome, sans transfert de pièces ni dépendance à un service externe. Un registre JSON constitue la source unique des vues et exports. Les constats sont fournis par un agent ou un juriste ; le moteur vérifie leur ancrage, il ne prétend pas effectuer une analyse juridique automatique.

1. Inventorier récursivement les pièces sans modifier leur arborescence ; empreinte, extraction par page PDF ou lignes TXT/CSV, doublons exacts, erreurs visibles.
2. Consigner les décisions documentaires : retenue, exclue avec motif, lien d'avenant ; ne jamais inférer une signature du nom du fichier.
3. Charger un dossier de constats : documents consultés, source retenue, citation exacte, clause, impact, recommandation, question vendeur, état de validation humaine.
4. Présenter texte et preuve côte à côte ; exporter un rapport Word avec tableaux et un classeur filtrable (risques, pièces, questions vendeur, preuves).
5. Comparer un nouveau versement à l'inventaire précédent ; invalider les validations lorsqu'une source a changé et signaler la revue nécessaire à l'ajout d'une pièce.

## Critères de réception

- Citation vérifiée dans la page ou les lignes indiquées ; échec bloquant pour les références invalides.
- Extraction distincte de consultation déclarée et de validation humaine. Aucun taux d'exhaustivité juridique déduit de ces états.
- Erreurs, pages vides et exclusions visibles dans tous les livrables.
- Les formats Word, Excel et HTML reprennent les mêmes identifiants et constats sans troncature.
- Tests : doublons, homonymes, fichiers illisibles, citation fausse, changement de source, sécurité des exports, validation humaine.

## Limites assumées

Pas d'OCR, connecteur data room, reconnaissance de signature ni analyse juridique par modèle dans cette tranche. Le jeu d'exemple est une revue partielle explicitement identifiée. Les réponses vendeur sont des déclarations à rapprocher des pièces, jamais des preuves validées par défaut. Aucun déploiement ni écriture distante.

## Vérification réalisée

- 13 tests Python réussis (registre, exports et publication locale).
- Parcours Chrome ordinateur et mobile : recherche, inventaire de 13 pièces, questions vendeur, correction, validation, sauvegarde, rechargement et téléchargements Word/Excel.
- Correction retrouvée dans les deux fichiers téléchargés ; données de démonstration restaurées après test.
- Rejet d’une écriture sur une ancienne révision (409) et d’une requête d’une origine externe (403).
- Rapport Word rendu et contrôlé sur ses 6 pages ; cinq onglets Excel rendus et inspectés, largeur de la colonne Constat corrigée.
- Aucun lancement de modèle ni nouveau score du benchmark Harvey. Modifications locales, sans commit, push ou déploiement.
