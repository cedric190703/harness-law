# Visa: A Verification Layer for Legal AI Agents

**Visa team — LLM x Law Hackathon Paris #2 (Stanford Law × Mistral AI), 4 October 2026**

*Working paper, version 2. Results marked [PENDING] were still being computed when this version was written. Every figure below was re-read from the result files; measured results and inferences are labelled as such.*

## Abstract

Legal AI tools now draft memos, compare contracts and review data rooms, but lawyers cannot rely on their output: tools invent authorities, make real sources say what they do not say, and silently omit items. We ask whether a **verification layer**, which forces every claim to be tied to a verbatim, machine-checked source and every requirement of a governing document to be accounted for, makes legal AI more reliable. Visa applies this principle in three forms: an after-the-fact checker that verifies each claim of an AI answer against official French sources (Légifrance, Judilibre) under the rule *no proof, no green*; a loop that sends each problem, with its official evidence, back to the AI that wrote the text and re-verifies the correction; and a "concordance" method that an agent follows while working. On a French claim set whose 58 labels were each proven on Légifrance, the checker flagged all 30 false claims, with no false green and no false red. On Harvey's public Legal Agent Bench (LAB), we ran three agents (Legora, Claude Code with Sonnet 5.5, Mistral Medium 3.5) without and with the method on identical inputs, graded against the official rubric by two judges from different model families, which agree on 498 of 511 criterion verdicts. On development tasks, the method takes Legora from 26/38 to 38/38 (a full pass) by recovering four omitted closing deliverables, and Mistral Medium 3.5 from 36–38/52 to 48/52; it is neutral to slightly negative for Claude Code, which already solves these tasks. Held-out measurements are in progress.

## 1. Introduction

Trust is the main barrier to legal AI. In a 2025 survey of 4,457 French lawyers by the Conseil national des barreaux (CNB) and Viavoice, 64% use ChatGPT, 46% cite errors as their main concern, and 70% of non-users say they do not trust these tools. The concern has reached the courts: Charlotin's database lists 2,145 decisions dealing with hallucinated material, 14 of them in France; in one of them (administrative court of Orléans, 29 December 2025, no. 2506461), the database records 15 fabricated decisions and one misrepresented decision in a single filing. Professional tools are not immune: in a preregistered evaluation, Lexis+ AI and Westlaw AI-Assisted Research hallucinate on 17% and 33% of queries (Magesh et al., 2025). Since March 2026, the CNB's guide on ethics and AI asks lawyers to document their use of AI.

Agentic benchmarks show the same pattern at the level of complete work products. On Harvey's LAB, models pass roughly 90 to 96% of rubric criteria individually but rarely a whole task, because a task counts only if every criterion passes. On the Vals AI leaderboard of 1 October 2026, the best model completes 25.4% of tasks, Claude Fable 5 11.3%, and Mistral Medium 3.5 0.4%. In an observational analysis of agent traces, Harvey associates revise-after-check behaviour with the largest gain (+1.5 points); this is a correlation, not a controlled measurement.

Our premise is that verification should be a product layer rather than a property hoped for in each model. **Contributions:**

- **Visa**, a verification layer that checks each claim of a legal AI answer for existence, validity at the date of the facts, normative rank and support by the cited text, with a verbatim guard that prevents the verifier itself from inventing evidence, and that renders the result as a map of evidence.
- **The Visa loop**, which returns each problem with its official evidence to the AI that wrote the text and accepts a correction only if it passes the same checks.
- **A concordance method** packaged as an agent skill, and as a Legora skill: a forward pass over every requirement of the reference document, a reverse pass, verbatim quotes checked by script, and a report drafted from the ledger.
- **A controlled evaluation protocol** on public LAB tasks (pre-registered dev/test split, identical inputs, isolation of agents from rubrics and from each other, two judges from different families) and a French claim set with officially proven labels.

## 2. Related work

