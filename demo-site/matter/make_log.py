#!/usr/bin/env python3
"""Verification log for the demo matter.

The statements are the ones Legora's agent made in its summary of the deviation
report (run of 4 October 2026 on Harvey LAB task
corporate-ma/compare-closing-checklist-against-ma-agreement). The passages were
located by hand in the two source documents. tools/check_log.py then confirms
every quote and every absence against the documents themselves.

usage: python3 make_log.py   (writes verification-log.json next to this file)
"""
import json
from pathlib import Path

CL, APA = "closing-checklist.docx", "asset-purchase-agreement.docx"


def cl(locator, quote):
    return {"file": CL, "side": "checklist", "locator": locator, "quote": quote}


def apa(locator, quote, rank=""):
    return {"file": APA, "side": "agreement", "locator": locator, "quote": quote, "rank": rank}


SUMMARY = "Part I, summary of key deal terms"

claims = [
    {"id": "S1", "group": "Critical", "cited": 4, "status": "verified",
     "text": "The agreement is inconsistent on the Buyer's identity: the cover page and signature block name Vanguard Industrial Holdings, Inc., while the preamble and operative provisions name Saxonbrook Industrial Holdings, Inc., and the Buyer's notice email uses the domain vanguardindustrial.com.",
     "sources": [
         apa("Cover page", "VANGUARD INDUSTRIAL HOLDINGS, INC."),
         apa("Signature block", "BUYER: ... VANGUARD INDUSTRIAL HOLDINGS, INC. ... Name: Marcus Ellsworth"),
         apa("Preamble", 'by and between Saxonbrook Industrial Holdings, Inc., a Delaware corporation ("Buyer")'),
         apa("§ 11.1, notices", "Email: dhu@vanguardindustrial.com"),
         cl("Title block", 'Saxonbrook Industrial Holdings, Inc. ("Buyer")')],
     "check": "Found both names in the agreement itself. The running page header also says Vanguard."},
    {"id": "S2", "group": "High", "cited": 2, "status": "computed",
     "text": "Escrow Amount: the checklist states $5,500,000; the agreement defines it as $5,250,000.",
     "sources": [
         cl(SUMMARY, "Escrow Amount: $5,500,000 (five million five hundred thousand dollars), representing approximately 6% of the Purchase Price"),
         apa("Art. I, definition of Escrow Amount", '"Escrow Amount" means Five Million Two Hundred Fifty Thousand Dollars ($5,250,000), representing six percent (6%) of the Purchase Price', "Defining clause")],
     "check": "Found both figures. 6% of $87,500,000 is $5,250,000, so the agreement's figure is the one that matches its own percentage.",
     "technical": "0.06 * 87_500_000 == 5_250_000",
     "note": "The original report cited the definition of Closing Cash Payment for this figure. The defining clause is the definition of Escrow Amount, shown here."},
    {"id": "S3", "group": "High", "cited": 2, "status": "computed",
     "text": "Closing Cash Payment: the checklist states $78,500,000; the agreement states $78,750,000.",
     "sources": [
         cl(SUMMARY, "Closing Cash Payment: $78,500,000 (seventy-eight million five hundred thousand dollars)"),
         apa("Art. I, definition of Closing Cash Payment", '"Closing Cash Payment" means an amount equal to Seventy-Eight Million Seven Hundred Fifty Thousand Dollars ($78,750,000)', "Defining clause")],
     "check": "Recomputed both. Purchase price less escrow less holdback gives $78,750,000 with the agreement's escrow and $78,500,000 with the checklist's, so this error follows from the escrow error.",
     "technical": "87_500_000 - 5_250_000 - 3_500_000 == 78_750_000; 87_500_000 - 5_500_000 - 3_500_000 == 78_500_000"},
    {"id": "S4", "group": "High", "cited": 2, "status": "computed",
     "text": "Holdback Amount: the checklist says it is 5% of the Purchase Price; the agreement says 4%.",
     "sources": [
         cl(SUMMARY, "Holdback Amount: $3,500,000 (three million five hundred thousand dollars), representing 5% of the Purchase Price"),
         apa("Art. I, definition of Holdback Amount", '"Holdback Amount" means Three Million Five Hundred Thousand Dollars ($3,500,000), representing four percent (4%) of the Purchase Price', "Defining clause")],
     "check": "Found both. $3,500,000 is 4% of $87,500,000, so the dollar amount agrees and only the checklist's percentage is wrong.",
     "technical": "3_500_000 / 87_500_000 == 0.04"},
    {"id": "S5", "group": "High", "cited": 3, "status": "computed",
     "text": "General Indemnification Cap: the checklist states $8,500,000; the agreement states $8,750,000 (10% of the Purchase Price).",
     "sources": [
         cl(SUMMARY, "Seller's General Indemnification Cap: $8,500,000 (eight million five hundred thousand dollars), representing approximately 10% of the Purchase Price"),
         apa("Art. I, definition of General Indemnification Cap", '"General Indemnification Cap" means Eight Million Seven Hundred Fifty Thousand Dollars ($8,750,000), which amount represents ten percent (10%) of the Purchase Price', "Defining clause")],
     "check": "Found both. 10% of $87,500,000 is $8,750,000.",
     "technical": "0.10 * 87_500_000 == 8_750_000"},
    {"id": "S6", "group": "High", "cited": 3, "status": "verified",
     "text": "Escrow Period: the checklist states 24 months (release around May 15, 2027); the agreement defines it as 18 months, expiring November 15, 2026.",
     "sources": [
         cl(SUMMARY, "Escrow Period: Twenty-four (24) months following the Closing Date"),
         cl("Part VI, item PC-3", "Escrow Release ... ~May 15, 2027"),
         apa("Art. I, definition of Escrow Period", '"Escrow Period" means the period of eighteen (18) months following the Closing Date. If the Closing occurs on May 15, 2025, the Escrow Period shall expire on November 15, 2026.', "Defining clause")],
     "check": "Found all three passages word for word."},
    {"id": "S7", "group": "High", "cited": 2, "status": "verified",
     "text": "De Minimis Collar: the agreement sets a $150,000 threshold below which no working capital adjustment is made; the checklist's description of the adjustment omits it.",
     "sources": [
         apa("Art. I, definition of De Minimis Collar", '"De Minimis Collar" means One Hundred Fifty Thousand Dollars ($150,000), as described in Section 2.6(d)', "Defining clause"),
         cl(SUMMARY, "Working Capital Adjustment: Dollar-for-dollar adjustment for any deviation from the Target Net Working Capital of $6,800,000.")],
     "absent": [{"file": CL, "terms": ["De Minimis Collar", "150,000"]}],
     "check": "Found the collar in the agreement, then searched the whole checklist for it. It is not there."},
    {"id": "S8", "group": "High", "cited": 4, "status": "computed",
     "text": "Transition services fee: the checklist states $50,000 per month ($300,000 total); the agreement states $45,000 per month ($270,000 in aggregate).",
     "sources": [
         cl("Part IV, item S-4", "The monthly fee for transition services shall be $50,000 per month for a total of $300,000 over the six-month term."),
         apa("§ 8.1(d)", "at a fee of Forty-Five Thousand Dollars ($45,000) per month (for an aggregate fee of Two Hundred Seventy Thousand Dollars ($270,000))")],
     "check": "Found both. Six months at each rate gives $300,000 and $270,000.",
     "technical": "6 * 50_000 == 300_000; 6 * 45_000 == 270_000"},
    {"id": "S9", "group": "High", "cited": 3, "status": "verified",
     "text": "Non-competition term: the checklist states 3 years; the agreement states 4 years.",
     "sources": [
         cl("Part IV, item S-5", "The Non-Competition Agreement shall have a term of three (3) years from the Closing Date"),
         apa("§ 8.1(e)", "providing for a non-competition period of four (4) years following the Closing Date")],
     "check": "Found both passages word for word."},
    {"id": "S10", "group": "High", "cited": 3, "status": "verified",
     "text": "Outside Date: the checklist states July 14, 2025 and cites Section 9.1(b); the agreement defines it as August 14, 2025 under Section 10.1(b).",
     "sources": [
         cl(SUMMARY, "Outside Date: July 14, 2025. If the Closing has not occurred by the Outside Date, either party may terminate the APA in accordance with Section 9.1(b)"),
         apa("Art. I, definition of Outside Date", '"Outside Date" means August 14, 2025, as described in Section 10.1(b).', "Defining clause")],
     "check": "Found both passages word for word."},
    {"id": "S11", "group": "Medium", "cited": 3, "status": "verified",
     "text": "Good Standing Certificates: the checklist lists only Oregon; the agreement requires certificates from Oregon and Washington.",
     "sources": [
         cl("Part IV, item S-7", "Certificate of Good Standing (or Certificate of Existence) for Cascade Precision Components, LLC issued by the Oregon Secretary of State."),
         apa("§ 8.1(h)", "of the State of Oregon and the State of Washington")],
     "absent": [{"file": CL, "terms": ["Washington"]}],
     "check": "Found both passages, then searched the checklist for Washington. It does not appear anywhere."},
    {"id": "S12", "group": "Medium", "cited": 0, "status": "partly",
     "text": "Cross-reference errors: the checklist cites Article IX provisions where Article X (Termination) provisions are meant.",
     "sources": [
         cl(SUMMARY, "terminate the APA in accordance with Section 9.1(b)"),
         apa("§ 10.1(b)", "the right to terminate this Agreement under this Section 10.1(b)"),
         cl(SUMMARY, "to secure Seller's indemnification obligations under Article X of the APA"),
         apa("Article headings", "ARTICLE IX — INDEMNIFICATION"),
         apa("Article headings", "ARTICLE X — TERMINATION")],
     "check": "True as stated, and it also runs the other way: the checklist cites indemnification as Article X in three places, where the agreement's indemnification article is Article IX.",
     "note": "The original report gave no citation for this statement."},
    {"id": "S13", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "Purchase Price ($87,500,000) is consistent between the two documents.",
     "sources": [
         cl(SUMMARY, "Purchase Price: $87,500,000 (eighty-seven million five hundred thousand dollars)."),
         apa("Art. I, definition of Purchase Price", '"Purchase Price" means Eighty-Seven Million Five Hundred Thousand Dollars ($87,500,000), subject to adjustment as provided in Section 2.6.', "Defining clause")],
     "check": "Found the same figure in both documents."},
    {"id": "S14", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "Target Net Working Capital ($6,800,000) is consistent.",
     "sources": [
         cl(SUMMARY, "Target Net Working Capital: $6,800,000 (six million eight hundred thousand dollars)"),
         apa("Art. I, definition of Target NWC", '"Target NWC" means Six Million Eight Hundred Thousand Dollars ($6,800,000)', "Defining clause")],
     "check": "Found the same figure in both documents."},
    {"id": "S15", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "Indemnification Basket ($875,000) is consistent.",
     "sources": [
         cl(SUMMARY, "Indemnification Basket: $875,000 (eight hundred seventy-five thousand dollars), representing 1% of the Purchase Price"),
         apa("Art. I, definition of Basket", '"Basket" means Eight Hundred Seventy-Five Thousand Dollars ($875,000), which amount represents one percent (1%) of the Purchase Price', "Defining clause")],
     "check": "Found the same figure and the same percentage in both documents."},
    {"id": "S16", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "Mini-Basket ($50,000) is consistent.",
     "sources": [
         cl(SUMMARY, "Mini-Basket: $50,000 per individual claim."),
         apa("Art. I, definition of Mini-Basket", '"Mini-Basket" means Fifty Thousand Dollars ($50,000), as described in Section 9.4(b).', "Defining clause")],
     "check": "Found the same figure in both documents."},
    {"id": "S17", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "Fundamental Representations Cap (the Purchase Price) and survival (36 months) are consistent.",
     "sources": [
         cl(SUMMARY, "Fundamental Representations Cap: Equal to the full Purchase Price ($87,500,000)."),
         cl(SUMMARY, "Fundamental Representations Survival: Thirty-six (36) months following the Closing Date."),
         apa("§ 9.4(d)", "with respect to Fundamental Representations shall not exceed an amount equal to the Purchase Price"),
         apa("§ 9.1", "shall survive the Closing for a period of thirty-six (36) months following the Closing Date")],
     "check": "Found the cap and the survival period in both documents."},
    {"id": "S18", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "General Survival Period (18 months) is consistent.",
     "sources": [
         cl(SUMMARY, "General Survival Period: Eighteen (18) months following the Closing Date."),
         apa("§ 9.1", 'for a period of eighteen (18) months following the Closing Date (the "General Survival Period")')],
     "check": "Found the same period in both documents."},
    {"id": "S19", "group": "Stated as consistent", "cited": 0, "status": "partly",
     "text": "Reverse Break-Up Fee ($2,625,000) is consistent.",
     "sources": [
         cl(SUMMARY, "Reverse Break-Up Fee: $2,625,000 (two million six hundred twenty-five thousand dollars), representing 3% of the Purchase Price, payable by Buyer to Seller in the event of termination by Seller pursuant to Section 9.1(d) of the APA."),
         apa("Art. I, definition of Reverse Break-Up Fee", '"Reverse Break-Up Fee" means Two Million Six Hundred Twenty-Five Thousand Dollars ($2,625,000), representing three percent (3%) of the Purchase Price', "Defining clause"),
         apa("§ 10.3", "In the event this Agreement is terminated by Seller pursuant to Section 10.1(e)")],
     "check": "The amount is the same in both documents. The trigger is not: the checklist points to Section 9.1(d), the agreement to Section 10.1(e).",
     "technical": "0.03 * 87_500_000 == 2_625_000"},
    {"id": "S20", "group": "Stated as consistent", "cited": 0, "status": "partly",
     "text": "Accrued PTO (about $387,000) is consistent.",
     "sources": [
         cl(SUMMARY, "Accrued PTO Liability (Assumed): Estimated at approximately $387,000 as of the anticipated Closing Date."),
         apa("§ 2.3", "estimated at approximately Three Hundred Eighty-Seven Thousand Dollars ($387,000) as of the date hereof, which amount shall be adjusted to reflect the actual accrued balances as of the Closing Date")],
     "check": "The amount is the same. The reference date is not: the checklist gives the estimate as of the anticipated Closing Date, the agreement as of its signing date, to be adjusted at Closing."},
    {"id": "S21", "group": "Stated as consistent", "cited": 0, "status": "computed",
     "text": "The employee offer threshold is consistent.",
     "sources": [
         cl(SUMMARY, "Employee Matters: Buyer shall offer employment to at least 85% of Seller's 127 full-time employees (i.e., at least 108 employees)"),
         apa("§ 6.8(a)", "offer employment to at least eighty-five percent (85%) of Seller's one hundred twenty-seven (127) full-time employees")],
     "check": "Found the same threshold in both documents. 85% of 127 is 107.95, which rounds up to the 108 both documents state.",
     "technical": "math.ceil(0.85 * 127) == 108"},
    {"id": "S22", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "The Scheduled Closing Date is consistent.",
     "sources": [
         cl("Title block", "Scheduled Closing Date: May 15, 2025"),
         apa("§ 3.1", 'shall take place on May 15, 2025 (the "Closing Date")')],
     "check": "Found the same date in both documents."},
    {"id": "S23", "group": "Stated as consistent", "cited": 0, "status": "verified",
     "text": "The treatment of the Aeromet litigation is consistent.",
     "sources": [
         cl("Part III, item P-8", "confirm that such matter remains an Excluded Liability under Section 2.4(d) of the APA"),
         apa("§ 2.4(d)", "(d) Pending Litigation. Any and all liabilities arising from or relating to the pending litigation styled Aeromet Supply Corp. v. Cascade Precision Components, LLC, Case No. 3:24-cv-01187 (D. Or.)")],
     "check": "Found the litigation listed as an excluded liability in item (d) of Section 2.4 of the agreement, as the checklist says."},
]

