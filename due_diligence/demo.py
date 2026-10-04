"""Prépare un exemple partiel, ancré dans le jeu de pièces fourni par le projet."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive', type=Path, required=True)
    p.add_argument('--out', type=Path, default=Path('due_diligence/demo'))
    a = p.parse_args()
    room = a.out / 'pieces'
    room.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(a.archive) as archive:
        for member in archive.infolist():
            target = room / member.filename
            if not target.resolve().is_relative_to(room.resolve()) or member.file_size > 20_000_000:
                raise ValueError('Entrée ZIP refusée')
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(member))
    def evidence(path, start_text, end_text, clause):
        raw = (room / path).read_bytes()
        text = raw.decode('utf-8-sig')
        start = text.index(start_text)
        end = text.index(end_text, start) + len(end_text)
        return dict(path=path, sha256=hashlib.sha256(raw).hexdigest(), clause=clause,
                    line_start=text[:start].count('\n') + 1, line_end=text[:end].count('\n') + 1,
                    quote=text[start:end])
    credit = 'credit-agreement.txt'
    customers = 'material-customer-contracts.txt'
    litigation = 'litigation-and-regulatory-matters.txt'
    findings = [dict(id='DD-001', topic='Remboursement lors du changement de contrôle', workstream='Financement', priority='Élevée',
        statement='Les extraits du crédit prévoient un remboursement intégral des prêts cinq jours ouvrés après un changement de contrôle et l’arrêt immédiat des engagements du prêteur.',
        impact='Le financement de la réalisation doit intégrer le remboursement éventuel. Le montant à décaisser et les consentements disponibles restent à confirmer dans le contrat complet et le décompte du prêteur.',
        recommendation='Obtenir le contrat complet, les avenants et le décompte de remboursement ; faire confirmer par le juriste le consentement bancaire ou le refinancement à prévoir avant la réalisation.',
        question='Merci de fournir le contrat signé et ses avenants, les consentements bancaires et un décompte de remboursement à la date de réalisation.',
        selection_reason='Disposition contractuelle plus précise qu’une présentation générale de la dette ; seules des pages extraites ont été fournies.',
        consulted=[credit], evidence=[evidence(credit, '(a)  The Borrower shall repay the Loans in full,', 'make any further credit extensions.', 'Section 2.06(a) et (b)')]),
      dict(id='DD-002', topic='Exposition CDPHE contestée et absence de provision spécifique', workstream='Contentieux et environnement', priority='Élevée',
        statement='Le tableau vendeur présente deux scénarios de pénalité CDPHE : 450 000 USD selon la société et 1 162 500 USD selon l’agence. Il indique qu’aucune provision spécifique n’a été comptabilisée.',
        impact='L’écart entre les scénarios est de 712 500 USD (1 162 500 − 450 000). Il s’agit de positions rapportées par le vendeur, sans décision finale établissant une dette de ce montant.',
        recommendation='Recouper avec les courriers de l’agence et les conseils du vendeur ; soumettre au juriste l’opportunité d’une garantie spécifique ou d’une retenue, sans assimiler automatiquement le plafond allégué à une dette certaine.',
        question='Fournir les courriers CDPHE, la réponse des conseils, l’évaluation actualisée et le traitement comptable de ce dossier.',
        selection_reason='Le tableau contentieux distingue explicitement les deux positions ; la décision de l’agence et les justificatifs comptables ne sont pas fournis dans cette fiche.',
        consulted=[litigation], evidence=[evidence(litigation, '1.7  Potential penalty.', 'for the penalties asserted by CDPHE in this matter.', 'Sections 1.7 et 1.8')]),
      dict(id='DD-003', topic='Résiliation discrétionnaire du contrat Consolidated Mining', workstream='Contrats commerciaux', priority='Modérée',
        statement='Selon la synthèse vendeur, Consolidated Mining peut résilier le contrat ou un ordre de travail pour convenance avec un préavis de soixante jours.',
        impact='La durée de la relation commerciale n’est pas sécurisée par cette seule synthèse. La matérialité doit être appréciée au regard des revenus concernés et du contrat original.',
        recommendation='Obtenir le contrat original et ses avenants ; apprécier la stabilité de la relation et les assurances ou protections de prix pertinentes avec l’équipe de transaction.',
        question='Fournir le MSA CMS-MSA-2019-114 signé, les avenants et les éventuels avis de résiliation ou non-renouvellement.',
        selection_reason='La synthèse fournie contient une description précise de la résiliation ; elle ne remplace pas le contrat sous-jacent auquel elle renvoie.',
        consulted=[customers], evidence=[evidence(customers, '2.2  Termination for convenience.', 'provision is standard for agreements of this type.', 'Section 2.2')])]
    case = dict(title='Projet Ridgeline', client='Équipe acquéreur', as_of='2025-01-08',
        scope='Exemple de revue partielle du financement, des contentieux et des contrats commerciaux.',
        limitations=['Démonstration : trois constats préparés à partir des pièces fournies, sans analyse automatique du reste de la data room.',
                     'Les fichiers sont des textes et synthèses. Les références sont des lignes, pas des pages originales.',
                     'Les signatures, l’exhaustivité des contrats et la situation postérieure au 8 janvier 2025 ne sont pas vérifiées.',
                     'Aucune pièce non consultée ne doit être interprétée comme exempte de risque.'],
        documents={name:dict(decision='retenue', reason='Source de travail retenue sous réserve de l’original complet signé', sha256=hashlib.sha256((room/name).read_bytes()).hexdigest()) for name in [credit, customers, litigation]},
        findings=findings)
    (a.out / 'dossier.json').write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding='utf-8')
    print(a.out / 'dossier.json')

if __name__ == '__main__':
    main()
