"""Bridge to the Windows Search index (SystemIndex). Windows has usually already read the text inside
Office files, PDFs and notes across the user profile, so this gives instant whole-computer recall
while MAT-AH's own reader is still working through the queue. Local only: an OLE DB query on this PC."""
import re
import threading
import time

_local = threading.local()
_state = {"ok": None, "error": None}


def _conn():
    con = getattr(_local, "con", None)
    if con is None:
        import pythoncom
        import win32com.client
        pythoncom.CoInitialize()
        con = win32com.client.Dispatch("ADODB.Connection")
        con.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
        _local.con = con
    return con


def available() -> bool:
    if _state["ok"] is None:
        try:
            _conn()
            _state["ok"] = True
        except Exception as e:  # pywin32 missing or the WSearch service is off
            _state.update(ok=False, error=str(e)[:200])
    return bool(_state["ok"])


def _q(s: str) -> str:
    return s.replace("'", "''")


def search(terms: list[str], scopes: list[str], limit: int = 50, timeout_s: float = 3.0) -> list[tuple[str, float]]:
    """Full-text search of file contents and properties under the given folders. Returns (path, rank)."""
    words = [re.sub(r"[^\w\-.,]", "", t) for t in terms]
    words = [w for w in words if len(w) >= 2][:12]
    if not words or not scopes or not available():
        return []
    scope_sql = " OR ".join(f"SCOPE='file:{_q(s.replace(chr(92), '/'))}'" for s in scopes)
    sql = (f"SELECT TOP {int(limit)} System.ItemPathDisplay, System.Search.Rank FROM SystemIndex "
           f"WHERE ({scope_sql}) AND FREETEXT('{_q(' '.join(words))}') "
           f"ORDER BY System.Search.Rank DESC")
    out: list[tuple[str, float]] = []
    try:
        import win32com.client
        rs = win32com.client.Dispatch("ADODB.Recordset")
        t0 = time.time()
        rs.Open(sql, _conn())
        while not rs.EOF and time.time() - t0 < timeout_s:
            path = rs.Fields.Item("System.ItemPathDisplay").Value
            rank = rs.Fields.Item("System.Search.Rank").Value or 0
            if path:
                out.append((str(path), float(rank)))
            rs.MoveNext()
        rs.Close()
    except Exception as e:
        _state["error"] = str(e)[:200]
    return out


def status() -> dict:
    available()
    return {"available": bool(_state["ok"]), "error": _state["error"]}