*Every reference below was opened and checked against its primary source on 4 October 2026; the full list is at the end of the paper.*

**Legal hallucination.** Dahl et al. (2024) report hallucination rates from 58% (GPT-4) to 88% (Llama 2) on verifiable questions about US federal cases. In the first preregistered evaluation of commercial legal research tools, Magesh et al. (2025) find that Lexis+ AI and Westlaw AI-Assisted Research hallucinate on 17% and 33% of queries; their typology counts *misgrounded* answers (a real source cited for a proposition it does not support, or an inapplicable source) as hallucinations. *Mata v. Avianca* (S.D.N.Y. 2023) sanctioned counsel for filing fabricated opinions, and Charlotin's database lists 2,145 such decisions, 14 in France. On LePhantomCite, 1,300 brief excerpts with injected citation errors, agentic GPT-5 reaches 84.4% recall but 55.0% F1 (Liu et al., 2026). LexAgentHallu annotates 3,414 legal-agent instances with 27 hallucination subclasses and reports "right answer, wrong reason" (Zhou et al., 2026). Closest to our framing, a position paper at the ICML 2026 AI4Law workshop (Taranukhin and Shwartz, 2026) argues that legal hallucination is a failure of *warrant*: the authority must exist, apply in the jurisdiction, be current for the date of analysis, have the legal status claimed and support the proposition. *How Visa differs:* these works measure or define the failure; Visa turns the warrant conditions into executable checks on French official sources, and returns grey, never green, when one cannot be proven.

**Verification, attribution and grounding.** AIS (Rashkin et al., 2023) and attributed QA (Bohnet et al., 2022) define when text is supported by identified sources. The best systems lack complete citation support 50% of the time on ELI5 (Gao et al., 2023a), and only 51.5% of generative-search sentences are fully supported (Liu et al., 2023). FActScore (Min et al., 2023) and SAFE (Wei et al., 2024) check atomic facts against a knowledge source or web search; RARR (Gao et al., 2023b), self-verification (Weng et al., 2023) and Chain-of-Verification (Dhuliawala et al., 2024) let a model check its own output; GopherCite constrains supporting quotes to be verbatim (Menick et al., 2022). In law, CitaLaw evaluates sentence–citation alignment (Zhang et al., 2025), and models catch 93–100% of wrong-case citations but only 37–61% of wrong-pinpoint ones in court opinions (Verma, 2026). KeyCite flags statutes amended, repealed or held unconstitutional; Westlaw Quick Check compares a brief's quotations with the cited text; Clearbrief scores semantic support with non-generative NLP (Thomson Reuters, 2026a, 2026b; Ambrogi, 2025). *How Visa differs:* it adds checks that generic attribution ignores (version at the date of the facts, rank of the norm) and applies verbatim matching to the verifier's own evidence, not only to the generator's quotes.

**LLM-as-a-judge.** Strong judges reach over 80% agreement with humans but show position, verbosity and self-enhancement biases (Zheng et al., 2023); answer order alone lets Vicuna-13B beat ChatGPT on 66 of 80 queries (Wang et al., 2024); self-preference tracks self-recognition (Panickssery et al., 2024); even the best judges trail inter-human agreement and lean lenient (Thakur et al., 2025). Panels from disjoint model families reduce intra-model bias at lower cost (Verga et al., 2024). Debate, proposed for AI safety (Irving et al., 2018), improves factuality (Du et al., 2024) and evaluation (Chan et al., 2024); in Khan et al. (2024) it lifts non-expert judges to 76% accuracy, and judges may trust only quotes that a tool has verified against the text. In law, LeMAJ splits answers into "legal data points" (Enguehard et al., 2025), and rubric grading is standard, though rubric text alone partly predicts judge outputs (Bagaria et al., 2026). *How Visa differs:* our adversarial judge, cast as opposing counsel, verifies rather than grades, and its verdict counts only if its quote passes a deterministic check against the official text; for grading we use two judges from different families, as the LAB leaderboard does (Vals AI, 2026a).

