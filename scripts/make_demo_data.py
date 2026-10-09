"""Generate the synthetic MAT-AH demo folder. Every file is fake and marked SAMPLE.

School: "Bagong Liwayway State College" (made up). E-wallet: "PayLokal" (made up).
Usage:  python scripts/make_demo_data.py [--out demo_data/files] [--reset]
Writes demo_data/manifest.json: each file with a probe word that only its content contains.
"""
import argparse
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

import pymupdf
from docx import Document
from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
SCHOOL = "Bagong Liwayway State College"
manifest: list[dict] = []


def font(size, bold=False):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        p = FONTS / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def stamp(path: Path, when: str):
    ts = datetime.fromisoformat(when).timestamp()
    os.utime(path, (ts, ts))


def record(path: Path, probe: str, when: str, **extra):
    stamp(path, when)
    manifest.append({"path": str(path.relative_to(OUT)).replace("\\", "/"), "probe": probe, **extra})


# ---------------- PDFs ----------------
def pdf(path: Path, pages: list[str]):
    doc = pymupdf.open()
    for body in pages:
        page = doc.new_page(width=595, height=842)
        page.insert_textbox(pymupdf.Rect(56, 56, 540, 800), body, fontsize=11.5, fontname="helv", lineheight=1.35)
        page.insert_text((56, 820), "SAMPLE — synthetic demo document, not a real record", fontsize=8, fontname="helv",
                         color=(0.5, 0.5, 0.5))
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(path)


def make_pdfs():
    s = OUT / "School"
    pdf(s / "Enrollment_Announcement.pdf", [
        f"{SCHOOL}\nOffice of the University Registrar\n\nANNOUNCEMENT: Enrollment for the Second Semester, "
        "Academic Year 2026-2027\n\nTo all continuing students:\n\nThe Office of the Registrar announces the schedule "
        "of enrollment for the Second Semester. Please read all pages of this announcement carefully. Online "
        "pre-advising starts on October 13, 2026 through the student portal. Advisers will post the approved list "
        "of subjects per block section.\n\nPaalala: Siguraduhing kumpleto ang inyong requirements bago pumunta sa "
        "Registrar.",
        "ENROLLMENT SCHEDULE AND DEADLINE\n\nRegular enrollment: October 15 to October 24, 2026.\n\n"
        "The enrollment deadline is October 24, 2026 (Saturday), 5:00 PM. No late enrollment will be accepted "
        "after this date except for students with approved petitions.\n\nAng huling araw ng enrollment ay "
        "October 24, 2026. Ang late enrollment fee ay PHP 500.00 para sa may approved petition.\n\n"
        "Downpayment: a minimum downpayment of PHP 3,000.00 is required to be officially enrolled.",
        "REQUIREMENTS AND CONTACT\n\nBring the following: printed Certificate of Registration from last semester, "
        "clearance from the Library and Student Affairs, and proof of downpayment.\n\nFor concerns, email the "
        "Registrar's helpdesk or visit Window 3, Administration Building, Monday to Friday, 8:00 AM to 5:00 PM.\n\n"
        "Signed: Office of the University Registrar",
    ])
    record(s / "Enrollment_Announcement.pdf", "pre-advising", "2026-10-02T09:12:00", kind="pdf", page_of_probe=1,
           facts={"deadline": "October 24, 2026", "deadline_page": 2})

    pdf(s / "Tuition_Receipt_1stSem.pdf", [
        f"{SCHOOL}\nCashier's Office — OFFICIAL RECEIPT (SAMPLE)\n\nReceipt No.: SAMPLE-2026-08-04417\n"
        "Date: August 8, 2026\nStudent: Juan Dela Cruz (SAMPLE)\nProgram: BS Computer Science, 3rd Year\n\n"
        "Particulars: Tuition and miscellaneous fees, First Semester AY 2026-2027\n\n"
        "Amount paid: PHP 18,450.00\nMode of payment: PayLokal e-wallet\n\nThis receipt is computer generated. SAMPLE.",
    ])
    record(s / "Tuition_Receipt_1stSem.pdf", "cashier", "2026-08-08T15:30:00", kind="pdf",
           facts={"amount": "18,450.00"})

    pdf(OUT / "Misc" / "Club_Newsletter_SAMPLE.pdf", [
        "The Byte Club Newsletter (SAMPLE)\n\nThis month: our hackathon team placed second in the regional "
        "robotics fair. Members built a line-following rover with an ultrasonic sensor. Next meeting: snacks "
        "and a workshop on soldering basics.",
        "Member spotlight: the treasurer explains how the club fund grew from bake sales and a mini concert.",
    ])
    record(OUT / "Misc" / "Club_Newsletter_SAMPLE.pdf", "soldering", "2026-06-20T10:00:00", kind="pdf")

    pdf(OUT / "Misc" / "Dormitory_Rules_SAMPLE.pdf", [
        "Dormitory House Rules (SAMPLE)\n\nCurfew is 10:00 PM on weekdays. Visitors are allowed in the lobby "
        "only. Electric kettles are not allowed in rooms. Laundry area opens at 6:00 AM.",
    ])
    record(OUT / "Misc" / "Dormitory_Rules_SAMPLE.pdf", "kettles", "2025-12-03T08:00:00", kind="pdf")


