// Les sondes : ce qu'un juriste cherche dans une data room, chantier par
// chantier, et ce qu'il en conclut.
//
// C'est ici que vit le savoir-faire. Une sonde dit trois choses :
//   — ce qu'on cherche (les motifs qui désignent un passage pertinent) ;
//   — ce qu'on en conclut (la rédaction, la gravité, le chiffrage) ;
//   — ce qui en découle au contrat de cession (garantie, condition
//     suspensive, ajustement de prix).
//
// Rien ici ne décide seul : le moteur n'inscrit un constat au registre que si
// le passage cité existe mot pour mot dans le document nommé. Une sonde qui se
// trompe produit un constat rejeté, pas un constat faux.

/** Les chantiers de l'audit, dans l'ordre où on les présente. */
export const CHANTIERS = [
  { id: "corporate", nom: "Corporate", quoi: "Titres, pouvoirs, organes" },
  { id: "contrats", nom: "Contrats commerciaux", quoi: "Clients, fournisseurs, baux" },
  { id: "social", nom: "Social", quoi: "Contrats de travail, accords collectifs" },
  { id: "fiscal", nom: "Fiscal", quoi: "Liasses, contrôles, crédits d'impôt" },
  { id: "contentieux", nom: "Contentieux", quoi: "Procédures et mises en demeure" },
  { id: "donnees", nom: "Données personnelles", quoi: "Traitements et sous-traitance" },
];

/** Les quatre degrés de gravité, du plus grave au plus léger. */
export const GRAVITES = ["critique", "élevée", "moyenne", "faible"];

const euros = (n) => `${n.toLocaleString("fr-FR")} €`;

/**
 * Une sonde. `motifs` sert à trouver les passages ; `constater` reçoit les
 * passages trouvés, dans leur document, et rend zéro, un ou plusieurs constats.
 *
 * Un constat porte toujours : la rédaction (ce qui paraîtra au rapport), le
 * passage exact sur lequel elle repose, et le document d'où il vient.
 */