missing = [
    {"id": "M1", "title": "FIRPTA certificate",
     "text": "The agreement requires a FIRPTA certificate from the Seller, both as a closing deliverable and as a condition to the Buyer's obligation to close. The checklist does not list it.",
     "sources": [
         apa("§ 8.1(f)", "(f) FIRPTA Certificate. A certificate of non-foreign status of Seller"),
         apa("§ 7.1(h)", "(h) FIRPTA Certificate. Buyer shall have received the FIRPTA Certificate described in Section 8.1(f)")],
     "absent": [{"file": CL, "terms": ["FIRPTA", "non-foreign"]}]},
    {"id": "M2", "title": "Northwind Aerospace consent",
     "text": "The agreement lists the consent of Northwind Aerospace, Inc. as a Required Consent. The checklist's list of Required Consents does not include it.",
     "sources": [
         apa("Schedule 7.1(d), item (iii)", "(iii) the consent of Northwind Aerospace, Inc. under the Northwind Supply Agreement dated April 12, 2021"),
         cl("Part III, item P-2", "The Required Consents are as follows:")],
     "absent": [{"file": CL, "terms": ["Northwind"]}]},
    {"id": "M3", "title": "Title insurance commitments",
     "text": "The agreement requires title insurance commitments for the owned real property as a Seller closing deliverable. The checklist tracks a title search before closing but does not list the commitments as a deliverable.",
     "sources": [
         apa("§ 8.1(l)", "(l) Title Insurance Commitments. Commitments for title insurance from Cascadia Title & Guaranty Co. for all Owned Real Property"),
         cl("Part III, item P-6", "Item P-6: Title Search and Insurance. Order title search for Seller's owned real property")],
     "absent": [{"file": CL, "terms": ["Title Insurance Commitments", "Commitments for title insurance", "title commitment"]}]},
    {"id": "M4", "title": "Landlord estoppel certificates",
     "text": "The agreement requires estoppel certificates from landlords under the assigned leases, as a condition to closing and as a Seller deliverable. The checklist does not mention them.",
     "sources": [
         apa("§ 7.1(f)", "(f) Estoppel Certificates. Buyer shall have received estoppel certificates from all landlords under Assigned Real Property Leases")],
     "absent": [{"file": CL, "terms": ["estoppel"]}]},
]