**Legal and agentic benchmarks.** LegalBench has 162 tasks (Guha et al., 2023); its top eight models now lie within 1.6 points (Vals AI, 2026b). LexGLUE (Chalkidis et al., 2022), CUAD (510 contracts, 41 clause types; Hendrycks et al., 2021), ContractNLI (607 NDAs, 17 hypotheses with evidence spans; Koreeda and Manning, 2021), MAUD (over 47,000 merger-agreement annotations; Wang et al., 2023) and LegalBench-RAG (Pipitone and Houir Alami, 2024) test classification, extraction and retrieval. Harvey's LAB targets agentic work product: over 1,200 tasks at launch (2,010 in the public repository), 75,000+ expert rubric criteria, all-pass scoring, a best initial all-pass rate of 7.1%, and, in an observational analysis of agent traces, revise-after-check loops as the behaviour most associated with success (+1.5 points) (Grupen et al., 2026a, 2026b; Harvey AI, 2026). *How Visa differs:* these benchmarks score answers; Visa is a method attached to any agent, measured with and without on LAB, on ContractNLI and on a French claim set.

**French law, time and rank.** Legal informatics has long modelled norm versioning (Palmirani and Brighi, 2006; de Martim, 2025), and rank follows the hierarchy of norms (Kelsen, 1967). LLMs default to the most recently enacted law, and models with stronger general reasoning do worse (Huang et al., 2026); on German statutes, web search shows recency bias while fact-date extraction with version filtering helps (Prior et al., 2026); LexKairos tests effective-version identification in Chinese law (Li et al., 2026). On 32,436 versions of French tax-code articles, static RAG retrieves the date-applicable version 0% of the time and a version-aware retriever 98.3% (Cymbler et al., 2026). French resources include BSARD (Louis and Spanakis, 2022), LLeQA (Louis et al., 2023), JuriBERT (Douka et al., 2021), Court of Cassation rulings (Charmet et al., 2022), implicit Civil Code citations in Judilibre decisions (Floro et al., 2026), and the official LEGI and Judilibre open data (DILA, 2026; Cour de cassation, 2026). *How Visa differs:* prior work tests whether a model retrieves the right version; Visa checks the version a given answer relied on, at the date of the facts, and adds normative rank, which we did not find evaluated elsewhere.

**AI-assisted due diligence.** Passage identification for due diligence dates back to Roegiest et al. (2018), revisited with in-context learning by Dwivedi and Kamps (2025). LAB Diligence uses synthetic data rooms of up to 5,000 documents and 80M tokens (Pereyra, 2026); in a standard tool loop no run reads more than 1% of the room (most 0.1–0.5%) and models pass 23.3% of rubric criteria, while a recursive delegation harness adds 39.1 points on average (Grupen et al., 2026c). *How Visa differs:* instead of a harness that reads more, Visa's concordance ledger makes coverage explicit, so an omission becomes a visible row rather than a silent gap.

### 2.1 Positioning

✓ yes · ~ partly · ✗ no (or nothing found in the source).