# ---------------- screenshots ----------------
def phone_shot(path: Path, title: str, lines: list[tuple[str, int, bool]], bg="#ffffff", bar="#1f6feb"):
    W, H = 720, 1280
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 64], fill="#111111")
    d.text((24, 16), "9:41", font=font(28, True), fill="white")
    d.text((W - 150, 16), "LTE 82%", font=font(26), fill="white")
    d.rectangle([0, 64, W, 160], fill=bar)
    d.text((32, 88), title, font=font(40, True), fill="white")
    y = 200
    for text, size, bold in lines:
        if text == "---":
            d.line([32, y + 10, W - 32, y + 10], fill="#d0d7de", width=2)
            y += 36
            continue
        d.text((40, y), text, font=font(size, bold), fill="#1b1f24")
        y += int(size * 1.6)
    d.text((40, H - 70), "SAMPLE — synthetic screenshot", font=font(24), fill="#8c959f")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def chat_shot(path: Path, msgs: list[tuple[str, str, bool]]):
    W, H = 720, 1280
    im = Image.new("RGB", (W, H), "#eef1f5")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 140], fill="#ffffff")
    d.text((32, 50), "BSCS 3-B Barkada (SAMPLE)", font=font(36, True), fill="#111")
    y = 180
    f = font(30)
    for who, text, me in msgs:
        tw = min(560, int(d.textlength(text, font=f)) + 40)
        x0 = W - tw - 30 if me else 30
        d.text((x0 + 4, y), who, font=font(22, True), fill="#57606a")
        y += 32
        d.rounded_rectangle([x0, y, x0 + tw, y + 64], radius=24, fill="#1f6feb" if me else "#ffffff")
        d.text((x0 + 20, y + 12), text, font=f, fill="white" if me else "#111")
        y += 96
    d.text((40, H - 70), "SAMPLE — synthetic screenshot", font=font(24), fill="#8c959f")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def beach_picture(path: Path):
    W, H = 1024, 768
    im = Image.new("RGB", (W, H), "#87ceeb")
    d = ImageDraw.Draw(im)
    for i in range(300):  # sky gradient
        c = (135 + i // 6, 206 + i // 20, 235)
        d.line([0, i, W, i], fill=c)
    d.ellipse([760, 70, 900, 210], fill="#ffd34d")
    d.rectangle([0, 360, W, 520], fill="#1e88c8")
    for x in range(0, W, 60):
        d.arc([x, 350, x + 60, 380], 0, 180, fill="#e3f4ff", width=3)
    d.polygon([(0, 500), (W, 470), (W, H), (0, H)], fill="#f1d9a7")
    d.rectangle([180, 380, 196, 620], fill="#7a4e2d")
    for dx, dy in [(-110, -30), (110, -30), (-80, 30), (80, 30), (0, -60)]:
        d.ellipse([188 + dx - 70, 360 + dy - 18, 188 + dx + 70, 360 + dy + 18], fill="#2e8b3e")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, quality=92)


