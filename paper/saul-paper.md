# Saul: A Verification Layer for Legal AI Agents

**Mickael Dali · Cédric Brzyski · Baptiste Ferszterowski · Himanshu Garg · Boumanzah Youssef**

*Saul team — LLM x Law Hackathon Paris #2 (Stanford Law × Mistral AI), 4 October 2026*

*Code: `saul/app` (application), `skills/` (agent skills), `bench/` (benchmark harness).*

*Working paper, version 3, results audited 4 October 2026. Incomplete grading is explicitly separated from measured results; aggregate evidence is archived in `paper/lab-results.json`. Every figure below was re-read from the result files; measured results and inferences are labelled as such.*

## Abstract

Legal AI tools now draft memos, compare contracts and review data rooms, but lawyers cannot rely on their output: tools invent authorities, make real sources say what they do not say, and silently omit items. We ask whether a **verification layer**, which forces every claim to be tied to a verbatim, machine-checked source and every requirement of a governing document to be accounted for, makes legal AI more reliable. Saul applies this principle in three forms: an after-the-fact checker that verifies each claim of an AI answer against official French sources (Légifrance, Judilibre) under the rule *no proof, no green*; a loop that sends each problem, with its official evidence, back to the AI that wrote the text and re-verifies the correction; and a "concordance" method that an agent follows while working. On French claims whose labels were each proven on Légifrance, including references that courts found fabricated in real filings, the same Mistral model marks 17 of 42 false claims as correct when used alone, and 1 of 42 inside Saul; on the 58-claim base set, Saul flagged all 30 false claims in two passes without a false green. On Harvey's public Legal Agent Bench (LAB), we ran three agents (Legora, Claude Code with Sonnet 5.5, Mistral Medium 3.5) without and with the method on identical inputs, graded against the official rubric by two judges from different model families, which agree on 550 of 563 criterion verdicts across 13 completely graded development runs (97.7%). On development tasks, the method takes Legora from 26/38 to 38/38 (a full pass) by recovering four omitted closing deliverables, and Mistral Medium 3.5 from 36–38/52 to 48/52; it is neutral to slightly negative for Claude Code, which already solves these tasks, but the judge-then-correct loop takes Claude Code from 48/52 to a full pass on the one task it failed, by catching an arithmetic error in the documents. On ContractNLI, Saul lowers false entailments from 28% to 3% at the cost of confirming far fewer true ones. On three held-out tasks with valid paired Claude Code results under the original judge profile, the method changes criteria passed from 124/131 to 123/131 according to Opus and from 124/131 to 121/131 according to GPT; neither judge shows an increase in tasks passed. Other held-out grading remains incomplete.

## 1. Introduction

Trust is the main barrier to legal AI. In a 2025 survey of 4,457 French lawyers by the Conseil national des barreaux (CNB) and Viavoice, 64% use ChatGPT, 46% cite errors as their main concern, and 70% of non-users say they do not trust these tools. The concern has reached the courts: Charlotin's database lists 2,145 decisions dealing with hallucinated material, 14 of them in France; in one of them (administrative court of Orléans, 29 December 2025, no. 2506461), the judgment enumerates 15 nonexistent or incorrectly identified references and one real decision cited for an issue it does not concern ([judgment, “Sur les décisions juridictionnelles citées”](https://websitedc.s3.amazonaws.com/documents/TA_Orleans_n_2506461_France_29_dec._2025.pdf)). Professional tools are not immune: in a preregistered evaluation, Lexis+ AI and Westlaw AI-Assisted Research hallucinate on 17% and 33% of queries (Magesh et al., 2025). Since March 2026, the CNB's guide on ethics and AI asks lawyers to document their use of AI.

Agentic benchmarks show the same pattern at the level of complete work products. On Harvey's LAB, models pass roughly 90 to 96% of rubric criteria individually but rarely a whole task, because a task counts only if every criterion passes. On the Vals AI leaderboard of 1 October 2026, the best model completes 25.4% of tasks, Claude Fable 5 11.3%, and Mistral Medium 3.5 0.4%. In an observational analysis of agent traces, Harvey associates revise-after-check behaviour with the largest gain (+1.5 points); this is a correlation, not a controlled measurement.

Our premise is that verification should be a product layer rather than a property hoped for in each model. **Contributions:**

- **Saul**, a verification layer that checks each claim of a legal AI answer for existence, validity at the date of the facts, normative rank and support by the cited text, with a verbatim guard that prevents the verifier itself from inventing evidence, and that renders the result as a map of evidence.
- **The Saul loop**, which returns each problem with its official evidence to the AI that wrote the text and accepts a correction only if it passes the same checks.
- **A concordance method** packaged as an agent skill, and as a Legora skill: a forward pass over every requirement of the reference document, a reverse pass, verbatim quotes checked by script, and a report drafted from the ledger.
- **A controlled evaluation protocol** on public LAB tasks (pre-registered dev/test split, identical inputs, isolation of agents from rubrics and from each other, two judges from different families) a French claim set with officially proven labels, ContractNLI, and a fictional French data room with a sealed answer key.

## 2. Related work

*Every reference below was opened and checked against its primary source on 4 October 2026; the full list is at the end of the paper.*

**Legal hallucination.** Dahl et al. (2024) report hallucination rates from 58% (GPT-4) to 88% (Llama 2) on verifiable questions about US federal cases. In the first preregistered evaluation of commercial legal research tools, Magesh et al. (2025) find that Lexis+ AI and Westlaw AI-Assisted Research hallucinate on 17% and 33% of queries; their typology counts *misgrounded* answers (a real source cited for a proposition it does not support, or an inapplicable source) as hallucinations. *Mata v. Avianca* (S.D.N.Y. 2023) sanctioned counsel for filing fabricated opinions, and Charlotin's database lists 2,145 such decisions, 14 in France. On LePhantomCite, 1,300 brief excerpts with injected citation errors, agentic GPT-5 reaches 84.4% recall but 55.0% F1 (Liu et al., 2026). LexAgentHallu annotates 3,414 legal-agent instances with 27 hallucination subclasses and reports "right answer, wrong reason" (Zhou et al., 2026). Closest to our framing, a position paper at the ICML 2026 AI4Law workshop (Taranukhin and Shwartz, 2026) argues that legal hallucination is a failure of *warrant*: the authority must exist, apply in the jurisdiction, be current for the date of analysis, have the legal status claimed and support the proposition. *How Saul differs:* these works measure or define the failure; Saul turns the warrant conditions into executable checks on French official sources, and returns grey, never green, when one cannot be proven.

**Verification, attribution and grounding.** AIS (Rashkin et al., 2023) and attributed QA (Bohnet et al., 2022) define when text is supported by identified sources. The best systems lack complete citation support 50% of the time on ELI5 (Gao et al., 2023a), and only 51.5% of generative-search sentences are fully supported (Liu et al., 2023). FActScore (Min et al., 2023) and SAFE (Wei et al., 2024) check atomic facts against a knowledge source or web search; RARR (Gao et al., 2023b), self-verification (Weng et al., 2023) and Chain-of-Verification (Dhuliawala et al., 2024) let a model check its own output; GopherCite constrains supporting quotes to be verbatim (Menick et al., 2022). In law, CitaLaw evaluates sentence–citation alignment (Zhang et al., 2025), and models catch 93–100% of wrong-case citations but only 37–61% of wrong-pinpoint ones in court opinions (Verma, 2026). KeyCite flags statutes amended, repealed or held unconstitutional; Westlaw Quick Check compares a brief's quotations with the cited text; Clearbrief scores semantic support with non-generative NLP (Thomson Reuters, 2026a, 2026b; Ambrogi, 2025). *How Saul differs:* it adds checks that generic attribution ignores (version at the date of the facts, rank of the norm) and applies verbatim matching to the verifier's own evidence, not only to the generator's quotes.