# Section 8.1 and 8.2 of the agreement, item by item, against the checklist's Parts IV and V
coverage = [
    ["§ 8.1(a)", "Bill of Sale", "S-1", "listed"],
    ["§ 8.1(b)", "Assignment and Assumption Agreement", "S-2", "listed"],
    ["§ 8.1(c)", "IP Assignment Agreement", "S-3", "listed"],
    ["§ 8.1(d)", "Transition Services Agreement", "S-4", "differs"],
    ["§ 8.1(e)", "Non-Competition Agreement", "S-5", "differs"],
    ["§ 8.1(f)", "FIRPTA Certificate", "", "missing"],
    ["§ 8.1(g)", "Secretary's Certificate", "S-6", "listed"],
    ["§ 8.1(h)", "Good Standing Certificates", "S-7", "differs"],
    ["§ 8.1(i)", "Payoff Letter", "S-8", "listed"],
    ["§ 8.1(j)", "Required Consents", "S-9", "differs"],
    ["§ 8.1(k)", "Estoppel Certificates", "", "missing"],
    ["§ 8.1(l)", "Title Insurance Commitments", "", "missing"],
    ["§ 8.1(m)", "Seller's Closing Certificate", "S-10", "listed"],
    ["§ 8.2(a)", "Closing Cash Payment", "B-1", "differs"],
    ["§ 8.2(b)", "Escrow Amount", "B-1", "differs"],
    ["§ 8.2(c)", "Assignment and Assumption Agreement", "B-2", "listed"],
    ["§ 8.2(d)", "Transition Services Agreement", "B-3", "listed"],
    ["§ 8.2(e)", "Escrow Agreement", "B-4", "listed"],
    ["§ 8.2(f)", "Secretary's Certificate", "B-5", "listed"],
    ["§ 8.2(g)", "Good Standing Certificate", "B-6", "listed"],
    ["§ 8.2(h)", "Buyer's Closing Certificate", "B-7", "listed"],
]