| Work or tool | Kind | Source exists | Version at the date of the facts | Rank of the norm | Support, with verbatim proof | Omissions |
|---|---|---|---|---|---|---|
| **Visa** | verification layer on any model, French law | ✓ Légifrance, Judilibre, case file | ✓ all versions of an article, the one in force at the date of the facts is selected | ✓ simplified hierarchy (a circular invoked as binding turns orange) | ✓ opposing-counsel judge must quote an excerpt found verbatim by script; no proof, grey | ✓ concordance ledger (forward and reverse pass) with scripted checks |
| KeyCite and Quick Check (Thomson Reuters) | commercial, US law | ✓ | ~ current status (no longer good law; amended, repealed, superseded); nothing found on versions at a past date | ✗ | ~ compares quoted text with the cited source; does not say whether the source supports the proposition | ~ suggests additional authority, not the requirements of a reference document |
| Clearbrief Cite Check Report (Ambrogi, 2025) | commercial, US law | ✓ missing sources | ✗ | ✗ | ~ semantic similarity score, non-generative NLP, no verified excerpt | ✗ |
| LePhantomCite (Liu et al., 2026) | benchmark of 1,300 excerpts and agentic checkers | ✓ nonexistent citation, inconsistent name or reporter | ✗ not in the taxonomy | ✗ | ~ detects distorted citations and misrepresented content (GPT-5 agentic: 84.4% recall, 55.0% F1), but the checker's verdict is not itself proven | ✗ |
| *Is this Citation on Point?* (Verma, 2026) | study, US law | ✓ wrong case caught 93–100% | ✗ | ✗ | ~ pinpoint support caught 37–61%, model judgment without verified excerpt | ✗ |
| FiscalQA Pro (Cymbler et al., 2026) | benchmark and version-aware retriever, French tax code | ~ | ✓ 32,436 article versions; 0% with static RAG, 98.3% version-aware | ✗ | ~ deterministic grading by expected values, no evidence excerpt | ✗ |
| Prior et al., 2026 (ICAIL) | benchmark and RAG, German law | ~ | ✓ fact-date extraction and version filtering | ✗ | ✗ LLM-judge grading | ✗ |
| Taranukhin and Shwartz, 2026 (AI4Law workshop) | position paper: "legal warrant" framework | ✓ as a criterion | ✓ as a criterion ("current for the date of analysis") | ~ "legal status" of the authority | ✓ as a criterion ("supports the proposition"), small pilot, no scripted check | ✗ |
| FActScore and SAFE (Min et al., 2023; Wei et al., 2024) | generic factuality metric | — | ✗ | ✗ | ~ atomic facts judged by a model against a source or web search, no verbatim excerpt | ✗ |

**What is new in Visa.**

1. **All five checks in one running tool, on French law**: existence, version at the date of the facts, rank, proven support, omissions. Each exists elsewhere separately; only Taranukhin and Shwartz enumerate them, without implementing them.
2. **Rank of the norm**: we found no benchmark or tool that checks where a source sits in the hierarchy of norms (for instance a circular presented as binding).
3. **The verbatim guard applied to the verifier, in legal verification**: the opposing-counsel judge must quote a passage that a script finds in the official text, otherwise its verdict is discarded and the claim turns grey. Khan et al. (2024) do this for debate over stories; we did not find it for auditing a legal AI answer.
4. **Auditing the version an existing answer relied on**: work on time (FiscalQA Pro, Prior et al., Huang et al.) measures whether a model retrieves the right version; Visa checks after the fact the version another AI relied on, and shows the old and new texts side by side.
5. **A controlled intervention on LAB**: Harvey observes that agents that verify then correct score 1.5 points higher, as a correlation in traces; we run the intervention (same tasks, same documents, three agents, two judges from different families).

**What we do not claim.**

1. Checking that a citation exists and remains valid, and comparing a quotation with its source: citators (KeyCite) and Westlaw Quick Check do this; LePhantomCite and Verma (2026) already measure detection of fabricated, distorted or off-point citations.
2. Verbatim-verified quotes, adversarial judges and judges from different families: GopherCite (Menick et al., 2022), Khan et al. (2024), Irving et al. (2018) and Verga et al. (2024); the LAB leaderboard already grades with two judges (GPT-5.5 and Claude Sonnet 4.6).
3. Selecting the version in force at the date of the facts, and splitting an answer into claims: FiscalQA Pro already does the former on French tax law (98.3%), Prior et al. filter versions by fact date, LEGI keeps every version, and atomic decomposition comes from FActScore and SAFE.

## 3. System

### 3.1 Three failure modes, four checks

