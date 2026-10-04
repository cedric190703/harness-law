/**
 * Demo memo, “written by an AI”: a 2016 dismissal plus a non-compete clause.
 * The memo itself stays in French — it is the French legal text under test, and its
 * citations are what Saul looks up on Légifrance and Judilibre.
 *
 * It mixes sound statements with traps (to be confirmed by the team's lawyers):
 * - L1232-1, L1234-1, Cass. soc. 10/07/2002 no. 00-45.135: sound;
 * - L1121-1: a real article, but it sets no maximum duration;
 * - L1235-3: the 2017 ordinances' scale applied to facts from 2016;
 * - R1234-2: statutory severance at a quarter of a month, a 2017 rule applied to 2016 facts;
 * - L1471-1: two years, right in 2016 but the text has changed since;
 * - a judgment that does not exist, a circular presented as decisive, an old numbering.
 */
export const MEMO_DEMO = `NOTE — Dossier Martin c/ Société Delta Distribution

Rappel des faits : M. Martin, attaché commercial depuis le 2 janvier 2012 dans une société de 40 salariés, a été licencié pour insuffisance professionnelle par lettre du 15 mars 2016. Son contrat comporte une clause de non-concurrence de deux ans, sans contrepartie financière.

1. Sur la régularité du licenciement

Tout licenciement pour motif personnel doit être justifié par une cause réelle et sérieuse (article L. 1232-1 du Code du travail). Ayant plus de deux ans d'ancienneté, M. Martin avait droit à un préavis de deux mois (article L. 1234-1 du Code du travail).

Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité est plafonnée à quatre mois de salaire brut pour un salarié ayant quatre ans d'ancienneté (article L. 1235-3 du Code du travail). L'ancien article L. 122-14-4 du Code du travail prévoyait déjà ce plafonnement.

L'indemnité légale de licenciement est égale à un quart de mois de salaire par année d'ancienneté (article R. 1234-2 du Code du travail).

2. Sur la clause de non-concurrence

Une clause de non-concurrence n'est licite que si elle est indispensable à la protection des intérêts légitimes de l'entreprise, limitée dans le temps et dans l'espace, qu'elle tient compte des spécificités de l'emploi du salarié et comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière (Cass. soc., 10 juillet 2002, n° 00-45.135).

Le Code du travail limite en outre la durée de toute clause de non-concurrence à un an maximum (article L. 1121-1 du Code du travail).

La Cour de cassation juge que la nullité de la clause ouvre droit, sans autre preuve, à une indemnité forfaitaire de six mois de salaire (Cass. soc., 14 mai 2014, n° 13-17.983).

Une circulaire de la Direction générale du travail du 12 mars 2010 confirme que la clause est inopposable au salarié licencié pour insuffisance professionnelle.

3. Sur le délai pour agir

M. Martin dispose d'un délai de deux ans à compter de la notification du licenciement pour le contester (article L. 1471-1 du Code du travail).`;

export const DATE_FAITS_DEMO = "2016-03-15";
