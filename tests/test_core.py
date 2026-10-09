"""Core safety and correctness checks. Run: .venv\\Scripts\\python -m pytest -q"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def demo(tmp_path_factory):
    """Fresh synthetic demo folder + DB, indexed keyword-only (no Ollama needed)."""
    base = tmp_path_factory.mktemp("matah")
    out = base / "files"
    subprocess.run([sys.executable, str(ROOT / "scripts" / "make_demo_data.py"), "--out", str(out)], check=True)
    manifest = json.loads((ROOT / "demo_data" / "manifest.json").read_text(encoding="utf-8"))
    os.environ["MATAH_DB"] = str(base / "test.db")
    from backend import folders, llm, scan, visual, winsearch
    from backend.index import connect
    llm.embed_available = lambda: False  # keyword path only: deterministic and offline
    llm.available = lambda: False
    llm.vision_model = lambda: None
    visual.ready = lambda: False
    visual.installed = lambda: False  # no CLIP load in unit tests
    winsearch.available = lambda: False
    con = connect(base / "test.db")
    folders.add_root(con, str(out))
    scan.run(con)
    return {"con": con, "root": out, "manifest": manifest}


def tree_hash(root: Path) -> dict:
    out = {}
    for p in sorted(root.rglob("*")):
        rel = str(p.relative_to(root))
        out[rel] = hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else "<dir>"
    return out


# ---------- path guard ----------
def test_guard_rejects_outside(demo):
    from backend.folders import OutsideRoots, guard
    con, root = demo["con"], demo["root"]
    assert guard(con, root / "School" / "Enrollment_Announcement.pdf")
    for bad in [root / ".." / "secret.txt", Path("C:/Windows/System32/drivers/etc/hosts"), str(root) + "_evil/x"]:
        with pytest.raises(OutsideRoots):
            guard(con, bad)


# ---------- index: every demo file is findable by a word inside it ----------
def test_every_file_findable_by_content(demo):
    from backend.hanap import search
    con = demo["con"]
    for f in demo["manifest"]["files"]:
        if not f.get("probe"):
            continue
        hits = search(con, f["probe"], mode="keyword", use_llm=False)["hits"]
        names = [Path(h["file"]["path"]).name for h in hits[:3]]
        assert Path(f["path"]).name in names, f"{f['probe']!r} -> {names}"


def test_deadline_on_page_2(demo):
    from backend.hanap import search
    hits = search(demo["con"], "enrollment deadline", mode="keyword", use_llm=False)["hits"]
    top = hits[0]
    assert top["file"]["name"] == "Enrollment_Announcement.pdf" and top["locator"]["page"] == 2


# ---------- parser ----------
def test_parser_taglish():
    from backend.hanap import parse
    now = datetime(2026, 10, 10)
    p = parse("yung screenshot ng enrollment requirements", now, use_llm=False)
    assert p["kinds"] == ["image"] and "enrollment" in p["terms"] and "yung" not in p["terms"]
    p = parse("resibo na ₱1,500 nung December", now, use_llm=False)
    assert p["amounts"] == [1500.0] and p["date_label"] == "December 2025" and "resibo" in p["terms"]
    assert parse("bayad 1.5k", now, use_llm=False)["amounts"] == [1500.0]
    assert parse("slides kahapon", now, use_llm=False)["date_label"] == "yesterday"
    assert parse("may assignment ba", now, use_llm=False)["date"] is None  # 'may' is not May


# ---------- grounding verifier ----------
SRC = [{"text": "The enrollment deadline is October 24, 2026, 5:00 PM. Downpayment PHP 3,000.00.", "locator": {"page": 2},
        "file": {"name": "a.pdf"}},
       {"text": "Amount PHP 3.275.50 paid to Kusina", "locator": {}, "file": {"name": "b.png"}}]


def test_verifier_accepts_grounded():
    from backend.sagot import verify
    ok, why = verify("Ang deadline ay October 24, 2026 [1]. Downpayment ay ₱3,000 [1].", SRC)
    assert ok, why
    assert verify("You paid PHP 3,275.50 [2].", SRC)[0]  # OCR wrote 3.275.50


def test_verifier_rejects_invented_and_bad_citation():
    from backend.sagot import verify
    assert not verify("The deadline is October 25, 2026 [1].", SRC)[0]
    assert not verify("Downpayment is PHP 3,500.00 [1].", SRC)[0]
    assert not verify("The deadline is October 24, 2026 [7].", SRC)[0]
    assert not verify("The deadline is October 24, 2026.", SRC)[0]
    assert not verify("You paid PHP 3,275.50 [1].", SRC)[0]  # right number, wrong source


# ---------- Linis ----------
def test_linis_matches_planted(demo):
    from backend.linis import scan
    expected = demo["manifest"]["linis"]
    rep = scan(demo["con"], subpath=str(demo["root"] / "Downloads_demo"))
    got_dups = sorted(sorted([g["keep"]["name"]] + [e["name"] for e in g["extra"]]) for g in rep["duplicates"])
    assert got_dups == sorted(sorted(x) for x in expected["duplicates"])
    assert sorted(z["name"] for z in rep["zero_byte"]) == sorted(expected["zero_byte"])
    assert sorted(e["name"] for e in rep["empty_folders"]) == sorted(expected["empty_folders"])


# ---------- Kilos ----------
def test_kilos_decline_then_approve_undo(demo):
    from backend import kilos
    con, root = demo["con"], demo["root"]
    before = tree_hash(root)
    p = kilos.propose(con, "organize my enrollment documents")
    assert p["status"] == "pending" and any(o["op"] == "move" for o in p["plan"]["ops"])
    kilos.decline(con, p["id"])
    assert tree_hash(root) == before, "NO must change nothing"

    p = kilos.propose(con, "organize my enrollment documents")
    done = kilos.approve(con, p["id"])
    moved = [o for o in done["log"] if o["op"] == "move"]
    assert moved and all(o["status"] == "done" for o in moved)
    assert all(Path(o["dst"]).exists() and not Path(o["src"]).exists() for o in moved)
    # moved files stay findable at their new path
    row = con.execute("SELECT path FROM files WHERE path=?", (moved[0]["dst"],)).fetchone()
    assert row is not None
    kilos.undo(con, p["id"])
    assert tree_hash(root) == before, "Undo must restore every file"


def test_kilos_rejects_unknown_ids(demo, monkeypatch):
    from backend import kilos, llm
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "chat_model", lambda: "fake")
    monkeypatch.setattr(llm, "chat_json", lambda *a, **k: {"folder_name": "../../Evil", "reason": "x",
                                                           "file_ids": [999999, *range(1, 3)]})
    p = kilos.propose(demo["con"], "organize enrollment")
    assert 999999 in p["plan"]["rejected_ids"]
    dest = Path(p["plan"]["folder"])
    assert str(demo["root"]) in str(dest) and ".." not in dest.name
    kilos.decline(demo["con"], p["id"])


def test_verifier_allows_numbers_from_the_question():
    from backend.sagot import verify
    assert verify("Chapter 1 says the deadline is October 24, 2026 [1].", SRC, "Ano ang chapter 1?")[0]
    assert not verify("Chapter 2 says the deadline is October 24, 2026 [1].", SRC, "Ano ang chapter 1?")[0]


def test_llm_config_validates_saves_and_picks_models(tmp_path, monkeypatch):
    from backend import llm
    monkeypatch.setattr(llm, "CONFIG_PATH", tmp_path / "llm.json")
    monkeypatch.setattr(llm, "_cfg", dict(llm.DEFAULTS))
    monkeypatch.setattr(llm, "_refresh", lambda force=False: None)
    monkeypatch.setitem(llm._state, "models", ["qwen3:8b", "llava:7b", "gpt-oss:120b-cloud"])
    for bad in ({"host": "not a url"}, {"chat_model": "gpt-oss:120b-cloud"}, {"num_ctx": 100},
                {"keep_alive": "forever"}, {"temperature": 1}):
        with pytest.raises(ValueError):
            llm.set_config(bad)
    assert llm.chat_model() == "qwen3:8b"  # auto
    llm.set_config({"chat_model": "llava:7b", "num_ctx": 4096, "keep_alive": "-1", "host": "http://127.0.0.1:11434/"})
    assert llm.chat_model() == "llava:7b"
    assert llm._opts(0.1)["num_ctx"] == 4096 and llm._keep_alive() == -1
    saved = json.loads((tmp_path / "llm.json").read_text(encoding="utf-8"))
    assert saved["chat_model"] == "llava:7b" and saved["host"] == "http://127.0.0.1:11434"
    llm.set_config({"chat_model": "missing:1b"})
    assert llm.chat_model() is None  # a pinned model that isn't installed is not silently swapped
