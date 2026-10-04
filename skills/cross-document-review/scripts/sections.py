"""Text helpers shared by extract_text.py and check.py: normalization, blocks, quote search."""
import re

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', " ": " ",
                         "–": "-", "—": "-", "−": "-", "­": ""})
_TABLE_RULES = re.compile(r"[|+]|[-=_]{3,}")
_SECTION = re.compile(
    r"^\s*(?:(?:section|article|clause|schedule|exhibit|annex|part)\s+[\w.()-]+|\d+(?:\.\d+)+\.?|[IVX]+\.|\d+\.)\s+\S",
    re.IGNORECASE | re.MULTILINE,
)
_OPERATIVE = re.compile(
    r"\d|\b(shall|must|may not|will|required?|not less than|not more than|no more than|at least|within|"
    r"limit|cap|floor|threshold|exclud|includ|except|provided that|subject to|deadline|period)\b",
    re.IGNORECASE,
)


def normalize(text: str) -> str:
    text = text.translate(_QUOTES).lower()
    text = _TABLE_RULES.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def find_sections(text: str) -> list[str]:
    return [m.group(0).strip() for m in _SECTION.finditer(text)]


def blocks(text: str) -> list[tuple[int, str]]:
    """Split a document into reviewable blocks: (first line number, block text).

    Paragraphs separated by blank lines; short heading lines are merged into the
    next paragraph; very long blocks (tables) are cut into ~80-word chunks.
    """
    out: list[tuple[int, str]] = []
    pending_line, pending = None, []
    line_no = 0
    for para in re.split(r"\n\s*\n", text):
        start = line_no + 1
        line_no += para.count("\n") + 2
        words = para.split()
        if not words:
            continue
        if pending_line is None:
            pending_line = start
        pending.append(para)
        if len(words) < 8:
            continue  # heading or label: attach to the next paragraph
        joined = "\n".join(pending)
        lines = joined.splitlines()
        if len(joined.split()) <= 150:
            out.append((pending_line, joined))
        else:
            chunk, count, chunk_start = [], 0, pending_line
            for offset, line in enumerate(lines):
                chunk.append(line)
                count += len(line.split())
                if count >= 80:
                    out.append((chunk_start, "\n".join(chunk)))
                    chunk, count, chunk_start = [], 0, pending_line + offset + 1
            if chunk:
                out.append((chunk_start, "\n".join(chunk)))
        pending_line, pending = None, []
    if pending:
        out.append((pending_line, "\n".join(pending)))
    return out


def is_operative(block: str) -> bool:
    return len(block.split()) >= 8 and bool(_OPERATIVE.search(block))


def shingles(words: list[str], n: int = 3) -> set[tuple[str, ...]]:
    if len(words) < n:
        return {tuple(words)} if words else set()
    return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)}


def locate(quote: str, doc_norm: str) -> tuple[str, int]:
    """Return ("exact"|"approx"|"missing", char offset in the normalized document or -1)."""
    q = normalize(quote)
    if not q:
        return "missing", -1
    pos = doc_norm.find(q)
    if pos >= 0:
        return "exact", pos
    q_words = q.split()
    doc_words = doc_norm.split()
    q_sh = shingles(q_words)
    hits = [i for i in range(len(doc_words) - 2) if tuple(doc_words[i:i + 3]) in q_sh]
    if q_sh and len(q_sh) >= 2:
        best_hits, best_start = 0, -1
        window = len(q_words) + 5
        for i in hits:
            span = shingles(doc_words[i:i + window])
            score = len(q_sh & span)
            if score > best_hits:
                best_hits, best_start = score, i
        if best_hits / len(q_sh) >= 0.8:
            return "approx", len(" ".join(doc_words[:best_start]))
    return "missing", -1


_UNIT_NUMBER = re.compile(
    r"\$\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|mm|bn|m|k)?\b"
    r"|(\d[\d,]*(?:\.\d+)?)\s*(%|percent|bps|basis points|x\b|times\b|business days?|days?|months?|years?|weeks?|hours?|million|billion)",
    re.IGNORECASE,
)
_SCALE = {"million": 1e6, "mm": 1e6, "m": 1e6, "billion": 1e9, "bn": 1e9, "thousand": 1e3, "k": 1e3}


def unit_numbers(text: str) -> set[str]:
    """Numbers that carry a legal/economic unit ($, %, bps, x, days, months, years...), as bare values.

    "$1.5 million" and "$1,500,000" both give "1500000"; "0.75%" gives "0.75"; "90 days" gives "90".
    """
    out = set()
    for m in _UNIT_NUMBER.finditer(text.translate(_QUOTES)):
        raw, unit = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
        try:
            value = float(raw.replace(",", ""))
        except ValueError:
            continue
        scale = _SCALE.get((unit or "").lower(), 1)
        out.add(f"{value * scale:.12g}")
    return out


def bare_numbers(text: str) -> set[str]:
    out = set()
    for raw in re.findall(r"\d[\d,]*(?:\.\d+)?", text):
        try:
            out.add(f"{float(raw.replace(',', '')):.12g}")
        except ValueError:
            pass
    return out | unit_numbers(text)


def candidates(docs: dict[str, str]) -> list[tuple[str, int, list[str], str]]:
    """Passages holding a unit-number that appears in no other document: likely deviations.

    docs maps document name -> raw text. Returns (document, line, unique numbers, snippet).
    """
    per_doc = {name: unit_numbers(text) for name, text in docs.items()}
    out = []
    for name, text in docs.items():
        others = set().union(*(nums for other, nums in per_doc.items() if other != name))
        for line_no, block in blocks(text):
            unique = sorted(unit_numbers(block) - others, key=float)
            if unique:
                out.append((name, line_no, unique, " ".join(block.split())[:140]))
    return out
