"""Deterministic export of the deliverable and its ledger, invoked by the harness."""
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

# Deliverables whose evidence tables are too wide to read on a portrait page.
WIDE = {'disclosure-schedule', 'seller-questions', 'contract-table', 'cap-table'}
LETTER = re.compile(r'^letter-\d+$')


def column_weight(header):
    """Wider columns for the free text, narrow ones for ids and labels."""
    h = header.lower()
    if h == 'id' or h.startswith('ref'):
        return .55
    if h in ('status', 'severity', 'priority', 'shares', 'date'):
        return .8
    if 'excerpt' in h or 'quote' in h:
        return 1.9
    if 'recommend' in h or 'request' in h or 'why' in h or 'impact' in h:
        return 1.6
    return 1.3


def sheet_name(raw, used):
    """Excel sheet names: 31 characters, no []:*?/\\, and unique in the workbook."""
    name = re.sub(r'[\[\]:*?/\\]', ' ', str(raw)).strip()[:31] or 'Sheet'
    candidate, n = name, 2
    while candidate.lower() in used:
        suffix = f' ({n})'
        candidate = name[:31 - len(suffix)] + suffix
        n += 1
    used.add(candidate.lower())
    return candidate


def main():
    root=Path(sys.argv[1]); out=root/'output'; out.mkdir(exist_ok=True)
    draft=json.loads((root/'draft.json').read_text())
    context=json.loads((root/'export-context.json').read_text())
    rows=[json.loads(line) for line in (root/'ledger.jsonl').read_text().splitlines() if line.strip()]
    by_id={r['id']:r for r in rows}
    names={d['file']:d['name'] for d in context['documents']}
    kind=draft.get('kind','report')
    doc=Document(); sec=doc.sections[0]
    # A wide deliverable turns the page so its excerpt column stays readable.
    sec.page_width,sec.page_height=(Cm(29.7),Cm(21)) if kind in WIDE else (Cm(21),Cm(29.7))
    sec.top_margin=sec.bottom_margin=Cm(1.8);sec.left_margin=sec.right_margin=Cm(1.7)
    usable=sec.page_width.cm-sec.left_margin.cm-sec.right_margin.cm
    for border in doc.styles.element.xpath('.//w:pBdr'): border.getparent().remove(border)
    for style in ['Normal','Title','Heading 1','Heading 2']:
        doc.styles[style].font.name='Calibri';doc.styles[style].font.color.rgb=RGBColor(0,0,0)
    doc.styles['Normal'].font.size=Pt(10)
    doc.styles['Caption'].font.color.rgb=RGBColor.from_string('555555')
    doc.styles['Caption'].font.size=Pt(8)
    doc.styles['Caption'].font.bold=False
    sec.header.paragraphs[0].text='SAUL  ·  CONFIDENTIAL  ·  DRAFT FOR REVIEW'
    sec.footer.paragraphs[0].text='Matter '+context['project']+'  ·  '
    field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');sec.footer.paragraphs[0]._p.append(field)
    def table(headers,records):
        t=doc.add_table(rows=1,cols=len(headers));t.style='Table Grid';t.autofit=False
        weights=[column_weight(h) for h in headers]
        widths=[Cm(usable*w/sum(weights)) for w in weights]
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
    doc.add_paragraph('Prepared for '+context['project']+'. Automated documentary checks; legal sign-off still to be done.')
    markdown=['# '+draft['title'],'','Draft for review. Mechanical checks are not legal sign-off.','']
    for index,section in enumerate(draft['sections']):
        # Each letter of a series starts on its own page, so it can be sent as it stands.
        if LETTER.match(str(section.get('id',''))) and index:doc.add_page_break()
        doc.add_heading(section['title'],1);markdown+=['## '+section['title'],'',section['content'],'']
        # The viewer's text stays the source: no executable HTML, no command interpretation.
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
        doc.add_paragraph('Traceability: '+', '.join(section['ledgerIds']))
        for rid in section['ledgerIds']:
            row=by_id[rid]
            for side in ['ref','subj']:
                if row.get(side+'_quote'):
                    name=names.get(row.get(side+'_doc'),row.get(side+'_doc',''))
                    doc.add_paragraph(f"{rid} — {name}, {row.get(side+'_loc','location not stated')}: “{row[side+'_quote']}”",'Caption')
    doc.add_page_break();doc.add_heading('Review table and reservations',1)
    doc.add_paragraph('This annex sets out the findings on which the sections of the deliverable rest. The priorities and recommendations are proposals put to the lawyer.')
    # The concordance annex stays identical in Markdown and Word; it carries the ledger's precise values.
    markdown+=['## Executive summary — ledger of findings','Priority and recommendations — proposed priorities and next steps','']
    for r in rows:
        doc.add_heading(r['id']+' '+r['topic'],2)
        values=[['Status and priority',r.get('status','')+' · '+r.get('severity','')],['Reference',str(r.get('ref_value',''))],['Subject document',str(r.get('subj_value',''))],['Impact',r.get('impact','')],['Recommendation',r.get('recommendation','')]]
        table(['Field','Finding'],values)
        markdown+=['### '+r['id']+' '+r['topic']]+[f'{k}: {v}' for k,v in values]
    doc.add_heading('Documents and reading limits',1)
    for d in context['documents']:doc.add_paragraph(d['name']+' — '+(d.get('limitation') or 'Text extracted; completeness of reading to be checked.')+' — SHA256 '+d['sha256'])
    doc.add_paragraph('Skill cross-document-review — hash '+context['skillHash'])
    doc.save(out/'deliverable.docx');(out/'deliverable.md').write_text('\n'.join(markdown),encoding='utf-8')
    book=Workbook();book.remove(book.active)
    sheets=[('Findings',['ID','Topic','Status','Priority','Reference','Subject','Impact','Recommendation'],[[r.get(k,'') for k in ['id','topic','status','severity','ref_value','subj_value','impact','recommendation']] for r in rows]),
      ('Evidence',['Finding','Document','Location','Excerpt'],[[r['id'],names.get(r.get(s+'_doc'),r.get(s+'_doc','')),r.get(s+'_loc',''),r[s+'_quote']] for r in rows for s in ['ref','subj'] if r.get(s+'_quote')]),
      ('Sections',['ID','Title','Source findings'],[[s['id'],s['title'],', '.join(s['ledgerIds'])] for s in draft['sections']]),
      ('Documents',['Name','Hash','Limits'],[[d['name'],d['sha256'],d.get('limitation','Text extracted; full reading not attested.')] for d in context['documents']])]
    # The deliverable's own tables ship as sheets too: a contracts table or a cap table belongs in Excel.
    used={name.lower() for name,_,_ in sheets}
    for section in draft['sections']:
        if section.get('table'):
            sheets.append((sheet_name(section['title'] or section['id'],used),section['table']['headers'],section['table']['rows']))
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
            t=Table(displayName=f'Ledger{index}',ref=sheet.dimensions);t.tableStyleInfo=TableStyleInfo(name='TableStyleMedium2',showRowStripes=True);sheet.add_table(t)
    book.save(out/'tables.xlsx')
    print(f"{len(draft['sections'])} sections, {len(rows)} findings, kind {kind}. Word, Excel and Markdown generated.")

if __name__=='__main__':main()
