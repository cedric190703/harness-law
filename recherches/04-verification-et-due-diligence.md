# Vérifier l'IA juridique, et la due diligence IA

## 1. Hallucinations : chiffres et affaires (vérifié)

**Les études**
- **Stanford RegLab/HAI** (Magesh, Ho et al., *Journal of Empirical Legal Studies* 2025, outils testés en mai 2024). Taux d'hallucination :
  - Lexis+ AI : **17 %** (65 % de réponses exactes) ;
  - Westlaw AI : **33 %** (42 % exactes) ;
  - GPT-4 : **43 %**.
- **Étude d'août 2026** sur 8 outils interrogés sur le RGPD et le droit civil français : de moins de 10 % à près de **50 %** d'erreurs. C'est pire quand la question repose sur une fausse prémisse.

**Les affaires**
- **Base de Damien Charlotin** (HEC Paris), au 4 octobre 2026 : **2 145 décisions**. États-Unis 1 473, Canada 229, Royaume-Uni 70, Italie 15, **France 14**, Allemagne 11.
- **Mata v. Avianca** (New York, 2023) : 6 décisions inventées par ChatGPT, 5 000 $ d'amende.
- **Couvrette v. Wisnovsky** (Oregon, 2025-2026) : 15 décisions inexistantes, 110 204 $ au total et action rejetée. C'est la plus forte sanction connue.
- **Premier trimestre 2026** : au moins 145 000 $ de sanctions aux États-Unis.
- **En France**, il y a des rejets et des mises en garde, mais pas d'amende :
  - TA Grenoble, 3 décembre 2025 (n° 2509827) ;
  - **TJ Périgueux, 18 décembre 2025** (n° 23/00452), premier avocat visé par une juridiction judiciaire ;
  - **TA Orléans, 29 décembre 2025** (n° 2506461) : **17 références fictives** ;
  - TA Rennes, 28 janvier 2026 ;
  - CAA Bordeaux, 26 février 2026 (n° 25BX02906).

## 2. Outils de vérification des citations

- **Clearbrief Cite Check Report** (décembre 2025) :
  - dans Word, il vérifie citations juridiques et factuelles ;
  - il donne un score « la source soutient-elle l'affirmation ? » et un rapport PDF d'audit ;
  - limite : droit américain uniquement.
- **Westlaw KeyCite / Quick Check** : drapeau rouge si une décision ne fait plus autorité. Fait pour la common law.
- **Benchmark Liu, Stammbach et Henderson** (juin 2026) : 1 300 extraits de conclusions où des erreurs ont été insérées. Le meilleur système (GPT-5 en agent) en trouve 84,4 %, avec un F1 de 55 %. Le frein principal est l'accès aux bases juridiques.
- **Il y a deux types d'erreur** :
  - la décision **inventée** ;
  - la décision **réelle qui ne dit pas ce qu'on lui fait dire**. C'est la plus dangereuse, parce que la plus difficile à repérer.

**Un créneau libre (non trouvé = supposé)**
- Aucun outil commercial trouvé ne contrôle la **hiérarchie des normes** ni la **version en vigueur à la date des faits** en droit français.
- Il existe un petit prototype, Juriv'IA, qui affiche vert / orange / rouge selon qu'un texte est en vigueur, introuvable ou abrogé.
- Un article de l'atelier AI4Law d'ICML 2026 décrit le problème comme ouvert. Une source n'est valable que si elle :
  - **existe** ;
  - **s'applique au territoire** ;
  - **est en vigueur à la date des faits** ;
  - **a le rang qu'on lui prête** ;
  - **soutient bien l'affirmation**.

## 3. Données ouvertes pour vérifier (vérifié)

Le détail technique est dans [05-api-legifrance-judilibre.md](05-api-legifrance-judilibre.md).

