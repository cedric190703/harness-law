# Positionnement de Visa

Sources ouvertes et vérifiées le 4 octobre 2026 ; entrées BibTeX dans `refs.bib`, détail dans `related-work.md`.

Légende : ✓ oui · ~ en partie · ✗ non (ou rien trouvé dans la source) · — hors sujet.

| Travail ou outil | Nature | Existence de la source | Version à la date des faits | Rang de la norme | Contenu, avec preuve mot pour mot | Oublis |
|---|---|---|---|---|---|---|
| **Visa** | couche de vérification branchée sur n'importe quel modèle, droit français | ✓ Légifrance, Judilibre, pièces du dossier | ✓ toutes les versions d'un article, choix de celle en vigueur à la date des faits | ✓ hiérarchie simplifiée (une circulaire invoquée comme contraignante passe en orange) | ✓ avocat adverse qui doit citer un extrait retrouvé mot pour mot par script ; sans preuve, gris | ✓ tableau de concordance (aller puis retour) et contrôles scriptés |
| KeyCite et Quick Check (Thomson Reuters, Westlaw) | outil commercial, droit américain | ✓ | ~ statut actuel : arrêt qui n'est plus « good law », loi « amended, repealed, superseded, or held unconstitutional » ; rien trouvé sur la version à une date passée | ✗ | ~ compare les citations entre guillemets du mémoire au texte cité ; ne dit pas si la source soutient la proposition | ~ propose des « additional relevant authority », pas les exigences d'un document de référence |
| Clearbrief, Cite Check Report (Ambrogi, 2025) | outil commercial, droit américain | ✓ sources manquantes | ✗ | ✗ | ~ score de similarité sémantique, NLP non génératif, pas d'extrait vérifié | ✗ |
| LePhantomCite (Liu et al., 2026, Princeton) | benchmark de 1 300 extraits et vérificateurs agentiques | ✓ citation inexistante, nom et référence incohérents | ✗ absent de la taxonomie | ✗ | ~ détecte les citations déformées et les contenus travestis (GPT-5 agentique : 84,4 % de rappel, 55,0 % de F1), mais le verdict du vérificateur n'est pas lui-même prouvé | ✗ |
| *Is this Citation on Point?* (Verma, 2026) | étude, droit américain | ✓ mauvaise affaire détectée à 93–100 % | ✗ | ✗ | ~ soutien à la page près détecté à 37–61 % seulement, jugement du modèle sans extrait vérifié | ✗ |
| FiscalQA Pro (Cymbler et al., 2026) | benchmark et moteur de recherche multi-versions, Code général des impôts | ~ | ✓ 32 436 versions d'articles ; 0 % avec un RAG statique, 98,3 % avec l'index multi-versions | ✗ | ~ notation déterministe par valeurs attendues (regex, nombres), sans extrait de preuve | ✗ |
| Prior et al., 2026 (ICAIL) | benchmark et RAG, droit allemand | ~ | ✓ extraction de la date des faits et filtrage des versions | ✗ | ✗ notation par juge LLM | ✗ |
| Taranukhin et Shwartz, 2026 (atelier AI4Law, ICML) | article de position : cadre d'évaluation « legal warrant » | ✓ comme critère | ✓ comme critère (« current for the date of analysis ») | ~ critère de « legal status » de l'autorité | ✓ comme critère (« supports the proposition »), petit pilote, pas de contrôle par script | ✗ |
| FActScore et SAFE (Min et al., 2023 ; Wei et al., 2024) | métrique générique de factualité | — | ✗ | ✗ | ~ faits atomiques jugés par un modèle contre une source ou Google, sans extrait mot pour mot | ✗ |

## Ce qui est vraiment nouveau chez Visa

1. **Les cinq contrôles dans un seul outil qui tourne, sur le droit français** : existence, version à la date des faits, rang, soutien prouvé, oublis. Chacun existe ailleurs séparément ; aucun travail trouvé ne les réunit, et seul le cadre de Taranukhin et Shwartz les énumère, sans les implémenter.
2. **Le rang de la norme** : nous n'avons trouvé aucun benchmark ni outil qui vérifie la place d'une source dans la hiérarchie des normes (une circulaire présentée comme contraignante, par exemple).
3. **La garde mot pour mot appliquée au vérificateur, en vérification juridique** : l'avocat adverse doit citer un passage d'une dizaine de mots qu'un script retrouve dans le texte officiel, sinon le verdict est écarté et l'affirmation passe en gris. Khan et al. (2024) le font pour un débat sur des récits ; nous ne l'avons pas trouvé pour l'audit d'une réponse d'IA juridique.
4. **L'audit de la version utilisée par une réponse existante** : les travaux sur le temps (FiscalQA Pro, Prior et al., Huang et al.) mesurent si un modèle retrouve la bonne version ; Visa vérifie après coup la version sur laquelle une autre IA s'est appuyée, et montre l'ancien et le nouveau texte côte à côte.
5. **Une mesure contrôlée, avec et sans la méthode, sur LAB** : Harvey observe que les agents qui vérifient puis corrigent font 1,5 point de plus, mais c'est une corrélation tirée de leurs traces d'exécution (« how those behaviors correlate with outcomes ») ; nous faisons l'intervention (mêmes tâches, mêmes documents, trois agents, deux juges de familles différentes).

## Ce qui existe déjà : à ne pas prétendre avoir inventé

1. **Vérifier qu'une citation existe et reste valable, et comparer une citation entre guillemets au texte** : c'est le métier des citators (KeyCite) et de Westlaw Quick Check ; LePhantomCite et Verma (2026) mesurent déjà la détection de citations inventées, déformées ou hors sujet.
2. **Les citations vérifiées mot pour mot, le juge adversarial et les juges de familles différentes** : GopherCite impose des citations mot pour mot (Menick et al., 2022), Khan et al. (2024) ne laissent le juge croire que les citations vérifiées par un outil, le débat vient d'Irving et al. (2018), et le panel de juges de familles différentes vient de Verga et al. (2024) ; le classement Vals du LAB note déjà avec deux juges (GPT 5.5 et Claude Sonnet 4.6).
3. **Choisir la version en vigueur à la date des faits, et découper une réponse en affirmations** : FiscalQA Pro le fait déjà sur le droit fiscal français (98,3 %), Prior et al. filtrent les versions par la date des faits, Légifrance (LEGI) conserve toutes les versions, et Palmirani et Brighi modélisent les versions depuis 2006 ; le découpage en affirmations atomiques vient de FActScore et SAFE.
