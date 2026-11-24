"""Text from uploaded documents (from Growth-Validation main.py, used for evidence files and resumes). Type comes from
the file's contents, never from the browser's claimed type. Capped at 12,000 characters.

Slides (.pptx) and spreadsheets (.xlsx) were added 2026-11-23 for engineering students' evidence. Like .docx they are
zip files; their text is read with the standard library (zipfile plus a regex over the XML, no XML parser), reading at
most MAX_UNZIPPED bytes in total so a small "zip bomb" upload can't exhaust memory."""
import html
import io
import re
import zipfile

MAX_TEXT = 12_000
MAX_UNZIPPED = 20 * 1024 * 1024
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
TXT = "text/plain"
IMAGES = {b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg"}
_OFFICE = (("word/document.xml", DOCX), ("ppt/presentation.xml", PPTX), ("xl/workbook.xml", XLSX))


def _office_type(data: bytes) -> str | None:
    try:
        names = set(zipfile.ZipFile(io.BytesIO(data)).namelist())
    except zipfile.BadZipFile:
        return None
    return next((mime for part, mime in _OFFICE if part in names), None)


def sniff(data: bytes) -> str | None:
    if data[:5] == b"%PDF-":
        return PDF
    if data[:4] == b"PK\x03\x04":
        return _office_type(data)
    for magic, mime in IMAGES.items():
        if data.startswith(magic):
            return mime
    try:
        data[:4000].decode("utf-8")
        return TXT if b"\x00" not in data[:4000] else None
    except UnicodeDecodeError:
        return None


def _slide_number(name: str) -> int:
    m = re.search(r"(\d+)\.xml$", name)
    return int(m.group(1)) if m else 0


def _zip_text(data: bytes, parts: list[str], tag: str) -> str:
    """Text inside <tag>...</tag> elements of the given parts, in order, within the MAX_UNZIPPED budget."""
    pattern = re.compile(rf"<{tag}(?:\s[^>]*)?>([^<]*)</{tag}>")
    budget, out = MAX_UNZIPPED, []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in parts:
            with z.open(name) as f:
                xml = f.read(budget + 1)
            if len(xml) > budget:
                break
            budget -= len(xml)
            out.append(" ".join(html.unescape(t) for t in pattern.findall(xml.decode("utf-8", "replace")) if t.strip()))
            if sum(len(x) for x in out) > MAX_TEXT:
                break
    return "\n".join(x for x in out if x)


def _pptx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=_slide_number)
    return _zip_text(data, slides, "a:t")


def _xlsx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
    sheets = sorted((n for n in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)), key=_slide_number)
    shared = ["xl/sharedStrings.xml"] if "xl/sharedStrings.xml" in names else []
    # Shared strings hold most cell text; inline strings (<is><t>) live in the sheets themselves.
    return _zip_text(data, shared + sheets, "t")


def extract_text(data: bytes, mime: str) -> str:
    if mime == PDF:
        from pypdf import PdfReader

        text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages[:15])
    elif mime == DOCX:
        import docx

        text = "\n".join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs)
    elif mime == PPTX:
        text = _pptx_text(data)
    elif mime == XLSX:
        text = _xlsx_text(data)
    elif mime == TXT:
        text = data.decode("utf-8", errors="replace")
    else:
        return ""
    return text[:MAX_TEXT].strip()