def make_screenshots():
    s = OUT / "Pictures" / "Screenshots"
    p = s / "Screenshot_20260928_142233.png"
    phone_shot(p, "Registrar Advisory", [
        ("ENROLLMENT REQUIREMENTS", 40, True), ("2nd Semester AY 2026-2027", 30, False), ("---", 0, False),
        ("1. Certificate of Registration (last sem)", 30, False), ("2. Library clearance", 30, False),
        ("3. Student Affairs clearance", 30, False), ("4. Proof of downpayment", 30, False),
        ("5. Updated 2x2 ID picture", 30, False), ("---", 0, False),
        ("Submit at Window 3, Admin Building", 28, False), (SCHOOL, 26, False)])
    record(p, "clearance", "2026-09-28T14:22:33", kind="image")

    p = s / "Screenshot_20260811_091502.png"
    phone_shot(p, "PayLokal", [
        ("Payment Successful", 44, True), ("---", 0, False), ("Amount", 28, False), ("PHP 1,500.00", 52, True),
        ("Paid to: BLSC Student Council", 30, False), ("Ref No. SAMPLE 7781 2209 4411", 28, False),
        ("Aug 11, 2026 9:15 AM", 28, False), ("Purpose: org membership fee", 28, False)], bar="#0a8f5a")
    record(p, "membership", "2026-08-11T09:15:02", kind="image", facts={"amount": "1,500.00"})

    p = s / "Screenshot_20251214_200118.png"
    phone_shot(p, "PayLokal", [
        ("Payment Successful", 44, True), ("---", 0, False), ("Amount", 28, False), ("PHP 3,275.50", 52, True),
        ("Paid to: Kusina ni Aling Nena (SAMPLE)", 30, False), ("Ref No. SAMPLE 5520 1934 0087", 28, False),
        ("Dec 14, 2025 8:01 PM", 28, False), ("Purpose: Christmas party food", 28, False)], bar="#0a8f5a")
    record(p, "christmas", "2025-12-14T20:01:18", kind="image", facts={"amount": "3,275.50"})

    p = s / "Screenshot_20260905_073010.png"
    phone_shot(p, "My Class Schedule", [
        ("BSCS 3-B  First Semester", 32, True), ("---", 0, False),
        ("MON  CCS 3101 Data Structures  8:00-9:30", 26, False),
        ("MON  CCS 3105 Operating Systems  10:00-11:30", 26, False),
        ("TUE  GEC 107 Ethics  1:00-2:30", 26, False), ("WED  CCS 3101 Lab  8:00-11:00", 26, False),
        ("THU  CCS 3110 Software Engineering  9:00-10:30", 26, False), ("FRI  PATHFIT 3  3:00-5:00", 26, False),
        ("Room: CCS Bldg 304", 26, False)], bar="#7a3cc2")
    record(p, "pathfit", "2026-09-05T07:30:10", kind="image")

    p = s / "Screenshot_20261003_221544.png"
    chat_shot(p, [
        ("Bea", "Guys may thesis meeting ba bukas?", False),
        ("Migs", "Oo 3pm sa library, dala kayo laptop", False),
        ("Me", "Sige! Ako na magdadala ng extension cord", True),
        ("Bea", "Wag kalimutan yung consent forms ha", False),
        ("Migs", "Noted. Kita kits sa library", False)])
    record(p, "extension", "2026-10-03T22:15:44", kind="image")

    p = OUT / "Pictures" / "IMG_20260412_101500.jpg"
    beach_picture(p)
    record(p, None, "2026-04-12T10:15:00", kind="image", note="beach photo, no text (CLIP demo)")

    p = OUT / "Pictures" / "Weekly_Steps_Chart.png"
    im = Image.new("RGB", (900, 600), "white")
    d = ImageDraw.Draw(im)
    d.text((40, 30), "Weekly Steps Tracker (SAMPLE)", font=font(40, True), fill="#111")
    for i, (day, v) in enumerate(zip("MTWTFSS", [6, 9, 4, 8, 11, 3, 7])):
        d.rectangle([80 + i * 110, 520 - v * 35, 150 + i * 110, 520], fill="#1f6feb")
        d.text((100 + i * 110, 530), day, font=font(28), fill="#333")
    im.save(p)
    record(p, "tracker", "2026-07-01T18:00:00", kind="image")