**LLM-as-a-judge.** Strong judges reach over 80% agreement with humans but show position, verbosity and self-enhancement biases (Zheng et al., 2023); answer order alone lets Vicuna-13B beat ChatGPT on 66 of 80 queries (Wang et al., 2024); self-preference tracks self-recognition (Panickssery et al., 2024); even the best judges trail inter-human agreement and lean lenient (Thakur et al., 2025). Panels from disjoint model families reduce intra-model bias at lower cost (Verga et al., 2024). Debate, proposed for AI safety (Irving et al., 2018), improves factuality (Du et al., 2024) and evaluation (Chan et al., 2024); in Khan et al. (2024) it lifts non-expert judges to 76% accuracy, and judges may trust only quotes that a tool has verified against the text. In law, LeMAJ splits answers into "legal data points" (Enguehard et al., 2025), and rubric grading is standard, though rubric text alone partly predicts judge outputs (Bagaria et al., 2026). *How Saul differs:* our adversarial judge, cast as opposing counsel, verifies rather than grades, and its verdict counts only if its quote passes a deterministic check against the official text; for grading we use two judges from different families, as the LAB leaderboard does (Vals AI, 2026a).

**Legal and agentic benchmarks.** LegalBench has 162 tasks (Guha et al., 2023); its top eight models now lie within 1.6 points (Vals AI, 2026b). LexGLUE (Chalkidis et al., 2022), CUAD (510 contracts, 41 clause types; Hendrycks et al., 2021), ContractNLI (607 NDAs, 17 hypotheses with evidence spans; Koreeda and Manning, 2021), MAUD (over 47,000 merger-agreement annotations; Wang et al., 2023) and LegalBench-RAG (Pipitone and Houir Alami, 2024) test classification, extraction and retrieval. Harvey's LAB targets agentic work product: over 1,200 tasks at launch (2,010 in the public repository), 75,000+ expert rubric criteria, all-pass scoring, a best initial all-pass rate of 7.1%, and, in an observational analysis of agent traces, revise-after-check loops as the behaviour most associated with success (+1.5 points) (Grupen et al., 2026a, 2026b; Harvey AI, 2026). *How Saul differs:* these benchmarks score answers; Saul is a method attached to any agent, measured with and without on LAB, on ContractNLI and on a French claim set.

**French law, time and rank.** Legal informatics has long modelled norm versioning (Palmirani and Brighi, 2006; de Martim, 2025), and rank follows the hierarchy of norms (Kelsen, 1967). LLMs default to the most recently enacted law, and models with stronger general reasoning do worse (Huang et al., 2026); on German statutes, web search shows recency bias while fact-date extraction with version filtering helps (Prior et al., 2026); LexKairos tests effective-version identification in Chinese law (Li et al., 2026). On 32,436 versions of French tax-code articles, static RAG retrieves the date-applicable version 0% of the time and a version-aware retriever 98.3% (Cymbler et al., 2026). French resources include BSARD (Louis and Spanakis, 2022), LLeQA (Louis et al., 2023), JuriBERT (Douka et al., 2021), Court of Cassation rulings (Charmet et al., 2022), implicit Civil Code citations in Judilibre decisions (Floro et al., 2026), and the official LEGI and Judilibre open data (DILA, 2026; Cour de cassation, 2026). *How Saul differs:* prior work tests whether a model retrieves the right version; Saul checks the version a given answer relied on, at the date of the facts, and adds normative rank, which we did not find evaluated elsewhere.

**AI-assisted due diligence.** Passage identification for due diligence dates back to Roegiest et al. (2018), revisited with in-context learning by Dwivedi and Kamps (2025). LAB Diligence uses synthetic data rooms of up to 5,000 documents and 80M tokens (Pereyra, 2026); in a standard tool loop no run reads more than 1% of the room (most 0.1–0.5%) and models pass 23.3% of rubric criteria, while a recursive delegation harness adds 39.1 points on average (Grupen et al., 2026c). *How Saul differs:* instead of a harness that reads more, Saul's concordance ledger makes coverage explicit, so an omission becomes a visible row rather than a silent gap.

### 2.1 Positioning

✓ yes · ~ partly · ✗ no (or nothing found in the source).

| Work or tool | Exists | Version at date of facts | Rank of norm | Support, verbatim proof | Omissions |
|---|---|---|---|---|---|
| **Saul** (French law, any model) | ✓ Légifrance, Judilibre, case file | ✓ version in force at the date of the facts | ✓ simplified hierarchy | ✓ judge's quote checked by script; else grey | ✓ concordance ledger |
| KeyCite, Quick Check (US, commercial) | ✓ | ~ current status only | ✗ | ~ quote vs. source, not support | ~ suggests authority |
| Clearbrief (US, commercial) | ✓ | ✗ | ✗ | ~ similarity score, no excerpt | ✗ |
| LePhantomCite (Liu et al., 2026) | ✓ | ✗ | ✗ | ~ detects distortion (84.4% recall, 55.0% F1); verdict not proven | ✗ |
| Verma, 2026 | ✓ 93–100% | ✗ | ✗ | ~ pinpoints 37–61%, no excerpt | ✗ |
| FiscalQA Pro (Cymbler et al., 2026) | ~ | ✓ 98.3% (static RAG 0%) | ✗ | ~ expected values, no excerpt | ✗ |
| Prior et al., 2026 (German law) | ~ | ✓ fact-date filtering | ✗ | ✗ LLM-judge grading | ✗ |
| Taranukhin and Shwartz, 2026 | ✓ criterion | ✓ criterion | ~ "legal status" | ✓ criterion, small pilot, no script | ✗ |
| FActScore, SAFE | — | ✗ | ✗ | ~ model judgment, no verbatim excerpt | ✗ |

**What is new in Saul.**

1. **All five checks in one running tool, on French law**: existence, version at the date of the facts, rank, proven support, omissions. Each exists elsewhere separately; only Taranukhin and Shwartz enumerate them, without implementing them.
2. **Rank of the norm**: we found no benchmark or tool that checks where a source sits in the hierarchy of norms (for instance a circular presented as binding).
3. **The verbatim guard applied to the verifier, in legal verification**: the opposing-counsel judge must quote a passage that a script finds in the official text, otherwise its verdict is discarded and the claim turns grey. Khan et al. (2024) do this for debate over stories; we did not find it for auditing a legal AI answer.
4. **Auditing the version an existing answer relied on**: work on time (FiscalQA Pro, Prior et al., Huang et al.) measures whether a model retrieves the right version; Saul checks after the fact the version another AI relied on, and shows the old and new texts side by side.
5. **A controlled intervention on LAB**: Harvey observes that agents that verify then correct score 1.5 points higher, as a correlation in traces; we run the intervention (same tasks, same documents, three agents, two judges from different families).

**What we do not claim.**

1. Checking that a citation exists and remains valid, and comparing a quotation with its source: citators (KeyCite) and Westlaw Quick Check do this; LePhantomCite and Verma (2026) already measure detection of fabricated, distorted or off-point citations.
2. Verbatim-verified quotes, adversarial judges and judges from different families: GopherCite (Menick et al., 2022), Khan et al. (2024), Irving et al. (2018) and Verga et al. (2024); the LAB leaderboard already grades with two judges (GPT-5.5 and Claude Sonnet 4.6).
3. Selecting the version in force at the date of the facts, and splitting an answer into claims: FiscalQA Pro already does the former on French tax law (98.3%), Prior et al. filter versions by fact date, LEGI keeps every version, and atomic decomposition comes from FActScore and SAFE.

## 3. System

### 3.1 Three failure modes, four checks

Saul targets three failure modes of legal AI output: a **fabricated or inapplicable source** (nonexistent, repealed, of the wrong rank), a **misgrounded claim** (a real source made to say something it does not say), and an **omission** (a requirement of the governing document that the output never mentions). An answer is first split into claims, each with the sources it cites. Each cited source then goes through four checks:

1. **Existence.** The source is retrieved from Légifrance (codes, statutes, decrees) or Judilibre (Court of Cassation decisions) through the official PISTE API, or from the case file for exhibits. Not found is red; an unidentifiable reference ("settled case law") is grey.
2. **Validity at the date of the facts.** For codified articles, Saul retrieves every historical version and selects the one in force at the date of the facts. No applicable version is red; a version that differs from today's text is orange, and the two texts are shown side by side.
3. **Rank.** A simplified hierarchy of norms (constitution, treaties, statutes, decrees, orders, circulars, case law). A circular invoked as binding is orange.
4. **Support.** An adversarial judge, prompted as opposing counsel, decides whether the applicable text supports the claim (supports, partial, does not support, off-topic). It must quote a passage from the official text; a script checks that the quote appears verbatim after normalization (at least 12 normalized characters). A verdict whose quote cannot be found is discarded and the claim turns grey.

The claim takes the worst status of its sources. The governing rule is **no proof, no green**: an API failure, a vague citation or an unverifiable quote yields grey, never green. In the web application, extraction and judging use Mistral Large (`mistral-large-latest`).

### 3.2 The Saul loop: judge, then send back for correction

Saul does not rewrite the text in place of the AI. After the first verification, every orange or red passage is returned to the model that wrote the memo, together with its evidence: status, message, verbatim official excerpt and the version applicable at the date of the facts. The model returns only corrected passages; the rest of the memo is kept word for word by construction. Each corrected passage, including any new reference it introduces, is verified again like the others and is kept only if it comes out green or orange; otherwise the previous passage stays and the rejection reason is sent back at the next round. The loop stops when no red remains, after at most two rounds. The interface shows the counts per version, the final memo in tracked changes, and an audit log of what was flagged, corrected, rejected and left.

For agent deliverables on LAB, the loop has the same shape. An independent reviewer (Mistral Medium 3.5, which never sees the rubric) reads the deliverable against the documents, lists what is missing, what is false and every figure it recomputes by script, and quotes each point verbatim (checked by script). The review goes back to the agent that wrote the deliverable, which must check each point against the documents, correct what holds and ignore what does not; the corrected deliverable is then graded like any other.

### 3.3 Two forms for agents

**After the fact.** A lawyer pastes an AI-written memo and the date of the facts. Saul returns a map of evidence: claims on one side, official sources on the other, one colored link per verification, and, on click, the controls, the adversarial reasoning and the highlighted passage. A Claude Code skill (`/verifier-sources`) produces the same map; the agent running the skill extracts and judges while scripts perform retrieval, the date and rank checks, the verbatim guard and the rendering. Both share one rule module, so they return the same verdicts.

**During the work.** The same principle, packaged as a skill for agents that compare documents ("cross-document review"). The agent must:

1. assign roles: the reference document (what governs), the subject (what is checked), context documents;
2. **forward pass**: walk the reference section by section, including definitions and schedules, and write one ledger row per operative requirement, with a verbatim quote and its location;
3. find each row's counterpart in the subject and label it *match*, *deviation* or *missing*;
4. **reverse pass**: add rows for subject content with no basis in the reference;
5. pass a **scripted gate** that checks every quote verbatim, every row's completeness, every document's use, and lists figures no row covers yet;
6. draft the report **from the ledger**, then re-check the report against the ledger before delivery.

For Legora, the same method text was first pasted after the task instruction (Appendix A.3), then installed as a Legora skill ("Visa - Cross-document verification"); Legora selected that skill on its own for a test task whose instruction matched the skill's activation description.

## 4. Experimental setup

**Tasks.** We use M&A tasks from the public LAB release that require cross-referencing documents. At 14:14 on 4 October 2026, before running any of them, we fixed a split in `bench/split-ma.json` (seed 20261004), committed at 14:37 before any test grading: three **development** tasks, on which we read rubrics and failures and may adjust the method, and seven **test** tasks, whose rubrics are never read and which are measured once.

| Split | Task | Documents |
|---|---|---|
| dev | compare-closing-checklist-against-ma-agreement | 2 |
| dev | review-disclosure-schedules-against-representations-for-completeness | 5 |
| dev | compare-closing-docs | 12 |
| test | 7 tasks (change of control ×2, disclosure schedule issues, data room red flags, third-party consents, representations vs. diligence, disclosure schedule markup) | 5 to 19 |

**Agents.**

- **Legora** (web product). Documents are uploaded and the task instruction is pasted verbatim. Legora proposes a plan, which we approve unchanged. The deliverable is downloaded and graded. For test tasks, each task gets its own Legora project, because Legora lists project files and could otherwise read another task's documents.
- **Claude Code with Sonnet 5.5** (subscription). Each run happens in a fresh workspace containing only the documents and the instruction, with an adaptation of Harvey's system preamble and Harvey's file-format skill manuals. Personal instructions, memory, plugins, MCP servers and web tools are disabled, and the loaded configuration is recorded for each run.
- **Mistral Medium 3.5** (API, reasoning effort "high" requested), run in Harvey's official harness: a network-less container with Harvey's seven tools.

**Conditions.** Each agent runs each task *without* and *with* the method, on identical documents and instructions. For Claude Code and Mistral, *with* adds the skill manual and its scripts, as Harvey's harness does for skills; for Legora, it adds the method text or the Legora skill.

**Grading.** We use the official rubric and the official per-criterion judge prompt (`rubric_criterion`). Two judges grade independently: Claude Opus 5.5 at maximum reasoning effort and GPT-5.5 at high effort. Both run through subscription command-line clients (Claude Code, Codex) without tools. A task passes only if all criteria pass.

**Safeguards.**

- Agents never see `task.json`, which holds the rubric. A run whose tool calls touch `task.json`, the benchmark checkout or another run's workspace is flagged and excluded.
- Workspaces are archived and made unreadable once a run ends; each run has its own temporary directory, and the parent directory of workspaces cannot be listed.
- We audited every kept run's transcript and found no run that read another run's files or any rubric. Incidents are listed in Section 7.

**Differences from the official leaderboard.** We use public tasks, whereas Vals uses held-out tasks. Claude runs in Claude Code rather than in Harvey's harness, so tools and system prompt differ. Our judges are Opus 5.5 and GPT-5.5 through subscriptions, whereas Vals uses GPT-5.5 and Claude Sonnet 4.6 through APIs. Our results are therefore comparable across our conditions, not to leaderboard figures.

## 5. Results

### 5.1 Development tasks on LAB

Scores are criteria passed out of the task's criteria, given as Opus 5.5 / GPT-5.5 when the two judges differ. "With" is the concordance method; "with the loop" is the benchmark loop of Section 3.2 applied to the deliverable written without the method.

| Agent | Task 1: closing checklist vs. agreement (38) | Task 2: disclosure schedules vs. reps (52) | Task 3: closing documents (33) |
|---|---|---|---|
| Legora, without | 26 | 45 | not run |
| Legora, with | **38 (pass)** | not run | not run |
| Claude Code, without | **38 (pass)** | 48 | **33 (pass)** |
| Claude Code, with | 37 | 48 / 50 | **33 (pass)** |
| Claude Code, with the loop | — | **52 (pass)** | — |
| Mistral Medium 3.5, without | 23 † | 38 / 36 | 18 / 19 |
| Mistral Medium 3.5, with | 25 † | **48** | incomplete / 25 ‡ |

† Graded by Claude Sonnet 5.5 only; dual grading pending.

‡ GPT completed grading (25/33); Opus returned 8 grading errors. Its 18 passed criteria are not a complete score and are excluded from comparisons and judge-agreement statistics.

