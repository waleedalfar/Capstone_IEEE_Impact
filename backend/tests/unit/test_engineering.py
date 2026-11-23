"""Engineering students of any discipline: slides and spreadsheets as evidence, the career catalog, and resume import
keeping an unlisted career as Other (D-08, D-55)."""
import io
import json
import zipfile

import docx

from app.modules.growth import catalog
from app.modules.profile import resume
from app.platform.textextract import DOCX, MAX_TEXT, PPTX, XLSX, extract_text, sniff
from app.policies import loader


def _zip(parts: dict[str, str], compression=zipfile.ZIP_DEFLATED) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        for name, body in parts.items():
            z.writestr(name, body)
    return buf.getvalue()


def _slide(*runs: str) -> str:
    return "<p:sld><p:txBody>" + "".join(f'<a:p><a:r><a:rPr lang="en-US"/><a:t>{r}</a:t></a:r></a:p>' for r in runs) + "</p:txBody></p:sld>"


def make_pptx() -> bytes:
    # slide10 sorts after slide2: slides are read in number order, not name order
    return _zip({"ppt/presentation.xml": "<p:presentation/>", "ppt/slides/slide1.xml": _slide("Drone frame design review"),
                 "ppt/slides/slide2.xml": _slide("FEA: max stress 41 MPa", "Safety factor 2.3 &amp; mass 310 g"),
                 "ppt/slides/slide10.xml": _slide("Next: flight test")})


def make_xlsx() -> bytes:
    return _zip({"xl/workbook.xml": "<workbook/>",
                 "xl/sharedStrings.xml": '<sst><si><t>Load (N)</t></si><si><t xml:space="preserve">Deflection (mm)</t></si></sst>',
                 "xl/worksheets/sheet1.xml": '<worksheet><c t="inlineStr"><is><t>Beam test, run 3</t></is></c></worksheet>'})


def test_slides_and_spreadsheets_are_recognised_and_read():
    pptx, xlsx = make_pptx(), make_xlsx()
    assert sniff(pptx) == PPTX and sniff(xlsx) == XLSX
    text = extract_text(pptx, PPTX)
    assert text.splitlines() == ["Drone frame design review", "FEA: max stress 41 MPa Safety factor 2.3 & mass 310 g", "Next: flight test"]
    assert extract_text(xlsx, XLSX) == "Load (N) Deflection (mm)\nBeam test, run 3"


def test_word_still_word_and_other_zips_rejected():
    d = docx.Document()
    d.add_paragraph("Lab report: tensile test")
    buf = io.BytesIO()
    d.save(buf)
    assert sniff(buf.getvalue()) == DOCX and "tensile test" in extract_text(buf.getvalue(), DOCX)
    assert sniff(_zip({"notes/readme.txt": "hi"})) is None       # a zip that isn't an Office file
    assert sniff(b"PK\x03\x04 not really a zip") is None


def test_huge_unzipped_slide_is_cut_off():
    # 30 MB of text compresses to a few KB; reading stops at the unzipped budget instead of loading it all.
    bomb = _zip({"ppt/presentation.xml": "<p:presentation/>", "ppt/slides/slide1.xml": _slide("x" * (30 * 1024 * 1024))})
    assert len(bomb) < 200_000
    assert len(extract_text(bomb, PPTX)) <= MAX_TEXT


def test_catalog_careers_are_well_formed():
    careers = catalog.load()["careers"]
    ids = [c["id"] for c in careers]
    assert len(ids) == len(set(ids))
    for c in careers:
        skill_ids = [s["id"] for s in c["skills"]]
        assert c["name"] and len(skill_ids) == len(set(skill_ids)) and any(s["core"] for s in c["skills"]), c["id"]
    for eng in ("mechanical_engineer", "electrical_engineer", "embedded_engineer", "civil_engineer", "chemical_engineer",
                "biomedical_engineer", "industrial_engineer", "aerospace_engineer"):
        assert eng in ids


def _draft(**over) -> str:
    base = {"displayName": "Noor", "skills": ["MATLAB"], "interests": [], "strengths": [], "growthAreas": [],
            "contributions": [], "targetCareerId": "", "targetCareerOther": "Nuclear Engineer"}
    return json.dumps(base | over)


def test_resume_keeps_an_unlisted_career_as_other():
    assert resume.parse(_draft())["targetCareerOther"] == "Nuclear Engineer"
    listed = resume.parse(_draft(targetCareerId="mechanical_engineer"))
    assert listed["targetCareerId"] == "mechanical_engineer" and listed["targetCareerOther"] is None
    with loader.override(CAREER_OTHER=False):
        assert resume.parse(_draft())["targetCareerOther"] is None