# short titles for lists, and the exact values to mark as differing or matching in the passages
SHORT = {"S1": "Buyer's identity", "S2": "Escrow Amount", "S3": "Closing Cash Payment", "S4": "Holdback percentage",
         "S5": "Indemnification Cap", "S6": "Escrow Period", "S7": "De Minimis Collar", "S8": "Transition services fee",
         "S9": "Non-competition term", "S10": "Outside Date", "S11": "Good Standing Certificates", "S12": "Cross-references",
         "S13": "Purchase Price", "S14": "Target Net Working Capital", "S15": "Indemnification Basket", "S16": "Mini-Basket",
         "S17": "Fundamental Representations", "S18": "General Survival Period", "S19": "Reverse Break-Up Fee",
         "S20": "Accrued PTO", "S21": "Employee offer threshold", "S22": "Scheduled Closing Date", "S23": "Aeromet litigation"}
HL = {
    "S1": {"diff": ["VANGUARD INDUSTRIAL HOLDINGS, INC.", "Saxonbrook Industrial Holdings, Inc.", "vanguardindustrial.com"]},
    "S2": {"diff": ["$5,500,000", "$5,250,000"], "same": ["6%"]},
    "S3": {"diff": ["$78,500,000", "$78,750,000"]},
    "S4": {"diff": ["5%", "4%"], "same": ["$3,500,000"]},
    "S5": {"diff": ["$8,500,000", "$8,750,000"], "same": ["10%"]},
    "S6": {"diff": ["Twenty-four (24) months", "eighteen (18) months", "~May 15, 2027", "November 15, 2026"]},
    "S7": {"diff": ["$150,000"]},
    "S8": {"diff": ["$50,000", "$300,000", "$45,000", "$270,000"]},
    "S9": {"diff": ["three (3) years", "four (4) years"]},
    "S10": {"diff": ["July 14, 2025", "Section 9.1(b)", "August 14, 2025", "Section 10.1(b)"]},
    "S11": {"diff": ["the State of Washington"], "same": ["Oregon"]},
    "S12": {"diff": ["Section 9.1(b)", "Section 10.1(b)", "Article X of the APA", "ARTICLE IX — INDEMNIFICATION"]},
    "S13": {"same": ["$87,500,000"]}, "S14": {"same": ["$6,800,000"]}, "S15": {"same": ["$875,000", "1%"]},
    "S16": {"same": ["$50,000"]},
    "S17": {"same": ["Thirty-six (36) months", "thirty-six (36) months", "Purchase Price"]},
    "S18": {"same": ["Eighteen (18) months", "eighteen (18) months"]},
    "S19": {"same": ["$2,625,000", "3%"], "diff": ["Section 9.1(d)", "Section 10.1(e)"]},
    "S20": {"same": ["$387,000"], "diff": ["as of the anticipated Closing Date", "as of the date hereof"]},
    "S21": {"same": ["85%", "127"]}, "S22": {"same": ["May 15, 2025"]},
    "S23": {"same": ["Section 2.4(d)", "(d) Pending Litigation"]},
    "M1": {"diff": ["FIRPTA Certificate"]}, "M2": {"diff": ["Northwind Aerospace, Inc."]},
    "M3": {"diff": ["Title Insurance Commitments"]}, "M4": {"diff": ["Estoppel Certificates"]},
}
for item in claims + missing:
    item["short"] = SHORT.get(item["id"], item.get("title", ""))
    item["hl"] = HL.get(item["id"], {})