Visa targets three failure modes of legal AI output: a **fabricated or inapplicable source** (nonexistent, repealed, of the wrong rank), a **misgrounded claim** (a real source made to say something it does not say), and an **omission** (a requirement of the governing document that the output never mentions). An answer is first split into claims, each with the sources it cites. Each cited source then goes through four checks:

1. **Existence.** The source is retrieved from Légifrance (codes, statutes, decrees) or Judilibre (Court of Cassation decisions) through the official PISTE API, or from the case file for exhibits. Not found is red; an unidentifiable reference ("settled case law") is grey.
2. **Validity at the date of the facts.** For codified articles, Visa retrieves every historical version and selects the one in force at the date of the facts. No applicable version is red; a version that differs from today's text is orange, and the two texts are shown side by side.
3. **Rank.** A simplified hierarchy of norms (constitution, treaties, statutes, decrees, orders, circulars, case law). A circular invoked as binding is orange.
4. **Support.** An adversarial judge, prompted as opposing counsel, decides whether the applicable text supports the claim (supports, partial, does not support, off-topic). It must quote a passage from the official text; a script checks that the quote appears verbatim after normalization (at least 12 normalized characters). A verdict whose quote cannot be found is discarded and the claim turns grey.

The claim takes the worst status of its sources. The governing rule is **no proof, no green**: an API failure, a vague citation or an unverifiable quote yields grey, never green. In the web application, extraction and judging use Mistral Large (`mistral-large-latest`).

### 3.2 The Visa loop: judge, then send back for correction

Visa does not rewrite the text in place of the AI. After the first verification, every orange or red passage is returned to the model that wrote the memo, together with its evidence: status, message, verbatim official excerpt and the version applicable at the date of the facts. The model returns only corrected passages; the rest of the memo is kept word for word by construction. Each corrected passage, including any new reference it introduces, is verified again like the others and is kept only if it comes out green or orange; otherwise the previous passage stays and the rejection reason is sent back at the next round. The loop stops when no red remains, after at most two rounds. The interface shows the counts per version, the final memo in tracked changes, and an audit log of what was flagged, corrected, rejected and left.

### 3.3 Two forms for agents

**After the fact.** A lawyer pastes an AI-written memo and the date of the facts. Visa returns a map of evidence: claims on one side, official sources on the other, one colored link per verification, and, on click, the controls, the adversarial reasoning and the highlighted passage. A Claude Code skill (`/verifier-sources`) produces the same map; the agent running the skill extracts and judges while scripts perform retrieval, the date and rank checks, the verbatim guard and the rendering. Both share one rule module, so they return the same verdicts.

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

Scores are criteria passed out of the task's criteria, given as Opus 5.5 / GPT-5.5 when the two judges differ.

| Agent | Task 1: closing checklist vs. agreement (38) | Task 2: disclosure schedules vs. reps (52) | Task 3: closing documents (33) |
|---|---|---|---|
| Legora, without | 26 | 45 | not run |
| Legora, with | **38 (pass)** | [PENDING] | not run |
| Claude Code, without | **38 (pass)** | 48 | **33 (pass)** |
| Claude Code, with | 37 | 48 / 50 | **33 (pass)** |
| Mistral Medium 3.5, without | 23 † | 38 / 36 | 18 / 19 |
| Mistral Medium 3.5, with | 25 † | **48** | [PENDING] |

† Graded by Claude Sonnet 5.5 only; dual grading pending.

