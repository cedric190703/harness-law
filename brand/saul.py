"""Dessine Saul, la mascotte, dans ses six états. Lancer : python3 brand/saul.py

Saul est un petit avocat-astronaute : casque blanc, visière noire, costume
blanc, revers noirs, mèche rabattue. Sa cravate prend la couleur du verdict ;
c'est la seule couleur du personnage.
"""

from pathlib import Path

INK = "#0B0C0E"     # contours, visière, revers
SUIT = "#F4F3EF"    # casque et costume
SHADE = "#D9D8D2"   # ombres du costume
EYE = "#F4F3EF"

ETATS = {
    # nom: (couleur de la cravate, yeux, pose du bras droit, accessoire)
    "repos":       ("#F4F3EF", "pill",  "down",  None),
    "lecture":     ("#8FB8FF", "scan",  "down",  None),
    "verifie":     ("#2FD08A", "happy", "thumb", None),
    "objection":   ("#FF4D3D", "angry", "point", None),
    "date":        ("#FFB020", "pill",  "down",  "clock"),
    "nonverifie":  ("#7A808A", "flat",  "shrug", None),
}


def yeux(kind):
    if kind == "pill":
        return (f'<rect x="92" y="70" width="14" height="24" rx="7" fill="{EYE}"/>'
                f'<rect x="134" y="70" width="14" height="24" rx="7" fill="{EYE}"/>')
    if kind == "scan":
        return (f'<rect x="92" y="74" width="14" height="16" rx="7" fill="{EYE}"/>'
                f'<rect x="134" y="74" width="14" height="16" rx="7" fill="{EYE}"/>'
                '<rect x="76" y="96" width="88" height="3" rx="1.5" fill="#8FB8FF" opacity="0.9"/>')
    if kind == "happy":
        return (f'<path d="M90 88 Q99 70 108 88" fill="none" stroke="{EYE}" stroke-width="7" stroke-linecap="round"/>'
                f'<path d="M132 88 Q141 70 150 88" fill="none" stroke="{EYE}" stroke-width="7" stroke-linecap="round"/>')
    if kind == "angry":
        return (f'<path d="M88 70 L110 78" stroke="{EYE}" stroke-width="6" stroke-linecap="round"/>'
                f'<path d="M152 70 L130 78" stroke="{EYE}" stroke-width="6" stroke-linecap="round"/>'
                f'<rect x="93" y="82" width="13" height="14" rx="6.5" fill="{EYE}"/>'
                f'<rect x="134" y="82" width="13" height="14" rx="6.5" fill="{EYE}"/>')
    if kind == "flat":
        return (f'<rect x="88" y="80" width="20" height="6" rx="3" fill="{EYE}"/>'
                f'<rect x="132" y="80" width="20" height="6" rx="3" fill="{EYE}"/>')
    raise ValueError(kind)


def membre(x1, y1, x2, y2):
    """Un bras : un trait épais cerné de noir."""
    return (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{INK}" stroke-width="30" stroke-linecap="round"/>'
            f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{SUIT}" stroke-width="22" stroke-linecap="round"/>')


def main(cx, cy):
    return f'<circle cx="{cx}" cy="{cy}" r="13" fill="{SUIT}" stroke="{INK}" stroke-width="4"/>'


def doigt(x, y, w, h, angle=0, cx=0, cy=0):
    rot = f' transform="rotate({angle} {cx} {cy})"' if angle else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(w, h) / 2}" fill="{SUIT}" '
            f'stroke="{INK}" stroke-width="4"{rot}/>')


def bras(pose, tie):
    """Bras gauche le long du corps, sauf haussement d'épaules ; bras droit selon la pose."""
    gauche = membre(58, 170, 50, 250) + main(50, 258)
    if pose == "down":
        droit = membre(182, 170, 190, 250) + main(190, 258)
    elif pose == "thumb":
        droit = membre(182, 176, 222, 130) + doigt(220, 94, 13, 32, -10, 226, 126) + main(224, 126)
    elif pose == "point":
        droit = membre(182, 176, 220, 118) + doigt(215, 72, 11, 38) + main(220, 114)
    elif pose == "shrug":
        gauche = membre(58, 172, 28, 150) + main(22, 140)
        droit = membre(182, 172, 212, 150) + main(218, 140)
    else:
        raise ValueError(pose)
    return gauche, droit


def accessoire(kind):
    if kind == "clock":
        return (f'<circle cx="196" cy="54" r="22" fill="#FFB020" stroke="{INK}" stroke-width="4"/>'
                f'<path d="M196 42 V54 L205 60" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>')
    return ""


def saul(nom):
    tie, eyes, pose, extra = ETATS[nom]
    s = f'stroke="{INK}" stroke-width="4"'
    gauche, droit = bras(pose, tie)
    leve = pose in ("thumb", "point")
    arriere = gauche if leve else gauche + droit
    avant = droit if leve else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300" width="240" height="300" aria-label="Saul, {nom}">
<ellipse cx="120" cy="290" rx="78" ry="7" fill="{INK}" opacity="0.18"/>
{arriere}
<path d="M60 168 Q60 150 80 148 L160 148 Q180 150 180 168 L184 276 Q184 284 176 284 L64 284 Q56 284 56 276 Z" fill="{SUIT}" {s}/>
<path d="M120 284 L120 196" stroke="{SHADE}" stroke-width="3"/>
<path d="M98 148 L120 196 L142 148 Z" fill="#FFFFFF" {s} stroke-linejoin="round"/>
<path d="M82 150 L112 214 L100 222 L74 160 Z" fill="{INK}"/>
<path d="M158 150 L128 214 L140 222 L166 160 Z" fill="{INK}"/>
<path d="M113 150 L127 150 L124 160 L116 160 Z" fill="{tie}" {s} stroke-linejoin="round"/>
<path d="M116 160 L124 160 L130 206 L120 218 L110 206 Z" fill="{tie}" {s} stroke-linejoin="round"/>
<circle cx="143" cy="246" r="3.5" fill="{INK}"/>
<circle cx="143" cy="264" r="3.5" fill="{INK}"/>
<rect x="104" y="132" width="32" height="20" rx="6" fill="{SHADE}" {s}/>
<rect x="44" y="30" width="152" height="112" rx="48" fill="{SUIT}" {s}/>
<rect x="34" y="70" width="14" height="34" rx="7" fill="{SHADE}" {s}/>
<rect x="192" y="70" width="14" height="34" rx="7" fill="{SHADE}" {s}/>
<rect x="66" y="54" width="108" height="66" rx="28" fill="{INK}"/>
<path d="M80 60 Q96 56 108 58" stroke="#3A3E46" stroke-width="5" stroke-linecap="round" fill="none"/>
{yeux(eyes)}
<path d="M58 54 C 70 18, 150 8, 186 46" fill="none" stroke="{SUIT}" stroke-width="20" stroke-linecap="round"/>
<path d="M58 54 C 70 18, 150 8, 186 46" fill="none" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>
<path d="M70 44 C 96 22, 150 20, 176 40" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
{avant}
{accessoire(extra)}
</svg>'''


if __name__ == "__main__":
    out = Path(__file__).parent / "saul"
    out.mkdir(exist_ok=True)
    for nom in ETATS:
        corps = saul(nom)
        (out / f"saul-{nom}.svg").write_text(corps)
        # l'avatar du chat : la tête seule, même dessin recadré
        tete = corps.replace('viewBox="0 0 240 300" width="240" height="300"', 'viewBox="24 4 192 192" width="192" height="192"')
        (out / f"avatar-{nom}.svg").write_text(tete)
    print("ok", ", ".join(ETATS))
