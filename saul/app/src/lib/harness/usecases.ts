import type { DeliverableKind } from './types';

/**
 * The deliverables the harness knows how to shape, check and export.
 *
 * Each use case carries three things: the mission text the lawyer starts from,
 * the guidance appended to the agent prompt, and the table shapes the app
 * validates before anything becomes downloadable. The shapes are the reason
 * these are types and not prompt presets: a disclosure line without its
 * data-room reference, or a cap-table movement without its source, is rejected
 * and sent back to the agent for repair.
 *
 * The ledger schema and the mechanical gate belong to
 * skills/cross-document-review and are left untouched: every use case maps
 * onto the existing statuses rather than extending them.
 */

/** A column the deliverable's table must carry, named by concept. */
export interface ColumnSpec { concept: string; match: RegExp; hint: string }

export interface TableShape {
  /** Named in the repair message when the shape is missing. */
  name: string;
  columns: ColumnSpec[];
  /** Concepts whose cell must carry text on every row. */
  required?: string[];
  /** Concepts whose cell must name at least one ledger id that exists. */
  ledgerRefs?: string[];
}

export interface UseCase {
  id: string;
  kind: DeliverableKind;
  title: string;
  /** One line on the chip. */
  blurb: string;
  /** Pre-filled mission text; the lawyer edits it before launching. */
  mission: string;
  /** Appended to the agent prompt. */
  guidance: string;
  /** Every shape must be matched by at least one section table. */
  shapes: TableShape[];
  /** Enforce one schedule row per `letter-N` section. */
  letterSections?: boolean;
}

const EXCERPT: ColumnSpec = { concept: 'excerpt', match: /excerpt|quote|extract|verbatim|wording/i, hint: 'Excerpt' };
const DOCUMENT: ColumnSpec = { concept: 'document', match: /document|data.?room|exhibit|annex|source|register|minute|deed|evidence/i, hint: 'Document' };