- **API Légifrance** (PISTE, gratuite) : un article, l'historique de ses versions, son statut, la jurisprudence, les lois et décrets, les circulaires, les conventions collectives.
- **Judilibre** (Cour de cassation, via PISTE) : décisions pseudonymisées, avec leurs métadonnées.
- **Données en masse de la DILA** (XML, sans limite d'appels), sur https://echanges.dila.gouv.fr/OPENDATA/ :
  - LEGI (codes), JORF, KALI ;
  - CASS, INCA, CAPP (judiciaire) ;
  - JADE (Conseil d'État), CONSTIT.
- **EUR-Lex** : interrogation libre et sans clé sur https://publications.europa.eu/webapi/rdf/sparql.

## 4. Due diligence IA

**Les outils**
- **Kira (Litera)** : plus de 800 champs prêts à l'emploi (changement de contrôle, cession, résiliation). Environ 50 000 $/an ou plus (source secondaire).
- **Luminance** : structure la data room (type de document, clauses, langue, droit applicable), classe les anomalies par gravité, se connecte à iManage et HighQ.
- **Legora Tabular Review** : une ligne par document et une colonne par question. Chaque cellule renvoie à la source et au raisonnement.
- **Harvey Vault** : jusqu'à 10 000 fichiers, réponses avec raisonnement et citation. Harvey annonce 96 % d'exactitude et une revue qui passe de « 2-3 semaines à quelques jours ».
- **Datasite + Blueflame AI** (août 2025) : points rouges sur toute la data room, signale les documents manquants.
- **Diligen** : modèles de clauses déjà entraînés, export Word ou Excel.

**Le déroulé type d'une due diligence**
1. La data room est classée par thème : corporate, contrats, social, fiscal, contentieux, propriété intellectuelle, RGPD.
2. Le rapport classe les risques en points rouges, risques modérés et points d'attention.
3. Chaque point rouge est chiffré.
4. Il est ensuite traité dans le contrat de cession par une baisse de prix, une garantie spécifique ou une condition suspensive.

**La limite (supposé)** : ces outils citent l'endroit du document, mais **ne vérifient pas que la clause respecte la loi en vigueur**. Ils sont aussi centrés sur le droit anglo-saxon et vendus au prix « grand compte ».

## 5. Une IA qui juge l'IA, et les citations ancrées (vérifié)

- **Citations d'Anthropic** (2025) :
  - le passage cité est copié du document, pas rédigé par le modèle, avec sa position exacte ;
  - Endex est passé de 10 % à 0 % de sources inventées ;
  - CoCounsel (Thomson Reuters) l'utilise.
- **CiteTracer** (2026) :
  - une chaîne d'agents extrait la citation, retrouve la source, compare les champs de manière fixe, puis confie les cas douteux à des juges IA ;
  - 97,1 % de réussite, mais sur des citations scientifiques.
- **Les bonnes pratiques** vérifient trois choses :
  - une citation est donnée ;
  - elle renvoie à une source réelle ;
  - la source contient bien l'affirmation.

  La vérification se fait **affirmation par affirmation**, pas réponse par réponse. Retrouver des textes pertinents ne prouve pas que l'affirmation est juste.

## Ce qu'un prototype peut montrer en 1 journée

1. **Un contrôleur de conclusions** : un mémo écrit par une IA, avec des références fictives, vérifié en direct sur Légifrance et Judilibre. Feu tricolore sur quatre questions :
   - la source existe-t-elle ?
   - était-elle en vigueur à la date des faits ? On montre côte à côte la version citée et la version actuelle.
   - le passage source, surligné, dit-il bien ce qu'on lui fait dire ?
   - quel est son rang dans la hiérarchie des normes ?
2. **Une mini data room** de 15 à 20 faux documents :
   - un tableau de points rouges, chaque cellule ancrée au passage exact et au texte en vigueur ;
   - un 2e juge IA qui conteste chaque point rouge.
3. **Un journal d'audit exportable en PDF**.

**Pièges** : demander l'accès production de PISTE tôt, mettre en cache les réponses des API, n'utiliser aucun vrai document client.

## Sources

- https://arxiv.org/abs/2405.20362 (Stanford)
- https://arxiv.org/abs/2608.14210 (étude droit français, août 2026)
- https://www.damiencharlotin.com/hallucinations/
- https://www.grllp.com/blog/Use-of-AI-hallucinated-cases-results-in-100K-in-penalties-and-dismissal-of-action-Couvrette-v.-Wisnovsky-885
- https://edrm.net/2026/04/the-ai-sanction-wave-145k-in-q1-penalties-signals-courts-have-lost-patience-with-genai-filing-failures/
- https://www.lexbase.fr/article-juridique/132589747-commentairelintelligenceartificiellegenerativealepreuvedupretoirelemergencedunejurispruden
- https://www.lawnext.com/2025/12/clearbrief-launches-cite-check-report-to-give-law-firm-partners-an-audit-trail-against-ai-hallucinations.html
- https://arxiv.org/abs/2606.21155 (benchmark cite-checking)
- https://arxiv.org/abs/2609.17546 (ICML 2026, validité des sources)
- https://www.harvey.ai/blog/data-room-due-diligence
- https://www.swim.legal/blog/merger-due-diligence-audit-juridique-ma
- https://claude.com/blog/introducing-citations-api
- https://arxiv.org/abs/2605.08583 (CiteTracer)