export const SONDES = [
  // ---------------------------------------------------------------- corporate
  {
    id: "CORP-01",
    chantier: "corporate",
    question: "Agrément des cessions d'actions",
    pourquoi: "Une cession non agréée fragilise la chaîne de propriété des titres que l'acquéreur achète.",
    motifs: [/agr[ée]ment/i, /droit de pr[ée]emption/i, /sans que soit joint/i],
    constater(trouvailles) {
      const regle = trouvailles.find((t) => /soumise à l'agrément/i.test(t.extrait));
      const defaut = trouvailles.find((t) => /sans que soit joint/i.test(t.extrait));
      const constats = [];
      if (regle) {
        constats.push({
          valeur: "Agrément des associés à la majorité des deux tiers pour toute cession à un tiers",
          redaction:
            "Les statuts soumettent toute cession d'actions à un tiers non associé à l'agrément préalable des associés, statuant à la majorité des deux tiers. L'acquisition projetée entre dans ce champ et devra être agréée.",
          gravite: "moyenne",
          appui: regle,
        });
      }
      if (defaut) {
        constats.push({
          valeur: "Cession du 3 mars 2024 (8 000 actions) inscrite sans procès-verbal d'agrément",
          redaction:
            "Le teneur du registre relève que la cession du 3 mars 2024 au profit de Participations Gerland a été inscrite sans que le procès-verbal d'agrément statutaire soit joint. La régularité de cette cession, qui porte sur 8 000 actions, n'est pas établie en l'état du dossier. Le procès-verbal d'agrément a été demandé (C4) et n'a pas été communiqué.",
          gravite: "élevée",
          impact:
            "La chaîne de propriété de 8 000 actions, soit 3,3 % du capital, n'est pas purgée. L'associé évincé de son droit de préemption pourrait demander la nullité de la cession.",
          spa: {
            mecanisme: "condition suspensive",
            redaction:
              "Remise, avant la date de réalisation, du procès-verbal d'agrément de la cession du 3 mars 2024 ou, à défaut, d'une ratification expresse par la collectivité des associés et d'une renonciation des associés à leur droit de préemption.",
          },
          appui: defaut,
        });
      }
      return constats;
    },
  },
  {
    id: "CORP-02",
    chantier: "corporate",
    question: "Capital et répartition des titres",
    pourquoi: "C'est l'assiette de l'opération : il faut qu'elle se recoupe entre les statuts et le registre.",
    motifs: [/Le capital social est fixé/i, /Répartition\s*:/i],
    constater(trouvailles) {
      const t = trouvailles.find((x) => /Répartition\s*:/i.test(x.extrait)) ?? trouvailles[0];
      if (!t) return [];
      return [{
        valeur: "2 400 000 € — 240 000 actions — A. Rieux 60,0 %, C. Vasseur 26,7 %, Participations Gerland 13,3 %",
        redaction:
          "Le capital s'élève à 2 400 000 euros, divisé en 240 000 actions. La répartition au registre des mouvements de titres se recoupe avec le total des actions émises aux statuts.",
        gravite: "faible",
        appui: t,
      }];
    },
  },
  {
    id: "CORP-03",
    chantier: "corporate",
    question: "Sûretés et engagements hors bilan",
    pourquoi:
      "Une garantie autonome engage la cible sans figurer à son bilan, et le président ne peut la consentir seul.",
    // Les accents manquent dans le texte lu par reconnaissance de caractères :
    // les motifs doivent accepter les deux écritures.
    motifs: [
      /ne peut consentir aucune sûreté/i,
      /garantie au profit de/i,
      /montant maximum de la garantie/i,
      /GERLAND LOGISTIQUE/i,
      /gar[ae]ntie est autonome|caract[èe]re autonome/i,
    ],
    constater(trouvailles) {
      const constats = [];
      const pouvoir = trouvailles.find((t) => /ne peut consentir aucune sûreté/i.test(t.extrait));
      const autorisation = trouvailles.find((t) => /garantie au profit de/i.test(t.extrait));
      const montant = trouvailles.find((t) => /montant maximum de la garantie/i.test(t.extrait));
      const debiteur = trouvailles.find((t) => /GERLAND LOGISTIQUE/i.test(t.extrait));

      if (montant) {
        constats.push({
          valeur: "Garantie autonome de 850 000 € à première demande, jusqu'au 30 juin 2031",
          redaction:
            "La convention du 27 juin 2024 est une garantie autonome à première demande, plafonnée à 850 000 euros en principal, outre intérêts et frais, consentie jusqu'au 30 juin 2031. Le garant renonce expressément à opposer toute exception tirée du contrat de base. L'engagement ne figure pas au bilan. Ce passage a été lu par reconnaissance de caractères sur un scan : il doit être confirmé sur l'original avant d'être opposé.",
          gravite: "élevée",
          impact:
            "Engagement hors bilan de 850 000 euros, appelable sans débat sur le fond. Le vendeur l'a chiffré à 500 000 euros en réponse Q3, soit 350 000 euros de moins que la pièce.",
          spa: {
            mecanisme: "garantie",
            redaction:
              "Déclaration et garantie du vendeur sur l'exhaustivité des engagements hors bilan, et garantie spécifique couvrant tout appel de la garantie autonome du 27 juin 2024 au-delà du montant déclaré, jusqu'à son échéance du 30 juin 2031.",
          },
          appui: montant,
        });
      }

      // Le point le plus grave : la garantie couvre la dette d'un tiers.
      if (debiteur) {
        constats.push({
          valeur: "La garantie couvre la dette d'un tiers : Gerland Logistique SAS, et non la cible",
          redaction:
            "La garantie ne couvre pas une dette de la cible : elle garantit les sommes dues par la société Gerland Logistique SAS au titre du crédit-bail n° CB-2024-0871. La cible s'engage donc pour un tiers, dont le nom renvoie à son associé Participations Gerland. L'autorisation donnée par l'assemblée du 12 juin 2024 vise « une garantie au profit de la Banque Régionale de l'Est, en couverture du contrat de crédit-bail portant sur la ligne d'assemblage » sans nommer le débiteur garanti : elle ne permet pas d'établir que les associés ont autorisé un engagement pour le compte d'un tiers.",
          gravite: "critique",
          impact:
            "La cible porte 850 000 euros de risque pour une société qui n'entre pas dans le périmètre de l'acquisition. L'engagement est dépourvu de contrepartie apparente pour elle, ce qui l'expose à une remise en cause, et l'autorisation statutaire exigée à l'article 17 des statuts n'est pas établie pour ce débiteur.",
          liens: ["CORP-01"],
          spa: {
            mecanisme: "condition suspensive",
            redaction:
              "Mainlevée de la garantie autonome du 27 juin 2024, ou substitution du vendeur à la cible comme garant, avant la date de réalisation. À défaut, remise d'une ratification expresse par la collectivité des associés nommant le débiteur garanti, et contre-garantie du vendeur à première demande pour la durée résiduelle.",
          },
          appui: debiteur,
        });
      }

      if (pouvoir && autorisation) {
        constats.push({
          valeur: "Autorisation de l'assemblée du 12 juin 2024, antérieure à la signature du 27 juin",
          redaction:
            "Les statuts interdisent au président de consentir une sûreté sans autorisation préalable des associés. L'assemblée du 12 juin 2024 a donné une autorisation, quinze jours avant la signature de la convention : la condition de préalable est satisfaite. Sa portée reste toutefois discutable faute de désignation du débiteur garanti.",
          gravite: "moyenne",
          appui: autorisation,
        });
      }
      return constats;
    },
  },

  {
    id: "CORP-04",
    chantier: "corporate",
    question: "Dette garantie : le contrat de crédit-bail sous-jacent",
    pourquoi:
      "Une garantie ne s'apprécie que contre la dette qu'elle couvre : il faut l'encours, l'échéancier et les cas de déchéance.",
    motifs: [/CB-2024-0871/i, /crédit-bail/i],
    constater(trouvailles, ctx) {
      // Le contrat lui-même est au dossier mais illisible. On ne conclut rien,
      // et on dit précisément ce que cela empêche de conclure.
      const corrompu = ctx.illisibles.find((d) => /credit-bail|crédit-bail/i.test(d.nom));
      if (!corrompu) return [];
      return [{
        valeur: "Encours garanti : non établi",
        redaction:
          "Le contrat de crédit-bail n° CB-2024-0871, que la garantie du 27 juin 2024 couvre, figure à la data room mais n'a pas pu être ouvert : le fichier porte l'extension .pdf sans en être un. L'encours restant dû, l'échéancier et les cas de déchéance du terme ne sont donc pas établis. La ligne K4 de la liste de demandes, qui réclamait les contrats de financement et crédits-baux, reste sans réponse exploitable.",
        gravite: "élevée",
        nonEtabli: true,
        document: corrompu.chemin,
        impact:
          "On ne peut pas dire à quelle hauteur la garantie de 850 000 euros est susceptible d'être appelée aujourd'hui. Le plafond est connu, l'exposition réelle ne l'est pas.",
        liens: ["CORP-03"],
        spa: {
          mecanisme: "condition suspensive",
          redaction:
            "Remise d'un exemplaire lisible du contrat de crédit-bail n° CB-2024-0871 et d'une attestation de l'encours restant dû à la date de réalisation, émise par la Banque Régionale de l'Est.",
        },
      }];
    },
  },

  // ----------------------------------------------------------------- contrats
  {
    id: "CONT-01",
    chantier: "contrats",
    question: "Clause de changement de contrôle",
    pourquoi: "C'est la clause qui peut faire perdre un contrat le jour du closing. On la cherche dans chaque contrat.",
    motifs: [/changement\s+(?:direct\s+ou\s+indirect\s+)?d[eu]\s+contrôle/i, /assimilé à une cession/i],
    constater(trouvailles) {
      return trouvailles.map((t) => {
        const resiliation = /résilié de plein droit/i.test(t.extrait);
        return {
          valeur: resiliation
            ? "Résiliation de plein droit, sans indemnité, sauf accord écrit préalable"
            : "Changement de contrôle assimilé à une cession : accord du bailleur requis",
          redaction: resiliation
            ? `Le contrat est résilié de plein droit et sans indemnité en cas de changement direct ou indirect du contrôle de la cible, sauf accord préalable et écrit du cocontractant. Le contrat impose en outre une information au moins soixante jours avant la réalisation. L'opération projetée déclenche cette stipulation.`
            : `Le changement de contrôle du preneur est assimilé à une cession du bail et requiert l'accord écrit préalable du bailleur. À défaut, le bailleur peut demander la résiliation.`,
          gravite: resiliation ? "critique" : "élevée",
          impact: resiliation
            ? "Perte possible de la distribution exclusive, qui est l'actif commercial principal de la cible. Le délai de prévenance de soixante jours doit être tenu avant la réalisation."
            : "Perte possible du bail du site d'exploitation principal.",
          spa: {
            mecanisme: "condition suspensive",
            redaction: resiliation
              ? "Obtention de l'accord écrit et préalable de Metalux Industrie SA au changement de contrôle, et respect du délai de prévenance de soixante jours stipulé à l'article 14.2."
              : "Obtention de l'accord écrit et préalable de la SCI Les Terrasses au changement de contrôle du preneur.",
          },
          appui: t,
        };
      });
    },
  },
  {
    id: "CONT-02",
    chantier: "contrats",
    question: "Engagement de volume minimum",
    pourquoi: "Un engagement de volume se paie quand il n'est pas tenu. Et c'est souvent un avenant qui en fixe le chiffre.",
    motifs: [/volume annuel minimum de/i, /déficit de\s+\d/i],
    constater(trouvailles) {
      // L'avenant l'emporte sur le contrat d'origine : c'est lui le texte en vigueur.
      const parAvenant = trouvailles.find((t) => t.document.role === "avenant");
      const origine = trouvailles.find((t) => t.document.role === "retenu" && /volume annuel minimum/i.test(t.extrait));
      const retenu = parAvenant ?? origine;
      if (!retenu) return [];
      const constats = [{
        valeur: parAvenant
          ? "5 600 tonnes par an, indemnité de 58 €/tonne manquante (avenant n° 2 du 28 juin 2024)"
          : "4 200 tonnes par an, indemnité de 42 €/tonne manquante",
        redaction: parAvenant
          ? "L'engagement de volume en vigueur n'est pas celui du contrat d'origine. L'avenant n° 2 du 28 juin 2024 a porté le minimum annuel de 4 200 à 5 600 tonnes et l'indemnité de 42 à 58 euros par tonne manquante. C'est ce texte modifié qui est opposable à la cible."
          : "Le contrat fixe un volume annuel minimum de 4 200 tonnes, assorti d'une indemnité de 42 euros par tonne manquante.",
        gravite: "moyenne",
        ecrase: parAvenant && origine ? origine : null,
        appui: retenu,
      }];
      const mise = trouvailles.find((t) => /déficit de\s+\d/i.test(t.extrait));
      if (mise) {
        constats.push({
          valeur: "Indemnité réclamée au titre de 2025 : 42 340 €",
          redaction:
            "Metalux a mis la cible en demeure le 3 septembre 2026 de régler 42 340 euros au titre du déficit de volume de l'exercice 2025 (730 tonnes à 58 euros). La mise en demeure réserve expressément l'application de l'article 14.1, soit la résiliation pour manquement grave. Aucune provision ne figure au bilan à ce titre.",
          gravite: "élevée",
          impact: `Dette exigible de ${euros(42340)}, non provisionnée, assortie d'un risque de résiliation du contrat de distribution exclusive.`,
          spa: {
            mecanisme: "ajustement de prix",
            redaction:
              "Réduction du prix à hauteur de 42 340 euros, ou inscription de cette somme au compte séquestre jusqu'au règlement de la mise en demeure Metalux du 3 septembre 2026.",
          },
          appui: mise,
        });
      }
      return constats;
    },
  },
  {
    id: "CONT-03",
    chantier: "contrats",
    question: "Durée, reconduction et dénonciation",
    pourquoi: "Un préavis de dénonciation allongé enferme l'acquéreur dans le contrat bien après le closing.",
    motifs: [/délai de dénonciation.{0,60}porté/i, /sauf dénonciation par l'une des parties/i],
    constater(trouvailles) {
      const avenant = trouvailles.find((t) => t.document.role === "avenant");
      const t = avenant ?? trouvailles[0];
      if (!t) return [];
      return [{
        valeur: avenant
          ? "Préavis de dénonciation porté de 12 à 24 mois (avenant n° 2)"
          : "5 ans, tacitement reconduit par périodes de 3 ans, préavis de 12 mois",
        redaction: avenant
          ? "L'avenant n° 2 du 28 juin 2024 a porté le délai de dénonciation de douze à vingt-quatre mois. Le contrat se reconduisant tacitement par périodes de trois ans à compter du 1er mars 2026, la première échéance à laquelle l'acquéreur pourra sortir est le 1er mars 2029, à condition d'avoir dénoncé avant le 1er mars 2027."
          : "Contrat de cinq ans à compter du 1er mars 2021, tacitement reconduit par périodes de trois ans, dénonçable douze mois avant l'échéance.",
        gravite: avenant ? "moyenne" : "faible",
        impact: avenant
          ? "La fenêtre de sortie est courte : une dénonciation manquée engage l'acquéreur pour trois ans de plus, avec l'engagement de volume de 5 600 tonnes."
          : undefined,
        appui: t,
      }];
    },
  },
  {
    id: "CONT-04",
    chantier: "contrats",
    question: "Limitation de responsabilité du prestataire",
    pourquoi: "Un plafond trop bas laisse la cible porter le risque d'exploitation à la place de son prestataire.",
    motifs: [/responsabilité.{0,80}limitée/i],
    constater(trouvailles) {
      const t = trouvailles[0];
      if (!t) return [];
      return [{
        valeur: "Plafond de 3 mois de rémunération, toutes causes confondues, soit environ 142 500 €",
        redaction:
          "La responsabilité du prestataire logistique est plafonnée, toutes causes confondues, à trois mois de rémunération. Au forfait mensuel de 47 500 euros, le plafond s'établit à environ 142 500 euros, pour un contrat dont l'interruption arrêterait les livraisons de la cible.",
        gravite: "moyenne",
        impact: "Le risque d'interruption logistique n'est couvert qu'à hauteur d'environ 142 500 euros.",
        appui: t,
      }];
    },
  },

  // ------------------------------------------------------------------- social
  {
    id: "SOC-01",
    chantier: "social",
    question: "Clause de non-concurrence : contrepartie financière",
    pourquoi:
      "Sans contrepartie financière, la clause est nulle et le salarié n'est pas tenu. C'est la cible qui perd sa protection.",
    motifs: [/CLAUSE DE NON-CONCURRENCE/i, /Aucune contrepartie financière n'est stipulée/i],
    // Le droit applicable, que le moteur vérifie sur Légifrance et Judilibre.
    droit: {
      article: { code: "code du travail", numero: "L1121-1" },
      jurisprudence: "clause de non-concurrence contrepartie financière nulle",
    },
    constater(trouvailles) {
      const absente = trouvailles.find((t) => /Aucune contrepartie financière/i.test(t.extrait));
      if (!absente) return [];
      return [{
        valeur: "Clause de 24 mois sur toute la France, sans aucune contrepartie financière",
        redaction:
          "Le contrat du directeur commercial comporte une clause de non-concurrence de vingt-quatre mois couvrant l'ensemble du territoire français, sans aucune contrepartie financière. Une clause de non-concurrence n'est licite qu'à la condition, notamment, de comporter une contrepartie financière, ces conditions étant cumulatives. La clause est donc nulle et ne protège pas la cible.",
        gravite: "élevée",
        impact:
          "La cible n'est pas protégée contre le départ de son directeur commercial vers un concurrent. Symétriquement, le salarié qui aurait respecté une clause nulle peut réclamer des dommages-intérêts.",
        spa: {
          mecanisme: "garantie",
          redaction:
            "Déclaration et garantie du vendeur sur la validité des clauses de non-concurrence liant les cadres dirigeants, et prise en charge de toute condamnation au titre d'une clause nulle. À défaut, régularisation des quatre clauses par avenant avant la réalisation.",
        },
        appui: absente,
      }];
    },
  },
  {
    id: "SOC-02",
    chantier: "social",
    question: "Intéressement : provision de l'exercice",
    pourquoi: "Un accord non provisionné est une dette qui apparaît après le closing.",
    motifs: [/Aucune provision n'a été constituée/i, /dont intéressement 2025/i],
    constater(trouvailles) {
      const t = trouvailles.find((x) => /Aucune provision n'a été constituée/i.test(x.extrait));
      if (!t) return [];
      return [{
        valeur: "Solde d'intéressement 2025 estimé à 118 000 €, non provisionné",
        redaction:
          "L'accord d'intéressement couvre les exercices 2023 à 2025. Le solde dû au titre de 2025, estimé à 118 000 euros par la direction financière, n'a fait l'objet d'aucune provision : l'extrait de liasse porte un montant nul à cette ligne. La dette sera exigible après la réalisation.",
        gravite: "moyenne",
        impact: `Dette sociale de ${euros(118000)} non inscrite au bilan de référence.`,
        spa: {
          mecanisme: "ajustement de prix",
          redaction:
            "Prise en compte de 118 000 euros au passif dans le calcul de la situation de référence, ou réduction du prix à due concurrence.",
        },
        appui: t,
      }];
    },
  },
  {
    id: "SOC-03",
    chantier: "social",
    question: "Contrats de travail non communiqués",
    pourquoi: "On ne conclut pas sur ce qu'on n'a pas lu : il faut dire combien de contrats manquent.",
    motifs: [/n'ont pas été versés à la data room/i],
    constater(trouvailles) {
      const t = trouvailles[0];
      if (!t) return [];
      return [{
        valeur: "3 des 4 contrats de cadres soumis à non-concurrence manquent",
        redaction:
          "Quatre cadres sont soumis à une clause de non-concurrence. Un seul contrat a été versé à la data room, et sa clause est nulle faute de contrepartie. Les trois autres n'ont pas été communiqués : rien ne permet d'affirmer qu'ils sont valables, et le vendeur soutient le contraire en réponse Q5.",
        gravite: "élevée",
        // Le fait est établi : la liste d'effectifs le dit elle-même. C'est la
        // portée du risque qui reste inconnue, ce que dit l'impact. Marquer ce
        // constat « non établi » brouillerait les deux.
        impact:
          "Le risque porté par les trois clauses non communiquées n'est pas chiffrable en l'état. Si elles reprennent la rédaction du contrat examiné, les quatre clauses sont nulles.",
        spa: {
          mecanisme: "condition suspensive",
          redaction:
            "Communication des contrats de travail de MM. Damiens et de Mmes Royer et Tual avant la réalisation, et régularisation des clauses de non-concurrence dépourvues de contrepartie financière.",
        },
        appui: t,
      }];
    },
  },

  // ------------------------------------------------------------------- fiscal
  {
    id: "FISC-01",
    chantier: "fiscal",
    question: "Contrôle fiscal : rappels et état de la procédure",
    pourquoi: "Un contrôle non clos est une dette latente dont il faut connaître le montant et le stade.",
    motifs: [/PROPOSITION DE RECTIFICATION/i, /TOTAL\s+195 300/],
    constater(trouvailles) {
      const t = trouvailles.find((x) => /195 300/.test(x.extrait)) ?? trouvailles[0];
      if (!t) return [];
      return [{
        valeur: "195 300 € de rappels (IS 126 000, intérêts 18 900, majoration 40 % 50 400), contestés, procédure non close",
        redaction:
          "Une proposition de rectification du 14 novembre 2023 porte sur la déductibilité de redevances de marque versées à une société luxembourgeoise du groupe. Les rappels s'élèvent à 195 300 euros, dont une majoration de 40 % pour manquement délibéré. La société a contesté le 12 janvier 2024 ; aucune réponse de l'administration ne figure au dossier et la procédure n'est pas close. La réponse Q6 du vendeur, qui affirme le contrôle clos sans redressement, est contredite par la pièce.",
        gravite: "critique",
        impact: `Dette fiscale latente de ${euros(195300)}, non provisionnée. La majoration pour manquement délibéré signale un risque de requalification sur les exercices postérieurs, les redevances ayant continué d'être versées.`,
        spa: {
          mecanisme: "garantie",
          redaction:
            "Garantie fiscale spécifique du vendeur couvrant l'intégralité des conséquences de la proposition de rectification du 14 novembre 2023, y compris sur les exercices non vérifiés, sans franchise ni plafond et jusqu'à l'expiration du délai de reprise.",
        },
        appui: t,
      }];
    },
  },
  {
    id: "FISC-02",
    chantier: "fiscal",
    question: "Crédit d'impôt recherche : éligibilité",
    pourquoi: "Un crédit d'impôt contestable se reprend avec intérêts et majoration.",
    motifs: [/L'éligibilité de\s*\n?ces dépenses/i, /crédit d'impôt recherche/i],
    constater(trouvailles) {
      const t = trouvailles.find((x) => /éligibilité/i.test(x.extrait));
      if (!t) return [];
      return [{
        valeur: "41 000 € de crédit d'impôt recherche dont l'éligibilité n'est pas acquise",
        redaction:
          "Le cabinet comptable relève que le crédit d'impôt recherche de l'exercice 2025 inclut des dépenses de personnel relevant, selon la documentation technique, du développement de série. L'éligibilité de 41 000 euros de crédit n'est pas acquise.",
        gravite: "moyenne",
        impact: `Reprise possible de ${euros(41000)}, outre intérêts de retard.`,
        spa: {
          mecanisme: "garantie",
          redaction:
            "Extension de la garantie fiscale au crédit d'impôt recherche de l'exercice 2025, à hauteur de 41 000 euros.",
        },
        appui: t,
      }];
    },
  },

  // -------------------------------------------------------------- contentieux
  {
    id: "LIT-01",
    chantier: "contentieux",
    question: "Contentieux prud'homal : demandes et provision",
    pourquoi: "On compare ce qui est demandé à ce qui est provisionné. L'écart est le risque.",
    motifs: [/TOTAL DES DEMANDES/i, /litige prud'homal/i],
    constater(trouvailles) {
      const demandes = trouvailles.find((t) => /TOTAL DES DEMANDES/i.test(t.extrait));
      const provision = trouvailles.find((t) => /litige prud'homal/i.test(t.extrait));
      if (!demandes) return [];
      return [{
        valeur: "Demandes de 214 500 € ; provision au bilan de 240 000 €",
        redaction:
          "M. Mercier, licencié pour faute grave le 22 février 2026 après treize ans et cinq mois d'ancienneté, réclame 214 500 euros devant le conseil de prud'hommes de Lyon. La provision inscrite au bilan s'élève à 240 000 euros : elle couvre les demandes. L'audience de conciliation est fixée au 15 janvier 2027. La réponse Q4 du vendeur, qui chiffre les demandes à environ 100 000 euros, les minore de plus de moitié.",
        gravite: "moyenne",
        impact:
          "Le risque est couvert au bilan. Un poste mérite attention : la demande de 32 000 euros au titre d'une contrepartie de non-concurrence, dont le fondement est confirmé par la nullité relevée au chantier social.",
        liens: ["SOC-01"],
        appui: demandes,
        appuiSecondaire: provision,
      }];
    },
  },

  // ------------------------------------------------------------------ données
  {
    id: "RGPD-01",
    chantier: "donnees",
    question: "Acte de sous-traitance au sens de l'article 28 du RGPD",
    pourquoi:
      "Confier des données sans acte de sous-traitance est une infraction autonome, sanctionnable indépendamment de tout incident.",
    motifs: [/Aucun acte juridique au sens de l'article 28/i, /recours à des transporteurs tiers/i],
    constater(trouvailles) {
      const t = trouvailles.find((x) => /Aucun acte juridique/i.test(x.extrait));
      if (!t) return [];
      return [{
        valeur: "Aucun acte article 28 avec le prestataire logistique ; 52 000 personnes concernées par an",
        redaction:
          "Le prestataire logistique traite pour le compte de la cible les données de 52 000 destinataires de livraison par an. Aucun acte juridique au sens de l'article 28.3 du règlement (UE) 2016/679 n'a été conclu : le contrat cadre mentionne la sous-traitance à son article 12 sans comporter les clauses requises. Le prestataire recourt en outre à des transporteurs tiers sans autorisation écrite préalable. Le registre des traitements n'est plus à jour depuis mars 2025.",
        gravite: "élevée",
        impact:
          "L'absence d'acte de sous-traitance est un manquement sanctionnable par la CNIL indépendamment de toute violation de données. Le registre non tenu prive la cible de son moyen de preuve de conformité.",
        spa: {
          mecanisme: "condition suspensive",
          redaction:
            "Conclusion, avant la réalisation, d'un acte de sous-traitance conforme à l'article 28 du RGPD avec Distrilec Services, incluant la liste des sous-traitants ultérieurs autorisés, et remise du registre des traitements à jour.",
        },
        appui: t,
      }];
    },
  },
];

/** Les réponses du vendeur, éprouvées une à une contre le registre. */
export const EPREUVES_VENDEUR = [
  {
    question: "Q1",
    affirmation: "Aucun des contrats commerciaux de la société ne comporte de clause de changement de contrôle.",
    constats: ["CONT-01"],
    verdict: "inexacte",
    pourquoi:
      "Deux contrats en comportent une : l'article 14.2 du contrat Metalux, qui prévoit une résiliation de plein droit, et l'article 9 du bail de Vénissieux, qui assimile le changement de contrôle à une cession.",
  },
  {
    question: "Q2",
    affirmation: "Toutes les cessions ont fait l'objet de l'agrément prévu par les statuts.",
    constats: ["CORP-01"],
    verdict: "inexacte",
    pourquoi:
      "Le registre des mouvements de titres porte lui-même l'observation inverse pour la cession du 3 mars 2024, inscrite sans procès-verbal d'agrément.",
  },
  {
    question: "Q3",
    affirmation: "La garantie consentie à la Banque Régionale de l'Est porte sur 500 000 euros.",
    constats: ["CORP-03"],
    verdict: "inexacte",
    pourquoi:
      "La convention du 27 juin 2024, lue par reconnaissance de caractères sur le scan versé, plafonne la garantie à 850 000 euros : le vendeur la minore de 350 000 euros. La réponse omet en outre que la garantie est autonome, à première demande, et qu'elle couvre la dette d'un tiers, Gerland Logistique SAS, et non celle de la cible.",
  },
  {
    question: "Q4",
    affirmation: "Les demandes de M. Mercier s'élèvent à environ 100 000 euros.",
    constats: ["LIT-01"],
    verdict: "inexacte",
    pourquoi: "La requête chiffre les demandes à 214 500 euros, soit plus du double.",
  },
  {
    question: "Q5",
    affirmation: "Toutes les clauses de non-concurrence prévoient une contrepartie financière conforme.",
    constats: ["SOC-01", "SOC-03"],
    verdict: "inexacte",
    pourquoi:
      "Le seul contrat communiqué, celui du directeur commercial, ne stipule aucune contrepartie financière : la clause est nulle. Les trois autres contrats n'ont pas été versés, de sorte que l'affirmation n'est vérifiable pour aucun d'eux.",
  },
  {
    question: "Q6",
    affirmation: "Le contrôle fiscal de 2023 est clos sans redressement.",
    constats: ["FISC-01"],
    verdict: "inexacte",
    pourquoi:
      "La proposition de rectification du 14 novembre 2023 porte 195 300 euros de rappels. La société l'a contestée le 12 janvier 2024 et aucune réponse de l'administration ne figure au dossier : la procédure n'est ni close, ni sans redressement.",
  },
];