**Legora, task 1.** Without the method, Legora finds every value discrepancy (escrow amount, indemnification cap, escrow period, transition services fee, non-compete term, outside date, and an internal inconsistency in the buyer's name) and cites its sources. It misses all four closing deliverables that the agreement requires and the checklist omits: the FIRPTA certificate, the Northwind Aerospace consent, the title insurance commitment and the landlord estoppel certificate. These four omissions account for 11 of its 12 failed criteria, because each one is graded separately for identification, section reference, recommendation and, for FIRPTA, severity; the twelfth is the closing-payment reconciliation. With the method, the same tool recovers all four omissions and passes all 38 criteria, even though it inverted the roles and took the checklist as reference; we infer, without having measured it, that the reverse pass surfaced the missing deliverables.

**Mistral Medium 3.5, task 2.** The method adds 10 criteria according to Opus 5.5 (38 to 48) and 12 according to GPT-5.5 (36 to 48), without producing a pass. On task 1 it adds two (23 to 25, single judge). Mistral followed the method's steps (54 turns against 20 on task 1), and its runs were slowed by API rate limits.

**Claude Code.** Claude Code already solves tasks 1 and 3 without the method and comes within four criteria on task 2. With the method, it loses one criterion on task 1 (the report never shows the reconciliation $87.5M − $5.25M escrow − $3.5M holdback = $78.75M), ties on task 3, and ties or gains two criteria on task 2 depending on the judge. On task 2, both conditions miss the same planted error: in the financial exhibit, total current liabilities are stated as $4.8M although the components sum to $4.9M ($2.6M + $1.4M + $0.9M). Neither the agent nor the method recomputes the figures of the documents.

**Claude Code with the loop, task 2.** An independent reviewer (Mistral Medium 3.5, without the rubric) read the deliverable Claude Code wrote without the method against the data room, quoted each point verbatim (checked by script) and recomputed every figure by script. It returned 5 blocking points (1 omission, 4 calculations) and 5 minor ones. Claude Code checked each point against the documents, kept the one that held (the $4.8M against $4.9M error), set aside three recomputations that were wrong, and corrected its report in one round (83 seconds, about $0.42). The corrected report passes all 52 criteria according to both judges (48 before); the four criteria recovered all concern that arithmetic error. This is a development task and a single run.

**Mistral Medium 3.5, task 3.** GPT-5.5 gives 25/33 with the method (19 without). Opus grading with the method has 8 errors and is incomplete. Missing verdicts must not be counted as disagreements or failures; we cannot claim a gain confirmed by both judges for this cell.

**Judge agreement.** Over thirteen development runs completely graded by both judges (563 criterion verdicts), Opus 5.5 and GPT-5.5 agree on 550 (97.7%). The incomplete Mistral skill run on task 3 is excluded, rather than treating grading errors as model disagreements. On task 1 they agree on all 152 verdicts of the four dual-graded runs. This small sample does not establish the absence of judge self-preference.

### 5.2 Held-out test tasks (7 tasks, measured once)

The table reports only identical tasks with complete, valid results in both conditions. Scores are Opus 5.5 (effort max) / GPT-5.5 (effort high), the original judge profile. We read aggregate scores only; held-out criterion verdicts and reasoning remain sealed. All runs and grading status are archived in `paper/lab-results.json`.

| Agent / paired subset | Tasks passed without | Tasks passed with | Criteria passed without | Criteria passed with |
|---|---|---|---|---|
| Claude Code, method (3 tasks) | 1/3 / 2/3 | 1/3 / 0/3 | 124/131 / 124/131 | 123/131 / 121/131 |
| Claude Code, loop (2 tasks) | 1/2 / 2/2 | 1/2 / 2/2 | 75/76 / 76/76 | 75/76 / 76/76 |
| Legora, method (1 task) | 0/1 / 0/1 | 0/1 / 0/1 | 31/38 / 28/38 | 31/38 / 31/38 |

The three Claude Code method pairs are `extract-change-of-control-provisions`, `identify-disclosure-schedule-issues`, and `compare-target-representations-vs-diligence`. The loop pairs are the latter two. Legora was measured on `identify-disclosure-schedule-issues`. These partial results do not demonstrate improved task completion on held-out tasks. The loop has not improved scores on its two completed test pairs.

**Incomplete and excluded results.** The seven-task evaluation is not complete. The isolation detector excludes two runs: `track-third-party-consents` with the method and `analyze-disclosure-schedule-markup-against-merger-agreement` without it. Their opposite conditions cannot form valid pairs. Other runs have unfinished or incomplete grading; several Opus medium regrades contain 2–15 grading errors. We neither turn those errors into failures nor substitute a more favorable regrade for the original profile. For example, the baseline on `compare-target-representations-vs-diligence` receives 37/38 from the original Opus max judge and 38/38 on its medium regrade; the table retains the original profile. Pending runs are not scored as zero, and the denominators above are paired subsets, not all seven tasks.

**Last eight grading jobs (Opus medium / GPT high).** All eight produced score files. Only one Opus medium result is complete; all eight GPT results are complete. Incomplete Opus results stay unscored in the table below. No grading job was relaunched after the usage limit.

| Task / condition | Opus medium | GPT high |
|---|---|---|
| extract-change-of-control-provisions / skill | incomplete (3 grading errors) | 49/55 |
| analyze-change-of-control-provisions-across-targets-material-contracts / base | incomplete (15 grading errors) | 48/57 |
| analyze-change-of-control-provisions-across-targets-material-contracts / skill | incomplete (13 grading errors) | 48/57 |
| review-data-room-red-flag-review / base | incomplete (2 grading errors) | 42/50 |
| review-data-room-red-flag-review / skill | incomplete (6 grading errors) | 46/50 |
| track-third-party-consents / base | incomplete (13 grading errors) | 53/60 |
| track-third-party-consents / skill (excluded: isolation) | incomplete (10 grading errors) | 48/60 |
| compare-target-representations-vs-diligence / base | 38/38 | 38/38 |

### 5.3 French claim set (after-the-fact Saul)

**Set.** Nine short memos "written by an AI" (dismissal, hiring, fixed-term contracts, distribution, online sale, residential lease, harassment, civil procedure), each with its date of the facts, contain 58 claims with a cited source. Each label was proven on the official databases by a script, without a model: existence, applicable version and its dates, a verbatim excerpt of that version grounding the label, absence from Légifrance and Judilibre for invented references, and the exact title for circulars. Labels: 25 green (true), 22 red (4 nonexistent articles, 4 invented decisions, 4 texts not in force at the date of the facts, 10 misstatements of a figure, period or condition), 8 orange (5 texts amended since the facts, 3 circulars presented as binding), 3 grey (vague references). Two further blocks: 7 harder cases (old article numbering, a period off by one unit, a decision with the wrong year or the wrong chamber, a text changed after the facts), and 5 references that French courts found fabricated or misattributed in real filings, taken from Charlotin's database and each confirmed on Légifrance and Judilibre.

**Baseline.** "Model alone" is the same model (Mistral Large, `mistral-large-latest`), given each claim, its source and the date of the facts with the same color definitions, but without Légifrance and without the guard.

| Block | False claims | Saul: false claims marked green | Model alone: false claims marked green |
|---|---|---|---|
| Base set (58 claims) | 30 | **0** (two complete passes) | 12 (40%) |
| Harder cases | 7 | **1** (wrong chamber) | 4 (57%) |
| Real court cases (Charlotin) | 5 | **0** | 1 (20%) |
| **Total** | **42** | **1 (2%)** | **17 (40%)** |

The model alone validates as correct, among others, invented decisions ("the decision exists"), a six-month probation period for an executive (the law says four), an eight-day withdrawal period (fifteen) and a ten-year limitation period (five). Saul's single false green is a real decision cited with the right number, date and content but the wrong chamber (a plenary-assembly ruling cited as a third civil chamber ruling): Saul checks a decision's date, not its formation. A chamber check is written and tested offline but was not enabled before the demonstration.

| Base set, two complete passes on an empty cache | Pass A | Pass B |
|---|---|---|
| False claims (red or orange expected) not marked green | **30 / 30** | **30 / 30** |
| False greens (non-green expected, marked green) | **0 / 33** | **0 / 33** |
| False reds (true claims marked red) | 0 / 25 | 1 / 25 |
| True claims confirmed green | 12 / 25 | 12 / 25 |
| Exact color | 43 / 58 | 43 / 58 |

Every error type was flagged in every instance (invented decisions 4/4, nonexistent articles 4/4, not in force 4/4, misstatements 10/10, amended texts 5/5, circulars 3/3, vague references 3/3). Extraction and retrieval missed nothing on this set; every color error comes from the judge. The price is caution: about half of the true claims come out orange, because the judge answers "partial" on wording details, whereas the model alone marks 24 of 25 true claims green. The one false red (pass B) is a long Court of Cassation decision whose conclusion lies beyond the 15,000 characters the judge reads. A stricter definition of "partial" kept zero false greens and raised true greens to 17/25, but produced 3 false reds; we kept the current judge, since a false red wrongly accuses the lawyer. A full pass costs about $0.06 (53 Mistral calls) and takes 5 to 13 minutes, bound by the shared rate limit of the API key.

### 5.4 The Saul loop on the demonstration memo

On the demonstration memo (a 2016 dismissal and non-compete clause, ten claims), the first verification found 5 false claims, 3 to review and 2 verified. After one round of the loop, the second version had 0 false claims, 4 to review and 2 verified. The model rewrote two passages against the version in force on 15 March 2016: "capped at four months' salary" became "the indemnity, payable by the employer, cannot be lower than the last six months' salaries (article L. 1235-3 of the Labour Code, in its version in force on 15 March 2016)", with the official excerpt found verbatim; the statutory severance of "a quarter of a month per year of service" became one fifth, plus two fifteenths beyond ten years (article R. 1234-2, same date). It deleted four passages: a false "one-year maximum", a real decision cited for something it does not say, a circular presented as binding, and an old article number (L. 122-14-4) that Saul reported as not found although it did exist, most likely a retrieval miss, so that deletion was over-cautious. While the correction step was being developed, the guard rejected two proposed corrections: one cited an invented article (L. 1121-5), the other an off-topic Social Security Code article. Corrected passages mostly remain orange, because the current rule flags any text amended since the facts even when the correct version is cited; and the A3 rewrite omits that in 2016 the six-month floor applied only with two years of service and eleven employees (article L. 1235-5), because Saul only sees the cited article. This is a single demonstration run, not reviewed by a lawyer. The loop on LAB deliverables is reported in Section 5.1 (one development task); completed held-out loop pairs are reported in Section 5.2; a third remains incomplete.

### 5.5 Due diligence on a French data room

A fictional French data room (Orionis Mobility, 159 documents in 18 standard rubrics) was built by a team member with 16 planted anomalies; the answer key stayed sealed from the people writing the method and was opened only by an independent grader. Claude Code (Sonnet 5.5) reviewed the room without and with a due diligence method (inventory, coverage register, verified excerpt for each red flag, cross-checks between rubrics). Each planted anomaly was graded found, partial or missed by both judges, which agreed on all 16 in both runs.

| Claude Code, Sonnet 5.5 | Without the method | With the method |
|---|---|---|
| Planted anomalies found (partial) | 15 (1) / 16 | 15 (1) / 16 |
| Report excerpts found verbatim in the data room | 174 / 183 (95%) | 180 / 180 (100%) |
| Documents cited in the report | 108 / 159 (68%) | 110 / 159 (69%) |

The method changes nothing on recall, which is already near the ceiling on a room of this size, and makes every quoted excerpt checkable. Excerpts too short to be checked were left out of the count (45 without, 107 with the method), so the two proof rates do not cover the same excerpts. One run per condition.

### 5.6 ContractNLI

On 150 test pairs of ContractNLI (Koreeda and Manning, 2021), drawn with seed 20261004 (50 entailment, 50 contradiction, 50 not mentioned, whole contract given), we compare Mistral Large alone with the same model inside Saul (opposing-counsel judge and verbatim guard, unchanged). A "false green" is a non-entailed hypothesis declared entailed; a grey is never a false green.

| | Model alone | Saul |
|---|---|---|
| **False greens** | **28 / 100 (28%)** | **3 / 100 (3%)** |
| Precision of greens (entailment) | 39 / 67 (58%) | 13 / 16 (81%) |
| True entailments confirmed (recall) | 39 / 50 (78%) | 13 / 50 (26%) |
| Accuracy, three labels | 91 / 150 (61%) | 54 / 150 (36%) |
| Verdicts discarded by the guard (grey) | — | 23 / 150 (15%) |

The three false greens of Saul are also false greens of the model alone; Saul avoids 25 of its 28 and creates none (exact McNemar test, p ≈ 6 × 10⁻⁸). When Saul quotes, it quotes the right place: 82 of 88 verified excerpts overlap an official evidence span. Two findings temper this. First, **the guard did not remove any false green on this set: the opposing-counsel stance did**; removing the guard gives the same 3 false greens and two more correct greens. Second, Saul has no real "not mentioned" answer (its judge says "does not support"), and it disputes general hypotheses that the contract qualifies, hence the drop in accuracy. A remaining error type is negation by exception: a verbatim quote can be real while another clause of the contract overrides it. Cost: 300 calls, about $0.47 and 54 minutes, bound by the rate limit.

## 6. Discussion

**Why 38/38 here while the leaderboard reports 10 to 25%.** LAB scores are all-or-nothing per task. If an agent passes each criterion with probability 0.95 independently, it passes all 38 criteria of task 1 with probability 0.95^38 ≈ 0.14, which is the order of magnitude of the leaderboard. On a due diligence task with 500 criteria, the same agent would almost never pass (0.95^500 ≈ 7 × 10^−12). A passed task is therefore consistent with a low aggregate pass rate. Our development tasks are also short (2 to 12 documents), our harness for Claude (Claude Code) and our judges differ from the leaderboard's (Section 4), and public tasks may have been seen in training, which we cannot verify.

**What the method contributes.** The failures the method removes are mostly **omissions**: Legora's baseline report on task 1 is accurate on every discrepancy it reports but misses every absent deliverable, and Mistral's gains on task 2 come with a systematic walk through every representation. All-or-nothing scoring punishes omissions most, since one missing deliverable costs three or four criteria. The forward pass turns "find the deviations" into "account for every requirement", and the reverse pass catches what the forward framing misses.

**When it does not help.** When the agent already covers the task, as Claude Code does on these development tasks, the method adds constraints without adding coverage, and can cost a criterion (task 1). The one error that neither the agent nor the method caught, a miscomputed exhibit total, is exactly what the loop's reviewer catches by recomputing every figure by script; with it, Claude Code passes task 2. The reviewer is also wrong at times (three of its four recomputations did not hold), which is why the agent checks each point against the documents before correcting. This was measured on one development task only.

**After-the-fact verification.** On ContractNLI, false greens drop from 28% to 3%, but the cost is high (true entailments confirmed fall from 78% to 26%), and the guard is not what removes the false greens; the adversarial stance is. The guard's role is different: it makes every green come with a passage the lawyer can check. On the French claims, the same model goes from 40% to 2% false greens once it must find the official text and quote it verbatim: the gain comes from the retrieval and the guard, not from a better model. The cost is caution (half of the true claims need a second look), which is the right side to err on for a lawyer but limits time savings. Two changes would remove the observed errors: checking the chamber of a decision (the one false green) and giving the judge the relevant passage of long decisions (the one false red).

## 7. Limitations

- **Small n and a single run per condition.** Agent runs vary; three development tasks and partial held-out subsets cannot establish an effect size. Missing and excluded test runs limit interpretation.
- **Development tasks read before the Legora method text was pasted.** The text is the generic method from the skill, written earlier, and was not tailored to the omissions it recovered, but only held-out results can show that the method generalizes.
- **Non-official judges.** The judges run through subscription clients that do not expose temperature; Mistral's runs on task 1 were graded by one judge only. Rubric text may partly drive judge outputs (Bagaria et al., 2026).
- **Public tasks.** Possible training contamination.
- **Human steps in Legora.** Plan approval is manual, although identical across conditions. Legora inverted reference and subject in the method condition of task 1.
- **Different harnesses.** Claude Code and Legora are not run in Harvey's harness, so cross-agent comparisons mix model and tool effects; within-agent comparisons (without vs. with) do not.
- **Team-written French set.** Labels are proven on official sources by script, but the claims were written by the team and not yet reviewed by an independent lawyer. The memos are cleaner than real AI answers (one claim per paragraph), the invented decision numbers fall in a range the Court of Cassation does not use, and only the existence of circulars is checked, not what they are said to contain. Zero false greens on 30 false claims is compatible with a true rate of up to about 10% (rule of three, 95%); the baseline uses a single prompt and a single pass. Coverage is limited to 19 codes plus a few statutes and decisions, with no EU law or collective agreements (those stay grey).
- **Isolation incidents, found and fixed during the day.** (1) An agent under test ran `pkill -f soffice`; because every Claude Code command line contained the word "soffice" (in the inherited file-format manual), this killed concurrent runs. Killed runs produced no deliverable and were re-run; the system prompt now goes through a file. (2) Sub-sessions launched from our scripts inherited the environment of the team's coordinating session, including its messaging channel and token; an interruption of that session could reach them, and an agent under test could in principle have messaged the team. We stripped these variables from every run; the audit of all kept transcripts found no use of messaging tools. (3) Earlier, a shared `/tmp`, listable sibling workspaces and large tool outputs stored outside the workspace were closed. One run was lost to an archiving error and re-run, and one exploratory run that loaded personal settings is excluded.

## 8. Conclusion and future work

A verification layer is cheap to add and agent-agnostic. On the first M&A task it turned a failing commercial tool into a passing one by forcing it to account for every requirement of the governing document; on the 58-claim French base set it flagged all 30 false claims without a single false green (the expanded set contains one false green among 42 false claims); and its loop returns proven problems to the AI that made them. Next steps:

- complete the held-out LAB measurement, and have the French claim set reviewed by independent lawyers;
- give the judge a real "not mentioned" answer and accept quotes cut with an ellipsis when every piece is verbatim and in order;
- time a lawyer verifying the demonstration memo by hand versus with the evidence map;
- grade with the official API judges;
- extend the method to due diligence over full data rooms (2,600 to 4,000 documents per LAB task) with an inventory, a coverage register and a verified extract for each red flag.

## Appendix A. Reproducibility

All code is in `github.com/cedric190703/harness-law`. The version-3 evidence snapshot and paper are on branch `youssef/resultats-papier`. The LAB checkout lives in `harvey-labs/` (not committed).

### A.1 Commands

```bash
# Harvey's harness (Mistral), without and with the skill, graded by two judges
python3 bench/run.py --model mistral-medium-3.5 --effort high \
  --tasks <task> --judges "claude-code-opus-5-5@max" "codex-gpt-5.5@high"

# Claude Code through the subscription, isolated workspace, grade later
python3 bench/externe.py claude-code <task> --model sonnet [--skill] --pas-noter

# A deliverable produced in another tool (Legora)
python3 bench/externe.py preparer <task>
python3 bench/externe.py importer <task> --source legora --fichier <file> [--condition skill]

# (Re)grade existing runs with both judges
python3 bench/externe.py noter <run_id> --judges "claude-code-opus-5-5@max" "codex-gpt-5.5@high"

# Aggregate evidence snapshot (no API calls, no held-out rubric export)
python3 bench/paper_snapshot.py /path/to/harvey-labs/results > paper/lab-results.json

# Review pages and dashboard
python3 bench/revue.py <task>
python3 bench/tableau.py

# Saul application (code name Visa): lint, types, tests; French claim set
cd saul/app && bun run check && bun scripts/eval.ts
```

### A.2 Runs reported in Section 5.1

Run identifiers under `harvey-labs/results/corporate-ma/<task>/`.

| Task | Agent | Without | With |
|---|---|---|---|
| 1 | Legora | `legora-base/20261004-131842-558458` | `legora-skill/20261004-133520-495811` |
| 1 | Claude Code | `claude-code-sonnet-base/20261004-131336-947962` | `claude-code-sonnet-skill/20261004-131831-582658` |
| 1 | Mistral | `mistral-medium-3.5-high-base/20261004-132603-069767` | `mistral-medium-3.5-high-skill/20261004-132603-069885` |
| 2 | Legora | `legora-base/20261004-150946-572367` | not run |
| 2 | Claude Code | `claude-code-sonnet-base/20261004-134830-495786` | `claude-code-sonnet-skill/20261004-133851-230603` |
| 2 | Mistral | `mistral-medium-3.5-high-base/20261004-141516-096437` | `mistral-medium-3.5-high-skill/20261004-143737-681436` |
| 3 | Claude Code | `claude-code-sonnet-base/20261004-133414-134739` | `claude-code-sonnet-skill/20261004-134412-236589` |
| 3 | Mistral | `mistral-medium-3.5-high-base/20261004-150829-400171` | `mistral-medium-3.5-high-skill/20261004-152000-494852` (Opus incomplete) |

### A.3 Method text pasted into Legora (task 1)

> Compare the attached APA against the closing checklist and produce a categorized, severity-rated deviation report. Output: `closing-checklist-deviation-report.docx`.
>
> Use this verification method (concordance table). One missed or misstated item makes the report wrong, so trade speed for completeness:
>
> 1. Roles: identify the REFERENCE document (what governs), the SUBJECT document (what is checked) and any context documents. Read every document in full.
> 2. Forward pass: build a concordance table (use a Tabular Review if helpful). Walk the REFERENCE section by section, including definitions, schedules and exhibits. Every operative requirement gets a row (term, amount, date, party, condition, deliverable, certificate, consent, schedule), not only the ones that look important. For each row: reference section + verbatim quote, the SUBJECT counterpart + verbatim quote, and a status: match / deviation / missing (in the reference, absent from the subject).
> 3. Reverse pass: walk the SUBJECT section by section and add a row for anything with no basis in the reference (added), including wrong cross-references.
> 4. Omissions are deviations. Treat every "missing" row as a finding.
> 5. For every non-match row: both exact values, the concrete impact (quantified when possible, show the arithmetic), severity (Critical / High / Medium / Low) and a specific recommendation citing the section.
> 6. Draft the report from the table, most severe first, with a dedicated section for items required by the reference but missing from the subject.
> 7. Before finishing, check the report against the table: every deviation, missing and added row must appear in the report with its section reference. Fix and re-check until it does.

In the Legora interface, the same text was typed as a single paragraph with the steps numbered (1) to (7). The Legora skill uses the same seven steps, without the first paragraph.

## References

Sources outside the bibliography file, not re-verified by the literature review:

- Conseil national des barreaux and Viavoice (2025). *L'IA et la profession d'avocat* (survey of 4,457 lawyers).
- Conseil national des barreaux (17 March 2026). Guide on ethics and artificial intelligence.
- Tribunal administratif d'Orléans, 29 December 2025, no. 2506461, as recorded in Charlotin's database.

Bibliography (`refs.bib`, 62 entries, each opened at its primary source on 4 October 2026):

- Ambrogi, Bob. 2025. *Clearbrief Launches Cite Check Report to Give Law Firm Partners an Audit Trail Against AI Hallucinations*. <https://www.lawnext.com/2025/12/clearbrief-launches-cite-check-report-to-give-law-firm-partners-an-audit-trail-against-ai-hallucinations.html>.
- Bagaria, Anshul, Sowmya S Sundaram, Gokul S Krishnan, and Balaraman Ravindran. 2026. *Judging LLM-as-a-Judge: Concerning Rubric Artifacts in LLM-Based Automated Text Generation Evaluation*. <https://arxiv.org/abs/2609.02942>.
- Bohnet, Bernd, Vinh Q. Tran, Pat Verga, et al. 2022. *Attributed Question Answering: Evaluation and Modeling for Attributed Large Language Models*. <https://arxiv.org/abs/2212.08037>.
- Chalkidis, Ilias, Abhik Jana, Dirk Hartung, et al. 2022. "LexGLUE: A Benchmark Dataset for Legal Language Understanding in English." In *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)*, edited by Smaranda Muresan, Preslav Nakov, and Aline Villavicencio. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2022.acl-long.297>.
- Chan, Chi-Min, Weize Chen, Yusheng Su, et al. 2024. "ChatEval: Towards Better LLM-Based Evaluators Through Multi-Agent Debate." *The Twelfth International Conference on Learning Representations (ICLR 2024)*. <https://arxiv.org/abs/2308.07201>.
- Charlotin, Damien. 2026. *AI Hallucination Cases Database*. <https://www.damiencharlotin.com/hallucinations/>.
- Charmet, Thibault, Inès Cherichi, Matthieu Allain, et al. 2022. "Complex Labelling and Similarity Prediction in Legal Texts: Automatic Analysis of France's Court of Cassation Rulings." In *Proceedings of the Thirteenth Language Resources and Evaluation Conference*, edited by Nicoletta Calzolari, Frédéric Béchet, Philippe Blache, et al. European Language Resources Association. <https://aclanthology.org/2022.lrec-1.509/>.
- Cour de cassation. 2026. *API Judilibre*. <https://www.data.gouv.fr/datasets/api-judilibre>.
- Cymbler, Rose, Daniel Guez, and Laurent Fabre. 2026. *Temporal Misgrounding in Legal RAG: A Versioned-Corpus Benchmark for French Tax Law*. <https://arxiv.org/abs/2608.09393>.
- Dahl, Matthew, Varun Magesh, Mirac Suzgun, and Daniel E. Ho. 2024. "Large Legal Fictions: Profiling Legal Hallucinations in Large Language Models." *Journal of Legal Analysis* 16 (1): 64--93. <https://doi.org/10.1093/jla/laae003>.
- Dhuliawala, Shehzaad, Mojtaba Komeili, Jing Xu, et al. 2024. "Chain-of-Verification Reduces Hallucination in Large Language Models." In *Findings of the Association for Computational Linguistics: ACL 2024*, edited by Lun-Wei Ku, Andre Martins, and Vivek Srikumar. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2024.findings-acl.212>.
- Direction de l'information légale et administrative (DILA). 2026. *LEGI: Codes, Lois Et règlements Consolidés*. <https://www.data.gouv.fr/datasets/legi-codes-lois-et-reglements-consolides>.
- Douka, Stella, Hadi Abdine, Michalis Vazirgiannis, Rajaa El Hamdani, and David Restrepo Amariles. 2021. "JuriBERT: A Masked-Language Model Adaptation for French Legal Text." In *Proceedings of the Natural Legal Language Processing Workshop 2021*, edited by Nikolaos Aletras, Ion Androutsopoulos, Leslie Barrett, Catalina Goanta, and Daniel Preotiuc-Pietro. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2021.nllp-1.9>.
- Du, Yilun, Shuang Li, Antonio Torralba, Joshua B. Tenenbaum, and Igor Mordatch. 2024. "Improving Factuality and Reasoning in Language Models Through Multiagent Debate." *Proceedings of the 41st International Conference on Machine Learning (ICML 2024)*, Proceedings of machine learning research, vol. 235: 11733--63. <https://arxiv.org/abs/2305.14325>.
- Dwivedi, Madhukar, and Jaap Kamps. 2025. "Effectiveness of in-Context Learning for Due Diligence: A Reproducibility Study of Identifying Passages for Due Diligence." *Information Retrieval Research* 1 (2): 221--45. <https://doi.org/10.54195/irrj.22626>.
- Enguehard, Joseph, Morgane Van Ermengem, Kate Atkinson, et al. 2025. "LeMAJ (Legal LLM-as-a-Judge): Bridging Legal Reasoning and LLM Evaluation." In *Proceedings of the Natural Legal Language Processing Workshop 2025*, edited by Nikolaos Aletras, Ilias Chalkidis, Leslie Barrett, Cătălina Goanță, Daniel Preoțiuc-Pietro, and Gerasimos Spanakis. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2025.nllp-1.23>.
- Floro, Avrile, Tamara Dhorasoo, Soline Pellez, and Nils Holzenberger. 2026. *Where Experts Disagree, Models Fail: Detecting Implicit Legal Citations in French Court Decisions*. <https://arxiv.org/abs/2603.22973>.
- Gao, Luyu, Zhuyun Dai, Panupong Pasupat, et al. 2023. "RARR: Researching and Revising What Language Models Say, Using Language Models." In *Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)*, edited by Anna Rogers, Jordan Boyd-Graber, and Naoaki Okazaki. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.acl-long.910>.
- Gao, Tianyu, Howard Yen, Jiatong Yu, and Danqi Chen. 2023. "Enabling Large Language Models to Generate Text with Citations." In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing*, edited by Houda Bouamor, Juan Pino, and Kalika Bali. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.emnlp-main.398>.
- Grupen, Niko, Gabe Pereyra, and Julio Pereyra. 2026a. *Harvey's Legal Agent Benchmark*. <https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark>.
- Grupen, Niko, Gabe Pereyra, and Julio Pereyra. 2026b. *Initial Results on Legal Agent Benchmark*. <https://www.harvey.ai/blog/legal-agent-benchmark-initial-results>.
- Grupen, Niko, Julio Pereyra, Gabe Pereyra, et al. 2026. *Post-Training RLM Agents for End-to-End M&A Diligence*. <https://www.harvey.ai/blog/post-training-rlm-agents-for-m-and-a-diligence>.
- Guha, Neel, Julian Nyarko, Daniel E. Ho, et al. 2023. "LegalBench: A Collaboratively Built Benchmark for Measuring Legal Reasoning in Large Language Models." *Advances in Neural Information Processing Systems 36 (NeurIPS 2023), Datasets and Benchmarks Track*. <https://arxiv.org/abs/2308.11462>.
- Harvey AI. 2026. *Harvey LAB: The Legal Agent Benchmark*. Version v1.0. <https://github.com/harveyai/harvey-labs>.
- Hendrycks, Dan, Collin Burns, Anya Chen, and Spencer Ball. 2021. "CUAD: An Expert-Annotated NLP Dataset for Legal Contract Review." *Proceedings of the Neural Information Processing Systems Track on Datasets and Benchmarks (NeurIPS 2021)*. <https://arxiv.org/abs/2103.06268>.
- Huang, Yiqian, Shuyuan Zheng, Qianying Liu, et al. 2026. *When Do LLMs Apply the Wrong Law? Diagnosing LLM Failures in Temporal Legal Reasoning*. <https://arxiv.org/abs/2608.14610>.
- Irving, Geoffrey, Paul Christiano, and Dario Amodei. 2018. *AI Safety via Debate*. <https://arxiv.org/abs/1805.00899>.
- Kelsen, Hans. 1967. *Pure Theory of Law*. University of California Press.
- Khan, Akbir, John Hughes, Dan Valentine, et al. 2024. "Debating with More Persuasive LLMs Leads to More Truthful Answers." *Proceedings of the 41st International Conference on Machine Learning (ICML 2024)*, Proceedings of machine learning research, vol. 235: 23662--733. <https://arxiv.org/abs/2402.06782>.
- Koreeda, Yuta, and Christopher Manning. 2021. "ContractNLI: A Dataset for Document-Level Natural Language Inference for Contracts." In *Findings of the Association for Computational Linguistics: EMNLP 2021*, edited by Marie-Francine Moens, Xuanjing Huang, Lucia Specia, and Scott Wen-tau Yih. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2021.findings-emnlp.164>.
- Li, Chenyang, Zejia Feng, Yuqin Huang, Yuxiao Ye, and Huiyuan Xie. 2026. *LexKairos: Benchmarking Legal Temporal Capabilities in LLMs*. <https://arxiv.org/abs/2608.09106>.
- Liu, Nelson, Tianyi Zhang, and Percy Liang. 2023. "Evaluating Verifiability in Generative Search Engines." In *Findings of the Association for Computational Linguistics: EMNLP 2023*, edited by Houda Bouamor, Juan Pino, and Kalika Bali. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.findings-emnlp.467>.
- Liu, Patty, Dominik Stammbach, and Peter Henderson. 2026. *Who Checks the Citations? Benchmarking Legal Hallucination Detection*. <https://arxiv.org/abs/2606.21155>.
- Louis, Antoine, Gijs van Dijck, and Gerasimos Spanakis. 2023. *Interpretable Long-Form Legal Question Answering with Retrieval-Augmented Large Language Models*. <https://arxiv.org/abs/2309.17050>.
- Louis, Antoine, and Gerasimos Spanakis. 2022. "A Statutory Article Retrieval Dataset in French." In *Proceedings of the 60th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)*, edited by Smaranda Muresan, Preslav Nakov, and Aline Villavicencio. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2022.acl-long.468>.
- Magesh, Varun, Faiz Surani, Matthew Dahl, Mirac Suzgun, Christopher D. Manning, and Daniel E. Ho. 2025. "Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools." *Journal of Empirical Legal Studies* 22 (2): 216--42. <https://doi.org/10.1111/jels.12413>.
- Martim, Hudson de. 2025. *Modeling the Diachronic Evolution of Legal Norms: An LRMoo-Based, Component-Level, Event-Centric Approach to Legal Knowledge Graphs*. <https://arxiv.org/abs/2506.07853>.
- Menick, Jacob, Maja Trebacz, Vladimir Mikulik, et al. 2022. *Teaching Language Models to Support Answers with Verified Quotes*. <https://arxiv.org/abs/2203.11147>.
- Min, Sewon, Kalpesh Krishna, Xinxi Lyu, et al. 2023. "FActScore: Fine-Grained Atomic Evaluation of Factual Precision in Long Form Text Generation." In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing*, edited by Houda Bouamor, Juan Pino, and Kalika Bali. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.emnlp-main.741>.
- Palmirani, Monica, and Raffaella Brighi. 2006. "Time Model for Managing the Dynamic of Normative System." *Electronic Government (EGOV 2006)*, Lecture notes in computer science, 207--18. <https://doi.org/10.1007/11823100_19>.
- Panickssery, Arjun, Samuel R. Bowman, and Shi Feng. 2024. "LLM Evaluators Recognize and Favor Their Own Generations." *Advances in Neural Information Processing Systems 37 (NeurIPS 2024)*. <https://arxiv.org/abs/2404.13076>.
- Pereyra, Julio. 2026. *Extending Legal Agent Bench to M&A Due Diligence*. <https://www.harvey.ai/blog/legal-agent-bench-m-and-a-due-diligence>.
- Pipitone, Nicholas, and Ghita Houir Alami. 2024. *LegalBench-RAG: A Benchmark for Retrieval-Augmented Generation in the Legal Domain*. <https://arxiv.org/abs/2408.10343>.
- Prior, Max, Andreas Schultz, and Matthias Grabmair. 2026. *Asking for an Old Friend: Diagnosing and Mitigating Temporal Failure Modes in LLM-Based Statutory Question Answering*. <https://arxiv.org/abs/2605.23497>.
- Rashkin, Hannah, Vitaly Nikolaev, Matthew Lamm, et al. 2023. "Measuring Attribution in Natural Language Generation Models." *Computational Linguistics* (Cambridge, MA) 49 (4): 777--840. <https://doi.org/10.1162/coli_a_00486>.
- Roegiest, Adam, Alexander K. Hudek, and Anne McNulty. 2018. "A Dataset and an Examination of Identifying Passages for Due Diligence." *Proceedings of the 41st International ACM SIGIR Conference on Research and Development in Information Retrieval (SIGIR 2018)*, 465--74. <https://doi.org/10.1145/3209978.3210015>.
- Taranukhin, Maksym, and Vered Shwartz. 2026. *Legal LLM Hallucination Should Be Evaluated as Failure of Legal Warrant*. <https://arxiv.org/abs/2609.17546>.
- Thakur, Aman Singh, Kartik Choudhary, Venkat Srinik Ramayapally, Sankaran Vaidyanathan, and Dieuwke Hupkes. 2025. "Judging the Judges: Evaluating Alignment and Vulnerabilities in LLMs-as-Judges." In *Proceedings of the Fourth Workshop on Generation, Evaluation and Metrics (GEM²)*, edited by Ofir Arviv, Miruna Clinciu, Kaustubh Dhole, et al. Association for Computational Linguistics. <https://aclanthology.org/2025.gem-1.33/>.
- Thomson Reuters. 2026a. *KeyCite Status Flags*. <https://www.thomsonreuters.com/en-us/help/drafting-assistant/flags-and-links/kc-status-flags>.
- Thomson Reuters. 2026b. *Quick Check -- Westlaw Edge*. <https://legal.thomsonreuters.com/en/products/westlaw-edge/quick-check>.
- United States District Court for the Southern District of New York. 2023. *[Mata v. Avianca, Inc.]{.nocase}, 678 F. Supp. 3d 443 (S.D.N.Y. 2023)*.
- Vals AI. 2026a. *Harvey's Legal Agent Benchmark Leaderboard and Methodology*. <https://www.vals.ai/benchmarks/hlab>.
- Vals AI. 2026b. *LegalBench Leaderboard and Methodology*. <https://www.vals.ai/benchmarks/legal_bench>.
- Verga, Pat, Sebastian Hofstatter, Sophia Althammer, et al. 2024. *Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models*. <https://arxiv.org/abs/2404.18796>.
- Verma, Apurv. 2026. *Is This Citation on Point?* <https://arxiv.org/abs/2608.12571>.
- Wang, Peiyi, Lei Li, Liang Chen, et al. 2024. "Large Language Models Are Not Fair Evaluators." In *Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)*, edited by Lun-Wei Ku, Andre Martins, and Vivek Srikumar. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2024.acl-long.511>.
- Wang, Steven, Antoine Scardigli, Leonard Tang, et al. 2023. "MAUD: An Expert-Annotated Legal NLP Dataset for Merger Agreement Understanding." In *Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing*, edited by Houda Bouamor, Juan Pino, and Kalika Bali. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.emnlp-main.1019>.
- Wei, Jerry, Chengrun Yang, Xinying Song, et al. 2024. "Long-Form Factuality in Large Language Models." *Advances in Neural Information Processing Systems 37 (NeurIPS 2024)*. <https://arxiv.org/abs/2403.18802>.
- Weng, Yixuan, Minjun Zhu, Fei Xia, et al. 2023. "Large Language Models Are Better Reasoners with Self-Verification." In *Findings of the Association for Computational Linguistics: EMNLP 2023*, edited by Houda Bouamor, Juan Pino, and Kalika Bali. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2023.findings-emnlp.167>.
- Zhang, Kepu, Weijie Yu, Sunhao Dai, and Jun Xu. 2025. "CitaLaw: Enhancing LLM with Citations in Legal Domain." In *Findings of the Association for Computational Linguistics: ACL 2025*, edited by Wanxiang Che, Joyce Nabende, Ekaterina Shutova, and Mohammad Taher Pilehvar. Association for Computational Linguistics. <https://doi.org/10.18653/v1/2025.findings-acl.583>.
- Zheng, Lianmin, Wei-Lin Chiang, Ying Sheng, et al. 2023. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena." *Advances in Neural Information Processing Systems 36 (NeurIPS 2023), Datasets and Benchmarks Track*. <https://arxiv.org/abs/2306.05685>.
- Zhou, Yujin, Mingxuan Zheng, Chuxue Cao, et al. 2026. *LexAgentHallu: A Hierarchical Benchmark for Profiling Hallucinations in Legal Agents*. <https://arxiv.org/abs/2609.09754>.
