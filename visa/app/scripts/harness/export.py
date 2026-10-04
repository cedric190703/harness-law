"""Export deterministe du livrable et de son registre, invoqué par le harness."""
import json
import re
from pathlib import Path
import sys
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter


def main():
    root=Path(sys.argv[1]); out=root/'output'; out.mkdir(exist_ok=True)
    draft=json.loads((root/'draft.json').read_text())
    context=json.loads((root/'export-context.json').read_text())
    rows=[json.loads(line) for line in (root/'ledger.jsonl').read_text().splitlines() if line.strip()]
    by_id={r['id']:r for r in rows}
    names={d['file']:d['name'] for d in context['documents']}
    doc=Document(); sec=doc.sections[0]
    sec.page_width,sec.page_height=Cm(21),Cm(29.7)
    sec.top_margin=sec.bottom_margin=Cm(1.8);sec.left_margin=sec.right_margin=Cm(1.7)
    for border in doc.styles.element.xpath('.//w:pBdr'): border.getparent().remove(border)
    for style in ['Normal','Title','Heading 1','Heading 2']:
        doc.styles[style].font.name='Calibri';doc.styles[style].font.color.rgb=RGBColor(0,0,0)
    doc.styles['Normal'].font.size=Pt(10)
    doc.styles['Caption'].font.color.rgb=RGBColor.from_string('555555')
    doc.styles['Caption'].font.size=Pt(8)
    doc.styles['Caption'].font.bold=False
    sec.header.paragraphs[0].text='VISA  ·  CONFIDENTIEL  ·  BROUILLON À RELIRE'
    sec.footer.paragraphs[0].text='Dossier '+context['project']+'  ·  '
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');sec.footer.paragraphs[0]._p.append(field)
    def table(headers,records):
        t=doc.add_table(rows=1,cols=len(headers));t.style='Table Grid';t.autofit=False
        weights=[.55 if h.lower()=='id' else .8 if h.lower() in ['statut','sévérité'] else 1.6 if 'recommand' in h.lower() else 1.3 for h in headers]
        widths=[Cm(17.6*w/sum(weights)) for w in weights]
        for col,width in zip(t.columns,widths):col.width=width
        borders=OxmlElement('w:tblBorders')
        for edge in ['top','left','bottom','right','insideH','insideV']:
            border=OxmlElement('w:'+edge);border.set(qn('w:val'),'single');border.set(qn('w:sz'),'4');border.set(qn('w:color'),'D9D9D9');borders.append(border)
        t._tbl.tblPr.append(borders)
        for i,record in enumerate([headers]+records):
            cells=t.rows[0].cells if not i else t.add_row().cells
            no_split=OxmlElement('w:cantSplit');t.rows[i]._tr.get_or_add_trPr().append(no_split)
            if not i:t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
            for cell,value,width in zip(cells,record,widths):
                cell.width=width;cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
                cell.text=str(value or '')
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.space_after=Pt(5);paragraph.paragraph_format.space_before=Pt(5)
                    for run in paragraph.runs:run.font.size=Pt(8 if len(headers)>5 else 9)
                if not i:
                    shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'34424A');cell._tc.get_or_add_tcPr().append(shade)
                    for run in cell.paragraphs[0].runs:run.bold=True;run.font.color.rgb=RGBColor(255,255,255)
                elif i%2:
                    shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'F4F6F7');cell._tc.get_or_add_tcPr().append(shade)
        doc.add_paragraph()
    doc.add_paragraph(draft['title'],'Title')
    doc.add_paragraph('Préparé pour '+context['project']+'. Contrôles documentaires automatisés ; validation juridique à effectuer.')
    markdown=['# '+draft['title'],'','Brouillon à relire. Les contrôles mécaniques ne valent pas validation juridique.','']
    for section in draft['sections']:
        doc.add_heading(section['title'],1);markdown+=['## '+section['title'],'',section['content'],'']
        # Le texte du viewer reste la source, sans HTML exécutable ni interprétation de commandes.
        for paragraph in section['content'].split('\n\n'):
            lines=paragraph.splitlines()
            for line in lines if any(re.match(r'^\s*(?:[-*]|\d+\.)\s',x) for x in lines) else [paragraph]:
                bullet=re.match(r'^\s*[-*]\s+(.*)',line)
                heading=re.match(r'^#{1,6}\s+(.*)',line)
                text=bullet[1] if bullet else heading[1] if heading else line
                p=doc.add_paragraph(style='List Bullet' if bullet else 'Heading 2' if heading else 'Normal')
                for chunk in re.split(r'(\*\*.+?\*\*|`[^`]+`)',text):
                    run=p.add_run(chunk[2:-2] if chunk.startswith('**') else chunk[1:-1] if chunk.startswith('`') else chunk)
                    if chunk.startswith('**'):run.bold=True
        if section.get('table'):
            table(section['table']['headers'],section['table']['rows'])
            markdown+=[' | '.join(section['table']['headers'])]+[' | '.join(r) for r in section['table']['rows']]
        doc.add_paragraph('Traçabilité : '+', '.join(section['ledgerIds']))
        for rid in section['ledgerIds']:
            row=by_id[rid]
            for side in ['ref','subj']:
                if row.get(side+'_quote'):
                    name=names.get(row.get(side+'_doc'),row.get(side+'_doc',''))
                    doc.add_paragraph(f"{rid} — {name}, {row.get(side+'_loc','localisation non renseignée')} : « {row[side+'_quote']} »",'Caption')
    doc.add_page_break();doc.add_heading('Tableau de revue et réserves',1)
    doc.add_paragraph('Cette annexe expose les constats qui fondent les sections du livrable. Les priorités et recommandations sont proposées au juriste.')
    # L'annexe de concordance reste identique dans Markdown et Word ; elle porte les valeurs précises du registre.
    markdown+=['## Executive summary — registre des constats','Priority and recommendations — priorités et suites proposées','']
    for r in rows:
        doc.add_heading(r['id']+' '+r['topic'],2)
        values=[['État et priorité',r.get('status','')+' · '+r.get('severity','')],['Référence',str(r.get('ref_value',''))],['Document revu',str(r.get('subj_value',''))],['Impact',r.get('impact','')],['Recommandation',r.get('recommendation','')]]
        table(['Champ','Constat'],values)
        markdown+=['### '+r['id']+' '+r['topic']]+[f'{k}: {v}' for k,v in values]
    doc.add_heading('Pièces et limites de lecture',1)
    for d in context['documents']:doc.add_paragraph(d['name']+' — '+(d.get('limitation') or 'Texte extrait ; exhaustivité de lecture à contrôler.')+' — SHA256 '+d['sha256'])
    doc.add_paragraph('Skill cross-document-review — empreinte '+context['skillHash'])
    doc.save(out/'livrable.docx');(out/'livrable.md').write_text('\n'.join(markdown),encoding='utf-8')
    book=Workbook();book.remove(book.active)
    sheets=[('Constats',['ID','Sujet','État','Priorité','Référence','Document revu','Impact','Recommandation'],[[r.get(k,'') for k in ['id','topic','status','severity','ref_value','subj_value','impact','recommendation']] for r in rows]),
      ('Preuves',['Constat','Pièce','Localisation','Extrait'],[[r['id'],names.get(r.get(s+'_doc'),r.get(s+'_doc','')),r.get(s+'_loc',''),r[s+'_quote']] for r in rows for s in ['ref','subj'] if r.get(s+'_quote')]),
      ('Sections',['ID','Titre','Constats sources'],[[s['id'],s['title'],', '.join(s['ledgerIds'])] for s in draft['sections']]),
      ('Pièces',['Nom','Empreinte','Limites'],[[d['name'],d['sha256'],d.get('limitation','Texte extrait ; lecture complète non attestée.')] for d in context['documents']])]
    import textwrap
    for index,(name,headers,records) in enumerate(sheets):
        sheet=book.create_sheet(name)
        for record in [headers]+records:
            sheet.append([str(c or '') for c in record])
            for c in sheet[sheet.max_row]:c.data_type='s';c.alignment=Alignment(wrap_text=True,vertical='top');c.font=Font(name='Calibri',size=11)
        sheet.freeze_panes='B2'
        for cell in sheet[1]:cell.fill=PatternFill('solid',fgColor='263E36');cell.font=Font(bold=True,color='FFFFFF')
        for col in range(1,len(headers)+1):sheet.column_dimensions[get_column_letter(col)].width=20 if col==1 else 64
        for row in range(2,sheet.max_row+1):sheet.row_dimensions[row].height=min(409,max(55,max(sum(max(1,len(textwrap.wrap(line,width=16 if c.column==1 else 54))) for line in str(c.value or '').split('\n')) for c in sheet[row])*16+12))
        if records:
            t=Table(displayName=f'Registre{index}',ref=sheet.dimensions);t.tableStyleInfo=TableStyleInfo(name='TableStyleMedium2',showRowStripes=True);sheet.add_table(t)
    book.save(out/'tableaux.xlsx')
    print(f"{len(draft['sections'])} sections, {len(rows)} constats. Word, Excel et Markdown générés.")

if __name__=='__main__':main()
