#!/usr/bin/env python3
"""Source unique de la revue et des exports de due diligence."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

PRIORITIES = {"Critique": 0, "Élevée": 1, "Modérée": 2, "Faible": 3}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def normalized(text):
    return " ".join(text.split())

def extract(path):
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".csv"}:
        return [path.read_text(encoding="utf-8-sig")], "lignes"
    if suffix == ".pdf":
        from pypdf import PdfReader
        return [page.extract_text() or "" for page in PdfReader(path).pages], "pages"
    if suffix == ".docx":
        from docx import Document
        from docx.table import Table
        blocks = []
        for item in Document(path).iter_inner_content():
            if isinstance(item, Table):
                blocks.extend(" | ".join(c.text for c in row.cells) for row in item.rows)
            else:
                blocks.append(item.text)
        return ["\n".join(blocks)], "lignes extraites"
    raise ValueError(f"Format non pris en charge : {suffix or 'sans extension'}")

def inventory(room):
    documents, hashes = [], {}
    for path in sorted(room.rglob("*")):
        if not path.is_file() and not path.is_symlink():
            continue
        relative = path.relative_to(room).as_posix()
        doc = {"id": "P-" + digest(relative.encode())[:12], "path": relative,
               "sha256": "", "units": [], "locator": "", "unread_units": [],
               "extraction": "illisible", "reason": "", "duplicate_of": None,
               "decision": "à examiner", "decision_reason": "", "parent": None,
               "consulted": False, "signature": "non vérifiée"}
        try:
            if path.is_symlink():
                raise ValueError("Lien symbolique non suivi")
            doc["sha256"] = digest(path.read_bytes())
            if doc["sha256"] in hashes:
                doc["duplicate_of"] = hashes[doc["sha256"]]
                doc["decision"] = "exclue"
                doc["decision_reason"] = "Doublon binaire exact"
            else:
                hashes[doc["sha256"]] = doc["id"]
            doc["units"], doc["locator"] = extract(path)
            doc["unread_units"] = [i for i, t in enumerate(doc["units"], 1) if not t.strip()]
            if not doc["units"] or len(doc["unread_units"]) == len(doc["units"]):
                raise ValueError("Aucun texte exploitable ; OCR ou nouvelle pièce nécessaire")
            doc["extraction"] = "partielle" if doc["unread_units"] else "extraite"
            if doc["unread_units"]:
                doc["reason"] = "Pages sans texte exploitable : " + ", ".join(map(str, doc["unread_units"]))
            if path.suffix.lower() == '.docx':
                doc['extraction'] = 'partielle'
                doc['reason'] = 'Corps et tableaux extraits ; notes, commentaires, zones de texte et en-têtes non couverts. Pagination originale indisponible.'
        except Exception as exc:
            doc["reason"] = str(exc)
        documents.append(doc)
    return documents

def required(obj, keys, context):
    for key in keys:
        if not isinstance(obj.get(key), str) or not obj[key].strip():
            raise ValueError(f"{context} : champ {key} requis")

def locate(doc, evidence):
    if evidence.get("sha256") != doc["sha256"]:
        raise ValueError("La version de la pièce a changé : preuve à reprendre")
    page = evidence.get("page")
    start, end = evidence.get("line_start"), evidence.get("line_end")
    if doc["locator"] == "pages":
        if type(page) is not int or not 1 <= page <= len(doc["units"]):
            raise ValueError("Page source invalide")
        text = doc["units"][page - 1]
        label = f"p. {page}"
    else:
        lines = doc["units"][0].splitlines() if doc["units"] else []
        if type(start) is not int or type(end) is not int or not 1 <= start <= end <= len(lines):
            raise ValueError("Plage de lignes invalide")
        text = "\n".join(lines[start - 1:end])
        label = f"l. {start}–{end} ({doc['locator']})"
    if not normalized(evidence.get("quote", "")) or normalized(evidence["quote"]) not in normalized(text):
        raise ValueError("Citation absente du passage indiqué")
    return label, text

def build(room, case, previous=None):
    required(case, ["title", "client", "scope", "as_of"], "Mission")
    docs = inventory(room)
    by_path = {d["path"]: d for d in docs}
    by_id = {d["id"]: d for d in docs}
    for path, decision in case.get("documents", {}).items():
        if path not in by_path:
            raise ValueError(f"Décision sur une pièce absente : {path}")
        doc = by_path[path]
        if decision.get("decision") not in {"retenue", "exclue", "à examiner"}:
            raise ValueError(f"Décision documentaire invalide : {path}")
        required(decision, ["reason", "sha256"], path)
        if decision["sha256"] != doc["sha256"]:
            doc["decision_reason"] = "Décision antérieure périmée : pièce modifiée"
            continue
        doc.update(decision=decision["decision"], decision_reason=decision["reason"])
        if decision.get("parent"):
            parent = by_path.get(decision["parent"])
            if not parent or parent["id"] == doc["id"]:
                raise ValueError(f"Contrat parent invalide : {path}")
            doc["parent"] = parent["id"]
    for doc in docs:
        seen, cursor = set(), doc
        while cursor.get("parent"):
            if cursor["id"] in seen:
                raise ValueError("Cycle dans le rattachement des avenants")
            seen.add(cursor["id"])
            cursor = by_id[cursor["parent"]]
    previous_docs = {d["path"]: d for d in (previous or {}).get("documents", [])}
    changes = []
    if previous:
        for path in sorted(set(previous_docs) | set(by_path)):
            old, new = previous_docs.get(path), by_path.get(path)
            status = "ajoutée" if not old else "retirée" if not new else "modifiée" if old["sha256"] != new["sha256"] else None
            if status:
                changes.append({"path": path, "status": status})
    findings, ids = [], set()
    for row in case.get("findings", []):
        required(row, ["id", "topic", "workstream", "statement", "impact", "recommendation", "priority", "selection_reason"], "Constat")
        if row["id"] in ids or row["priority"] not in PRIORITIES:
            raise ValueError(f"Identifiant répété ou priorité invalide : {row['id']}")
        ids.add(row["id"])
        item = dict(row, evidence=[], errors=[], validation="à valider", reviewer="", reviewed_at="")
        consulted = row.get("consulted", [])
        if not isinstance(consulted, list) or not consulted:
            raise ValueError(f"{row['id']} : documents consultés requis")
        for path in consulted:
            if path not in by_path:
                item["errors"].append(f"Pièce consultée absente : {path}")
            else:
                by_path[path]["consulted"] = True
        for evidence in row.get("evidence", []):
            ev = dict(evidence, verified=False, location="", passage="")
            try:
                required(evidence, ["path", "sha256", "quote", "clause"], row["id"])
                doc = by_path.get(evidence["path"])
                if not doc:
                    raise ValueError("Pièce source absente")
                if doc["path"] not in consulted:
                    raise ValueError("Source non déclarée consultée")
                if doc["decision"] == "exclue":
                    raise ValueError("Une pièce exclue ne peut étayer un constat")
                ev["location"], ev["passage"] = locate(doc, evidence)
                ev["document_id"], ev["verified"] = doc["id"], True
            except ValueError as exc:
                ev["error"] = str(exc)
                item["errors"].append(f"{evidence.get('path', '?')} : {exc}")
            item["evidence"].append(ev)
        if not item["evidence"]:
            item["errors"].append("Aucune preuve fournie")
        state = row.get("validation", "à valider")
        if state not in {"à valider", "validé", "à corriger"}:
            raise ValueError("État de validation invalide")
        if state == "validé":
            required(row, ["reviewer", "reviewed_at"], row["id"])
            item.update(reviewer=row["reviewer"], reviewed_at=row["reviewed_at"])
        item["validation"] = "à reprendre" if item["errors"] or changes else state
        findings.append(item)
    for item in findings:
        if any(link not in ids for link in item.get("links", [])):
            raise ValueError(f"{item['id']} : renvoi vers un constat inconnu")
    limitations = list(case.get('limitations', []))
    if any(Path(d['path']).suffix.lower() == '.pdf' for d in docs):
        limitations.append('PDF : extraction du texte disponible, sans OCR. Les images et les passages scannés peuvent rester non lus même sur une page contenant du texte.')
    return {"schema_version": 1, "mission": {k: case[k] for k in ["title", "client", "scope", "as_of"]},
            "generated_at": datetime.now(timezone.utc).isoformat(), "documents": docs,
            "findings": sorted(findings, key=lambda r: (PRIORITIES[r["priority"]], r["id"])),
            "changes": changes, "counts": dict(Counter(d["extraction"] for d in docs)),
            "limitations": list(dict.fromkeys(limitations)), "draft": any(r["validation"] != "validé" for r in findings) or not findings or any(not d['consulted'] and d['decision'] != 'exclue' or d['extraction'] != 'extraite' for d in docs)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--room", required=True, type=Path)
    parser.add_argument("--case", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--office", action="store_true", help="Générer Word et Excel")
    args = parser.parse_args()
    if not args.room.is_dir():
        parser.error("Data room introuvable")
    if args.out.resolve().is_relative_to(args.room.resolve()):
        parser.error("Le dossier de sortie doit être extérieur à la data room")
    data = build(args.room, json.loads(args.case.read_text()), json.loads(args.previous.read_text()) if args.previous else None)
    args.out.mkdir(parents=True, exist_ok=True)
    from due_diligence.exports import export_html, export_office
    if args.office:
        export_office(data, args.out)
    data['office_exports'] = args.office
    export_html(data, args.out)
    (args.out / "review.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    errors = sum(len(f["errors"]) for f in data["findings"])
    print(f"{len(data['documents'])} pièces, {len(data['findings'])} constats, {errors} défauts de preuve. Sortie : {args.out}")
    if errors:
        raise SystemExit(2)

if __name__ == "__main__":
    main()