export const USE_CASES: UseCase[] = [
  {
    id: 'disclosure-schedule',
    kind: 'disclosure-schedule',
    title: 'Disclosure schedules',
    blurb: 'Warranty exceptions, each one tied to a data-room document.',
    mission:
      'Draft the disclosure schedules against the warranties. Walk every warranty in turn, list each exception the data room requires, and tie each exception to the document that evidences it. Where a warranty needs no exception, say so. Flag any warranty you cannot test on the documents provided.',
    guidance: [
      'DELIVERABLE — disclosure schedules. Traceability is the document: an exception that does not name the data-room document behind it is worthless, and the check will reject it.',
      'Roles: REFERENCE is the warranty catalogue (the SPA warranty schedule, the draft warranties, or the warranty list the mission names). SUBJECT is the data room.',
      'Ledger: each exception is a "deviation" row — ref_quote is the warranty wording, subj_quote is the passage in the data-room document that makes it inaccurate as drafted. A warranty you cannot test is "unclear" and must say what is missing. A warranty the documents confirm is a "match" row; give its quote anyway, so the schedule can show it was tested.',
      'Sections: one per warranty group (corporate, accounts, contracts, employment, litigation, tax, IP, real estate, data), each carrying a table with EXACTLY these headers: Warranty | Exception | Document | Location | Excerpt. One row per exception. Document is the document name as given in the manifest; Excerpt is the verbatim passage, copied, never paraphrased.',
      'Open the deliverable with a section stating the warranty perimeter, the documents reviewed, and the warranties you could not test. Never soften an exception to make a warranty pass.',
    ].join('\n'),
    shapes: [{
      name: 'disclosure schedule (Warranty | Exception | Document | Location | Excerpt)',
      columns: [
        { concept: 'warranty', match: /warrant|guarante|representation/i, hint: 'Warranty' },
        { concept: 'exception', match: /exception|disclos|qualif/i, hint: 'Exception' },
        DOCUMENT,
        { concept: 'location', match: /location|where|clause|section|page|ref/i, hint: 'Location' },
        EXCERPT,
      ],
      required: ['warranty', 'exception', 'document', 'excerpt'],
    }],
  },
  {
    id: 'seller-questions',
    kind: 'seller-questions',
    title: 'Requests and questions to the seller',
    blurb: 'Follow-up list built from the gaps and inconsistencies found.',
    mission:
      'From the coverage of the data room, produce the list of additional document requests and questions to the seller. Every item must rest on a gap or an inconsistency you actually found in the documents — no generic checklist.',
    guidance: [
      'DELIVERABLE — list of additional requests and questions to the seller. It is the natural extension of the coverage report: each item exists because a finding exists.',
      'Ledger: a document the file requires but the room does not contain is a "missing" row; a document that contradicts another, or whose scope you cannot settle, is "deviation" or "unclear". Every request you write must trace back to one of those rows by id.',
      'Sections: one per workstream (corporate, contracts, employment, litigation, IP, real estate, tax, financing, data protection), each carrying a table with EXACTLY these headers: Ref | Request or question | Why it is asked | Finding | Priority. Finding holds the ledger id or ids that justify the item, e.g. "R-014" or "R-014, R-021" — the check verifies they exist.',
      'Priority is Critical, High, Medium or Low and must match the severity of the finding behind it. Write the request as it will be sent: name the document, the period and the entity. "Provide the share transfer register for 2019-2024 for Target SAS" — not "clarify corporate matters".',
      'Do not invent a request no finding supports, and do not drop a gap because it is awkward. Close with the items you consider blocking for signing.',
    ].join('\n'),
    shapes: [{
      name: 'request list (Ref | Request or question | Why it is asked | Finding | Priority)',
      columns: [
        { concept: 'ref', match: /^ref|^#|^id|^no\b|item/i, hint: 'Ref' },
        { concept: 'request', match: /request|question|ask|demand/i, hint: 'Request or question' },
        { concept: 'reason', match: /why|reason|basis|rationale|ground/i, hint: 'Why it is asked' },
        { concept: 'finding', match: /finding|ledger|source/i, hint: 'Finding' },
        { concept: 'priority', match: /priorit|severit|urgen/i, hint: 'Priority' },
      ],
      required: ['request', 'reason', 'finding'],
      ledgerRefs: ['finding'],
    }],
  },
  {
    id: 'contract-table',
    kind: 'contract-table',
    title: 'Key contracts table',
    blurb: 'Parties, term, change of control, exclusivity, termination — with the excerpt behind every cell.',
    mission:
      'Build the key contracts table with a summary sheet per contract. For each contract give the parties, the term, the change-of-control clause, any exclusivity and the termination regime. Quote the clause behind every entry.',
    guidance: [
      'DELIVERABLE — key contracts table plus one summary sheet per contract. Every statement in the table must be backed by a quoted clause in the matching sheet.',
      'Ledger: record each clause you report as a "match" row with its verbatim quote and location, so the table can be traced cell by cell. A clause that is absent where the file needs one is "missing"; a clause that contradicts another contract or the SPA is "deviation"; a clause whose scope is genuinely ambiguous is "unclear" and must say why.',
      'First section: the overview, with a table carrying EXACTLY these headers: Contract | Parties | Term | Change of control | Exclusivity | Termination. One row per contract. Keep each cell short — the detail belongs in the sheet.',
      'Then one section per contract, id "sheet-1", "sheet-2", … Each carries a table with EXACTLY these headers: Field | Value | Clause | Excerpt. One row per field, covering at least Parties, Term, Change of control, Exclusivity and Termination. Clause is the article or section number; Excerpt is the verbatim wording, copied from the extracted text.',
      'Where a contract is silent on a field, write "Silent" in Value and leave the excerpt as the passage that shows the omission (the clause list, the signature page) — do not fabricate a clause. Where a change-of-control clause exists, state plainly whether it requires consent, notice, or neither: the letters deliverable is built from that answer.',
    ].join('\n'),
    shapes: [
      {
        name: 'contracts overview (Contract | Parties | Term | Change of control | Exclusivity | Termination)',
        columns: [
          { concept: 'changeOfControl', match: /change.{0,3}of.{0,3}control|\bcoc\b|assign/i, hint: 'Change of control' },
          { concept: 'exclusivity', match: /exclusiv/i, hint: 'Exclusivity' },
          { concept: 'termination', match: /terminat/i, hint: 'Termination' },
          { concept: 'parties', match: /part(y|ies)|counterpart/i, hint: 'Parties' },
          { concept: 'term', match: /\bterm\b|duration|expir|maturit/i, hint: 'Term' },
          { concept: 'contract', match: /contract|agreement|name|title/i, hint: 'Contract' },
        ],
        required: ['contract', 'parties', 'term', 'changeOfControl', 'termination'],
      },
      {
        name: 'contract summary sheet (Field | Value | Clause | Excerpt)',
        columns: [
          EXCERPT,
          { concept: 'clause', match: /clause|section|article|provision|location/i, hint: 'Clause' },
          { concept: 'field', match: /field|item|topic|point|heading/i, hint: 'Field' },
          { concept: 'value', match: /value|summary|position|answer|content|detail/i, hint: 'Value' },
        ],
        required: ['field', 'value', 'excerpt'],
      },
    ],
  },
  {
    id: 'counterparty-letters',
    kind: 'counterparty-letters',
    title: 'Letters to counterparties',
    blurb: 'Consent requests and change-of-control notices, produced in series.',
    mission:
      'From the key contracts, draft the letters to the counterparties: a consent request where the contract requires consent on a change of control, a notification where it only requires notice. One letter per counterparty, ready to send.',
    guidance: [
      'DELIVERABLE — a schedule of letters followed by the letters themselves, one per counterparty.',
      'Ledger: the change-of-control clause behind each letter is a "match" row carrying the verbatim clause. A contract whose clause is silent or ambiguous on consent is "unclear" and gets no letter until it is resolved — list it in the schedule as open.',
      'First section, id "schedule": a table with EXACTLY these headers: Counterparty | Contract | Clause | Consent or notice | Deadline. One row per letter, in the same order as the letters that follow.',
      'Then one section per letter, id "letter-1", "letter-2", … in the schedule order. The check requires exactly one letter section per schedule row. Each letter contains: the addressee block, the contract reference with its date, the clause quoted verbatim, the request for consent or the notification, the response window the clause gives, and a signature block.',
      'Write them as sendable French-law correspondence in English drafting: formal, short, no argument. Never invent an address, a signatory name, a notice address or a completion date the documents do not give — write them as [TO COMPLETE: …] so the lawyer fills them in. Say in the schedule which letters are blocked on that information.',
    ].join('\n'),
    letterSections: true,
    shapes: [{
      name: 'letters schedule (Counterparty | Contract | Clause | Consent or notice | Deadline)',
      columns: [
        { concept: 'counterparty', match: /counterpart|addressee|recipient|part(y|ies)/i, hint: 'Counterparty' },
        { concept: 'contract', match: /contract|agreement/i, hint: 'Contract' },
        { concept: 'clause', match: /clause|section|article|provision/i, hint: 'Clause' },
        { concept: 'action', match: /consent|notice|notif|action|type/i, hint: 'Consent or notice' },
        { concept: 'deadline', match: /deadline|date|delay|period|timing|window/i, hint: 'Deadline' },
      ],
      required: ['counterparty', 'contract', 'clause', 'action'],
    }],
  },
  {
    id: 'cap-table',
    kind: 'cap-table',
    title: 'Chain of title and cap table',
    blurb: 'Every share movement reconstructed from the articles, minutes and registers.',
    mission:
      'Reconstruct the chain of title to the shares and the resulting capitalisation table from the articles, the minutes and the share registers. Source every movement, and state any break in the chain rather than smoothing it over.',
    guidance: [
      'DELIVERABLE — the chain of title to the shares, then the cap table it produces. A movement without its source document is not a reconstruction, and the check will reject it.',
      'Ledger: each movement is a "match" row whose quote is the passage in the articles, the minutes or the register that records it. A movement the documents imply but do not evidence is "missing"; two documents that disagree on a holding, a date or a share count is "deviation", with both values stated; a gap you cannot close is "unclear".',
      'First section, id "movements": the chronology, with a table carrying EXACTLY these headers: Date | Operation | Transferor | Transferee | Shares | Document | Excerpt. One row per movement, oldest first. Operation is incorporation, transfer, capital increase, reduction, split, conversion or redemption.',
      'Then a section, id "holdings": the resulting cap table, with a table carrying EXACTLY these headers: Shareholder | Shares | % of capital | % of voting rights. Figures must follow from the movements above.',
      'Then reconcile, in prose: the movements must add up to the holdings. Show the arithmetic. Where they do not reconcile, say so and name the documents that disagree — a cap table that balances because a break was ignored is the failure this deliverable exists to prevent. Close with the breaks in the chain and what would close each one.',
    ].join('\n'),
    shapes: [
      {
        name: 'movements (Date | Operation | Transferor | Transferee | Shares | Document | Excerpt)',
        columns: [
          { concept: 'date', match: /date|when/i, hint: 'Date' },
          { concept: 'operation', match: /operation|movement|event|transaction|nature|type/i, hint: 'Operation' },
          { concept: 'shares', match: /share|securit|number|quantity|count/i, hint: 'Shares' },
          DOCUMENT,
          EXCERPT,
        ],
        required: ['date', 'operation', 'shares', 'document', 'excerpt'],
      },
      {
        name: 'cap table (Shareholder | Shares | % of capital | % of voting rights)',
        columns: [
          { concept: 'holder', match: /holder|shareholder|owner|member|name/i, hint: 'Shareholder' },
          { concept: 'shares', match: /share|securit|number|quantity/i, hint: 'Shares' },
          { concept: 'capital', match: /%|percent|capital|stake|voting/i, hint: '% of capital' },
        ],
        required: ['holder', 'shares', 'capital'],
      },
    ],
  },
];

export const findUseCase = (id?: string) => USE_CASES.find(u => u.id === id);
export const findUseCaseByKind = (kind?: string) => USE_CASES.find(u => u.kind === kind);