# ---------------- DOCX / PPTX ----------------
def make_office():
    n = OUT / "Notes"
    n.mkdir(parents=True, exist_ok=True)
    d = Document()
    d.add_heading("Thesis Meeting Notes (SAMPLE)", 1)
    d.add_paragraph("Date: October 4, 2026. Venue: library discussion room 2.")
    d.add_paragraph("Topic: offline file search for students. Adviser asked us to add an evaluation with at least "
                    "30 test queries and to compare keyword search versus hybrid search.")
    d.add_paragraph("Action items: Bea drafts the consent forms; Migs prepares the survey questionnaire; "
                    "I build the prototype and the demo dataset.")
    d.add_paragraph("Next meeting: October 11, 2026 at 3:00 PM.")
    d.save(n / "Thesis_Meeting_Notes.docx")
    record(n / "Thesis_Meeting_Notes.docx", "questionnaire", "2026-10-04T17:40:00", kind="docx")

    d = Document()
    d.add_heading("Org Budget Notes — Byte Club (SAMPLE)", 1)
    d.add_paragraph("Starting fund: PHP 12,000.00 from the bake sale and the mini concert.")
    t = d.add_table(rows=1, cols=2)
    t.rows[0].cells[0].text, t.rows[0].cells[1].text = "Item", "Amount"
    for item, amt in [("Hackathon snacks", "PHP 2,400.00"), ("Arduino kits", "PHP 5,850.00"),
                      ("Printing of tarpaulin", "PHP 650.00")]:
        r = t.add_row().cells
        r[0].text, r[1].text = item, amt
    d.add_paragraph("Remaining after purchases: PHP 3,100.00. Treasurer to post the liquidation report.")
    d.save(n / "Org_Budget_Notes.docx")
    record(n / "Org_Budget_Notes.docx", "liquidation", "2026-09-15T12:00:00", kind="docx")

    d = Document()
    d.add_heading("Christmas Party Plan (SAMPLE)", 1)
    d.add_paragraph("Monito-monita budget is PHP 300. Venue: function hall. Potluck: everyone brings one dish.")
    d.add_paragraph("Program: games, exchange gifts, videoke until 9 PM.")
    d.save(OUT / "Misc" / "Christmas_Party_Plan.docx")
    record(OUT / "Misc" / "Christmas_Party_Plan.docx", "monito", "2025-12-01T19:00:00", kind="docx")

    l = OUT / "Lectures"
    l.mkdir(parents=True, exist_ok=True)
    prs = Presentation()
    slides = [
        ("CCS 3101 Data Structures — Lecture 3 (SAMPLE)", "Stacks and Queues"),
        ("What is a stack?", "Last-in, first-out (LIFO). Operations: push, pop, peek. Used for undo and the call stack."),
        ("What is a queue?", "First-in, first-out (FIFO). Operations: enqueue, dequeue. Used for printer jobs and BFS."),
        ("Circular buffer", "A queue stored in a fixed array; head and tail wrap around with modulo arithmetic."),
    ]
    for title, body in slides:
        s = prs.slides.add_slide(prs.slide_layouts[1])
        s.shapes.title.text = title
        s.placeholders[1].text = body
    prs.save(l / "CCS3101_Lecture3_Stacks_Queues.pptx")
    record(l / "CCS3101_Lecture3_Stacks_Queues.pptx", "modulo", "2026-09-10T08:00:00", kind="pptx", slide_of_probe=4)

    prs = Presentation()
    for title, body in [("Byte Club Orientation (SAMPLE)", "Welcome, new members!"),
                        ("Committees", "Events, Finance, Tech, and Publicity. Sign up with the secretary.")]:
        s = prs.slides.add_slide(prs.slide_layouts[1])
        s.shapes.title.text = title
        s.placeholders[1].text = body
    prs.save(OUT / "Misc" / "Org_Orientation.pptx")
    record(OUT / "Misc" / "Org_Orientation.pptx", "publicity", "2026-06-25T13:00:00", kind="pptx")


# ---------------- text noise ----------------
NOISE = {
    "Recipe_Chicken_Adobo.txt": ("Chicken adobo (SAMPLE): soy sauce, vinegar, garlic, peppercorns, bay leaves. "
                                 "Simmer for 40 minutes.", "peppercorns", "2025-11-02T18:00:00"),
    "Baguio_Trip_Itinerary.md": ("# Baguio trip (SAMPLE)\nDay 1: Burnham Park, strawberry farm.\nDay 2: Mines View, "
                                 "Session Road.", "strawberry", "2026-03-20T09:00:00"),
    "Books_To_Read.txt": ("Noli Me Tangere; El Filibusterismo; Clean Code; The Pragmatic Programmer", "filibusterismo",
                          "2026-01-05T21:00:00"),
    "Grocery_List.txt": ("eggs, rice 5kg, pandesal, coffee, toothpaste, sardines", "pandesal", "2026-09-30T07:00:00"),
    "Game_Night_Notes.md": ("Game night scores: Uno, Monopoly Deal, Codenames. Winner gets free milk tea.", "codenames",
                            "2026-05-16T22:00:00"),
    "Wifi_Troubleshooting.txt": ("Restart the router, check the LOS light, call the ISP hotline if red.", "router",
                                 "2026-02-11T20:00:00"),
    "Gym_Routine.txt": ("Push day: bench press, overhead press, dips. Pull day: rows, pull-ups.", "dips",
                        "2026-07-08T06:00:00"),
    "Movie_Watchlist.md": ("Heneral Luna, Goyo, Four Sisters and a Wedding, Hello Love Goodbye", "goyo",
                           "2026-04-01T20:00:00"),
    "Plant_Care.txt": ("Water the pothos weekly; the snake plant every two weeks.", "pothos", "2026-06-02T08:00:00"),
    "Bike_Maintenance.txt": ("Lube the chain every 200 km and check tire pressure.", "chain", "2026-08-21T17:00:00"),
    "Song_Lyrics_Draft.txt": ("Verse 1: sa ilalim ng buwan, tayo'y nag-usap...", "buwan", "2026-02-14T23:00:00"),
    "Laptop_Specs.txt": ("Ryzen 5, 16GB RAM, RTX 2050, 512GB SSD", "ryzen", "2026-01-20T10:00:00"),
}