**Legora, task 1.** Without the method, Legora finds every value discrepancy (escrow amount, indemnification cap, escrow period, transition services fee, non-compete term, outside date, and an internal inconsistency in the buyer's name) and cites its sources. It misses all four closing deliverables that the agreement requires and the checklist omits: the FIRPTA certificate, the Northwind Aerospace consent, the title insurance commitment and the landlord estoppel certificate. These four omissions account for 11 of its 12 failed criteria, because each one is graded separately for identification, section reference, recommendation and, for FIRPTA, severity; the twelfth is the closing-payment reconciliation. With the method, the same tool recovers all four omissions and passes all 38 criteria, even though it inverted the roles and took the checklist as reference; we infer, without having measured it, that the reverse pass surfaced the missing deliverables.

**Mistral Medium 3.5, task 2.** The method adds 10 criteria according to Opus 5.5 (38 to 48) and 12 according to GPT-5.5 (36 to 48), without producing a pass. On task 1 it adds two (23 to 25, single judge). Mistral followed the method's steps (54 turns against 20 on task 1), and its runs were slowed by API rate limits.

**Claude Code.** Claude Code already solves tasks 1 and 3 without the method and comes within four criteria on task 2. With the method, it loses one criterion on task 1 (the report never shows the reconciliation $87.5M − $5.25M escrow − $3.5M holdback = $78.75M), ties on task 3, and ties or gains two criteria on task 2 depending on the judge. On task 2, both conditions miss the same planted error: an arithmetic mistake in the net working capital exhibit (current liabilities summed incorrectly, $7.9M stated against $7.8M). Neither the agent nor the method recomputes the figures of the documents.

**Judge agreement.** Over the twelve development runs graded by both judges (511 criterion verdicts), Opus 5.5 and GPT-5.5 agree on 498 (97.5%). On task 1 they agree on all 152 verdicts of the four dual-graded runs, including the identity of each failed criterion. We see no sign that a Claude judge grades Claude's output more leniently than a GPT judge does.

### 5.2 Held-out test tasks (7 tasks, measured once)

[PENDING] Runs for Claude Code (without and with the method) are complete on four of the seven tasks and running on the others; Legora runs without and with the Legora skill are complete on one test task and being graded. One Claude Code run was flagged by the isolation detector and is excluded. We will report task passes and criteria passed, without reading criterion-level results.

| Agent | Tasks passed without | Tasks passed with | Criteria passed without | Criteria passed with |
|---|---|---|---|---|
| Claude Code, Sonnet 5.5 | – / 7 | – / 7 | – | – |
| Legora | – | – | – | – |

### 5.3 French claim set (after-the-fact Visa)

Nine short memos "written by an AI" (dismissal, hiring, fixed-term contracts, distribution, online sale, residential lease, harassment, civil procedure), each with its date of the facts, contain 58 claims with a cited source. Each label was proven on the official databases by a script, without a model: existence, applicable version and its dates, a verbatim excerpt of that version grounding the label, absence from Légifrance and Judilibre for invented references, and the exact title for circulars. Labels: 25 green (true), 22 red (4 nonexistent articles, 4 invented decisions, 4 texts not in force at the date of the facts, 10 misstatements), 8 orange (5 texts amended since the facts, 3 circulars presented as binding), 3 grey (vague references). Models: Mistral Large for extraction and judging. Cost of a full pass: about $0.06.

| Measure (first complete pass) | Value |
|---|---|
| False claims (red or orange expected) not marked green | **30 / 30** |
| False greens (non-green expected, marked green) | **0 / 33** |
| False reds (true claims marked red) | **0 / 25** |
| True claims confirmed green | 12 / 25 |
| Exact color | 43 / 58 |

Every error type was flagged in every instance (invented decisions 4/4, nonexistent articles 4/4, not in force 4/4, misstatements 10/10, amended texts 5/5, circulars 3/3, vague references 3/3). The weakness is caution: 12 of 25 true claims come out orange, because the judge answers "partial" on wording details. A second pass for stability, a model-alone baseline (the same Mistral model asked to judge each claim without Légifrance and without the guard) and 15 to 20 harder cases are [PENDING]. The set was written by our team and has not yet been reviewed by an independent lawyer.

### 5.4 The Visa loop on the demonstration memo

On the demonstration memo (a 2016 dismissal and non-compete clause, ten claims), the first verification found 5 false claims, 3 to review and 2 verified. After one round of the loop, the second version had 0 false claims, 4 to review and 2 verified; the model deleted four unsupported passages (a repealed article number, an invented one-year cap, a decision cited for a proposition it does not contain, a circular) and rewrote two against the version in force on 15 March 2016, for example "the indemnity cannot be lower than the last six months' salaries (article L. 1235-3 of the Labour Code, in its version in force on 15 March 2016)" instead of a four-month cap. The guard rejected two proposed corrections: one cited an invented article (L. 1121-5) and one an off-topic Social Security Code article. Corrected passages mostly remain orange because the current rule flags any text amended since the facts, even when the correct version is cited. This is a single demonstration run; the loop on LAB deliverables, where an independent Mistral reviewer returns omissions, misstatements and recomputed figures to the agent, is [PENDING].

### 5.5 Due diligence on a French data room

[PENDING] A fictional French data room (Orionis Mobility, 159 documents in 18 standard rubrics) was built by a team member with 16 planted anomalies; the answer key is sealed from the people writing the method. Claude Code runs without and with a due diligence method (inventory, coverage register, verified excerpts for each red flag, cross-checks between rubrics) are complete or running, and an independent grader scores recall of the planted anomalies with both judges.

### 5.6 ContractNLI

[PENDING] 150 test pairs (50 entailment, 50 contradiction, 50 not mentioned), Mistral alone against Mistral with Visa's adversarial judge and verbatim guard; the key measure is false greens (non-entailed hypotheses declared entailed).

## 6. Discussion

**Why 38/38 here while the leaderboard reports 10 to 25%.** LAB scores are all-or-nothing per task. If an agent passes each criterion with probability 0.95 independently, it passes all 38 criteria of task 1 with probability 0.95^38 ≈ 0.14, which is the order of magnitude of the leaderboard. On a due diligence task with 500 criteria, the same agent would almost never pass (0.95^500 ≈ 7 × 10^−12). A passed task is therefore consistent with a low aggregate pass rate. Our development tasks are also short (2 to 12 documents), our harness for Claude (Claude Code) and our judges differ from the leaderboard's (Section 4), and public tasks may have been seen in training, which we cannot verify.

**What the method contributes.** The failures the method removes are mostly **omissions**: Legora's baseline report on task 1 is accurate on every discrepancy it reports but misses every absent deliverable, and Mistral's gains on task 2 come with a systematic walk through every representation. All-or-nothing scoring punishes omissions most, since one missing deliverable costs three or four criteria. The forward pass turns "find the deviations" into "account for every requirement", and the reverse pass catches what the forward framing misses.

**When it does not help.** When the agent already covers the task, as Claude Code does on these development tasks, the method adds constraints without adding coverage, and can cost a criterion (task 1). The one error that no condition caught, a miscomputed exhibit total, points to a check the method lacks: recomputing every figure of the documents and of the report by script, which the Visa loop's reviewer now does. Any such change is validated on development tasks only.

**After-the-fact verification.** On the French set, the guard does what it is designed for: no false claim passes as verified. The cost is caution (half of the true claims need a second look), which is the right side to err on for a lawyer but limits time savings; a stricter definition of "partial" is being tested, with zero false greens as the acceptance rule.

## 7. Limitations

- **Small n and a single run per condition.** Agent runs vary; three development tasks cannot establish an effect size, and held-out results are pending.
- **Development tasks read before the Legora method text was pasted.** The text is the generic method from the skill, written earlier, and was not tailored to the omissions it recovered, but only held-out results can show that the method generalizes.
- **Non-official judges.** The judges run through subscription clients that do not expose temperature; Mistral's runs on task 1 were graded by one judge only. Rubric text may partly drive judge outputs (Bagaria et al., 2026).
- **Public tasks.** Possible training contamination.
- **Human steps in Legora.** Plan approval is manual, although identical across conditions. Legora inverted reference and subject in the method condition of task 1.
- **Different harnesses.** Claude Code and Legora are not run in Harvey's harness, so cross-agent comparisons mix model and tool effects; within-agent comparisons (without vs. with) do not.
- **Team-written French set.** Labels are proven on official sources by script, but the claims were written by the team and not yet reviewed by an independent lawyer; the coverage is limited to 19 codes plus a few statutes and decisions, with no EU law or collective agreements (those stay grey).
- **Isolation incidents, found and fixed during the day.** (1) An agent under test ran `pkill -f soffice`; because every Claude Code command line contained the word "soffice" (in the inherited file-format manual), this killed concurrent runs. Killed runs produced no deliverable and were re-run; the system prompt now goes through a file. (2) Sub-sessions launched from our scripts inherited the environment of the team's coordinating session, including its messaging channel and token; an interruption of that session could reach them, and an agent under test could in principle have messaged the team. We stripped these variables from every run; the audit of all kept transcripts found no use of messaging tools. (3) Earlier, a shared `/tmp`, listable sibling workspaces and large tool outputs stored outside the workspace were closed. One run was lost to an archiving error and re-run, and one exploratory run that loaded personal settings is excluded.

## 8. Conclusion and future work

A verification layer is cheap to add and agent-agnostic. On the first M&A task it turned a failing commercial tool into a passing one by forcing it to account for every requirement of the governing document; on a French claim set it flagged every false claim without a single false green; and its loop returns proven problems to the AI that made them. Next steps:

- complete the held-out LAB measurement, the French set baseline and ContractNLI;
- time a lawyer verifying the demonstration memo by hand versus with the evidence map;
- grade with the official API judges;
- add scripted recomputation of figures to the method;
- extend the method to due diligence over full data rooms (2,600 to 4,000 documents per LAB task) with an inventory, a coverage register and a verified extract for each red flag.

## Appendix A. Reproducibility

All code is in `github.com/cedric190703/harness-law`, branch `youssef/bench-revue`. The LAB checkout lives in `harvey-labs/` (not committed).

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

# Review pages and dashboard
python3 bench/revue.py <task>
python3 bench/tableau.py

# Visa application: lint, types, tests; French claim set
cd visa/app && bun run check && bun scripts/eval.ts
```

### A.2 Runs reported in Section 5.1

Run identifiers under `harvey-labs/results/corporate-ma/<task>/`.

| Task | Agent | Without | With |
|---|---|---|---|
| 1 | Legora | `legora-base/20261004-131842-558458` | `legora-skill/20261004-133520-495811` |
| 1 | Claude Code | `claude-code-sonnet-base/20261004-131336-947962` | `claude-code-sonnet-skill/20261004-131831-582658` |
| 1 | Mistral | `mistral-medium-3.5-high-base/20261004-132603-069767` | `mistral-medium-3.5-high-skill/20261004-132603-069885` |
| 2 | Legora | `legora-base/20261004-150946-572367` | — |
| 2 | Claude Code | `claude-code-sonnet-base/20261004-134830-495786` | `claude-code-sonnet-skill/20261004-133851-230603` |
| 2 | Mistral | `mistral-medium-3.5-high-base/20261004-141516-096437` | `mistral-medium-3.5-high-skill/20261004-143737-681436` |
| 3 | Claude Code | `claude-code-sonnet-base/20261004-133414-134739` | `claude-code-sonnet-skill/20261004-134412-236589` |
| 3 | Mistral | `mistral-medium-3.5-high-base/20261004-150829-400171` | — |

### A.3 Method text pasted into Legora (task 1)

> Compare the attached APA against the closing checklist and produce a categorized, severity-rated deviation report. Output: `closing-checklist-deviation-report.docx`.
>
> Use this verification method (concordance table). One missed or misstated item makes the report wrong, so trade speed for completeness:
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