log = {
    "matter": {
        "title": "Asset purchase agreement vs closing checklist",
        "instruction": "Compare the attached APA against the closing checklist and produce a categorized, severity-rated deviation report.",
        "produced_by": "Legora",
        "produced_on": "4 October 2026",
        "original_citations": 30,
        "task_source": "Harvey Legal Agent Benchmark, corporate-ma/compare-closing-checklist-against-ma-agreement",
        # the same task run twice in Legora on 4 October 2026, graded by the team (harness-law, branch youssef/bench-revue)
        "runs": {"of": 38, "plain": 26, "with_method": 38,
                 "note": "Criteria passed on the benchmark's official rubric, graded by two AI judges. One run each."},
    },
    "documents": [
        {"file": APA, "tier": "primary", "read": True, "used": True, "note": "The signed agreement. It governs."},
        {"file": CL, "tier": "secondary", "read": True, "used": True, "note": "Counsel's working summary of the agreement. This is the document being checked."},
    ],
    "path": [
        {"step": "Took the report's statements one by one", "detail": "23 statements: 12 deviations and 11 terms the report says are consistent."},
        {"step": "Found the passage behind each statement in both documents", "detail": "For a defined term, the definition itself rather than a clause that happens to repeat the figure."},
        {"step": "Recomputed every figure that can be recomputed", "detail": "Percentages of the purchase price, the closing payment, the monthly fees."},
        {"step": "Proved the statements that had no citation", "detail": "The report cited nothing for 12 statements, including all 11 it calls consistent. Each now has both passages."},
        {"step": "Read the agreement's closing deliverables against the checklist", "detail": "Sections 8.1 and 8.2, item by item, looking for anything the checklist leaves out."},
        {"step": "Searched the checklist for each item that seemed to be missing", "detail": "An omission cannot be quoted, so it is shown by a search that returns nothing."},
        {"step": "Checked every quote against the documents a second time, by program", "detail": "A separate checker opens the files and confirms each quote is really there."},
    ],
    "claims": claims,
    "missing": missing,
    "coverage": [dict(zip(["section", "requirement", "checklist_item", "status"], row)) for row in coverage],
    "review_order": ["S19", "S20", "S12"] + [c["id"] for c in claims if c["id"] not in ("S19", "S20", "S12")],
}

Path(__file__).with_name("verification-log.json").write_text(json.dumps(log, indent=2, ensure_ascii=False), "utf-8")
print(len(claims), "statements,", len(missing), "missing items,", len(coverage), "coverage rows")