def make_noise():
    m = OUT / "Misc"
    m.mkdir(parents=True, exist_ok=True)
    for name, (text, probe, when) in NOISE.items():
        (m / name).write_text(text + "\n\nSAMPLE file for the MAT-AH demo.\n", encoding="utf-8")
        record(m / name, probe, when, kind="text")


# ---------------- Downloads_demo for Linis ----------------
def make_downloads():
    dl = OUT / "Downloads_demo"
    dl.mkdir(parents=True, exist_ok=True)
    pdf(dl / "Course_Syllabus_CCS3110.pdf", ["CCS 3110 Software Engineering Syllabus (SAMPLE)\n\nGrading: "
                                             "exams 40%, project 40%, quizzes 20%. Waterfall, agile and scrum."])
    shutil.copy2(dl / "Course_Syllabus_CCS3110.pdf", dl / "Course_Syllabus_CCS3110 (1).pdf")
    phone_shot(dl / "id_picture_2x2.png", "ID Photo", [("SAMPLE ID PICTURE", 40, True), ("2x2 white background", 30, False)])
    shutil.copy2(dl / "id_picture_2x2.png", dl / "id_picture_2x2 - Copy.png")
    (dl / "consent_form_template.txt").write_text("Research consent form template (SAMPLE). I agree to take part "
                                                  "in the thesis survey voluntarily.\n", encoding="utf-8")
    shutil.copy2(dl / "consent_form_template.txt", dl / "consent_form_template (2).txt")
    (dl / "untitled.txt").write_bytes(b"")
    (dl / "New Text Document.txt").write_bytes(b"")
    (dl / "New folder").mkdir(exist_ok=True)
    (dl / "extracted_zip").mkdir(exist_ok=True)
    for f in dl.iterdir():
        if f.is_file():
            stamp(f, "2026-09-25T12:00:00")
    for f, probe in [("Course_Syllabus_CCS3110.pdf", "scrum"), ("id_picture_2x2.png", None),
                     ("consent_form_template.txt", "voluntarily")]:
        manifest.append({"path": f"Downloads_demo/{f}", "probe": probe, "kind": "dup-original"})
    LINIS = {
        "duplicates": [["Course_Syllabus_CCS3110.pdf", "Course_Syllabus_CCS3110 (1).pdf"],
                       ["id_picture_2x2.png", "id_picture_2x2 - Copy.png"],
                       ["consent_form_template.txt", "consent_form_template (2).txt"]],
        "zero_byte": ["New Text Document.txt", "untitled.txt"],
        "empty_folders": ["New folder", "extracted_zip"],
    }
    return LINIS


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "demo_data" / "My Files"))
    ap.add_argument("--reset", action="store_true", help="delete the output folder first")
    a = ap.parse_args()
    OUT = Path(a.out).resolve()
    if OUT.exists():
        if not a.reset:
            raise SystemExit(f"{OUT} exists; pass --reset to regenerate")
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    make_pdfs()
    make_screenshots()
    make_office()
    make_noise()
    linis = make_downloads()
    (ROOT / "demo_data" / "manifest.json").write_text(
        json.dumps({"root": str(OUT), "files": manifest, "linis": linis}, indent=2), encoding="utf-8")
    print(f"Wrote {sum(1 for _ in OUT.rglob('*') if _.is_file())} files to {OUT}")
