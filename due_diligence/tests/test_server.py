import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from due_diligence.server import publish

class PublishTests(unittest.TestCase):
    def test_failed_export_does_not_replace_previous_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); room=root/'pieces'; room.mkdir(); out=root/'output'; out.mkdir()
            (out/'rapport.docx').write_bytes(b'previous report')
            case=dict(title='Audit',client='Client',scope='Test',as_of='2025-01-08',findings=[])
            with patch('due_diligence.server.export_office',side_effect=RuntimeError('generation failed')):
                with self.assertRaises(RuntimeError): publish(room,case,out)
            self.assertEqual((out/'rapport.docx').read_bytes(),b'previous report')

    def test_empty_mission_stays_draft_and_exports_are_consistent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); room=root/'pieces'; room.mkdir(); out=root/'output'
            case=dict(title='Audit',client='Client',scope='Test',as_of='2025-01-08',findings=[])
            data=publish(room,case,out)
            self.assertTrue(data['draft'])
            self.assertTrue(data['office_exports'])
            self.assertEqual({p.name for p in out.iterdir()}, {'rapport.docx','tableaux.xlsx','revue.html','review.json'})
            self.assertEqual(json.loads((out/'review.json').read_text())['generated_at'],data['generated_at'])
