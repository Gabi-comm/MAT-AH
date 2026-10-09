/*
  Review and approval for any Kilos proposal (organize moves, or Linis
  cleanup sent to the Recycle Bin). Nothing changes on disk until the user
  confirms in the dialog; success is shown only from the backend's reply.
*/
import { useMemo, useRef, useState } from "react";
import { Dialog } from "../../components/dialogs/Dialog";
import { Notice, useToast } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useIris } from "../../mascot/IrisContext";
import { useBackend } from "../../services/BackendContext";
import { folderOf } from "../../services/normalize";
import type { PlanOp, Proposal } from "../../services/types";

const baseName = (p?: string) => (p ? p.split(/[\\/]/).pop() ?? p : "");

export function ProposalReview({ proposal, onChange }: { proposal: Proposal; onChange: (p: Proposal) => void }) {
  const backend = useBackend();
  const { begin, finish, send } = useIris();
  const toast = useToast();
  const plan = proposal.plan;
  const selectable = plan.ops.filter((o) => o.op !== "mkdir");
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(selectable.map((o) => o.i)));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<null | "approve" | "decline" | "undo">(null);
  const [err, setErr] = useState<string | null>(null);
  const noRef = useRef<HTMLButtonElement>(null);

  const pending = proposal.status === "pending";
  const isCleanup = plan.kind === "cleanup";
  const verb = isCleanup ? "to the Recycle Bin" : "to move";
  const count = selectable.filter((o) => chosen.has(o.i)).length;

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    selectable.forEach((o) => o.src && m.set(folderOf(o.src), (m.get(folderOf(o.src)) ?? 0) + 1));
    return [...m.entries()];
  }, [selectable]);

  const toggle = (o: PlanOp) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(o.i)) n.delete(o.i);
      else n.add(o.i);
      return n;
    });

  async function approve() {
    setConfirm(false);
    setBusy("approve");
    setErr(null);
    const t = begin("operation");
    try {
      const res = await backend.approve(proposal.id, [...chosen]);
      onChange(res);
      const failed = res.log.filter((l) => l.status === "failed").length;
      finish(t, failed ? "error" : "done");
      toast(failed ? `${failed} item(s) failed. See details below.` : "Done. Logged in history.", failed ? "err" : "ok");
    } catch (e) {
      finish(t, "error");
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    setErr(null);
    try {
      const res = await backend.decline(proposal.id);
      onChange(res);
      send({ type: "approval-cleared" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    setBusy("undo");
    setErr(null);
    try {
      const res = await backend.undo(proposal.id);
      onChange(res);
      toast("Undone. Files are back where they were.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const done = proposal.status === "approved";
  const failed = proposal.log.filter((l) => l.status === "failed");

  return (
    <section className="stack gap-5" aria-label="Proposal review">
      <div className="row wrap gap-3">
        <span className={`pill ${pending ? "tag-violet" : done ? "tag-ok" : ""}`} aria-live="polite">
          {pending ? "Proposal · awaiting your approval" : done ? "Completed" : proposal.status === "undone" ? "Undone" : "Cancelled · nothing changed"}
        </span>
        <span className="subtle" style={{ fontSize: 13 }}>
          Planner: {plan.planner === "rules" ? "rules (no AI)" : plan.planner}
        </span>
        {backend.isDemo && <span className="demo-badge">DEMO · no real files move</span>}
      </div>
      {plan.reason && <p className="muted">{plan.reason}</p>}

      <div className="split">
        <div className="primary stack gap-2">
          <strong style={{ fontSize: 15 }}>
            {isCleanup ? "Items to clean" : "Files MAT-AH found"} · {count} of {selectable.length} included
          </strong>
          {selectable.map((o) => (
            <label key={o.i} className={`check-row${chosen.has(o.i) ? "" : " is-off"}`}>
              <input type="checkbox" checked={chosen.has(o.i)} onChange={() => toggle(o)} disabled={!pending || !!busy} />
              <span className="stack grow" style={{ gap: 2 }}>
                <span className="truncate" style={{ fontWeight: 500, fontSize: 14 }}>
                  {baseName(o.src)}
                </span>
                <span className="mono subtle truncate" style={{ fontSize: 12 }}>
                  {o.src ? folderOf(o.src) : ""}
                </span>
              </span>
              <span className="tag">{o.op === "move" ? (o.renamed ? "move + rename" : "move") : o.op === "trash" ? "Recycle Bin" : o.op === "rmdir" ? "remove empty folder" : o.op}</span>
            </label>
          ))}
          {plan.rejected_ids && plan.rejected_ids.length > 0 && (
            <Notice tone="warn">{plan.rejected_ids.length} suggested file(s) were dropped because they were not in the search results.</Notice>
          )}
        </div>

        <div className="aside stack gap-3">
          <strong style={{ fontSize: 15 }}>Before and after</strong>
          <div className="grid-auto-wide" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div className="card stack gap-2" style={{ padding: 14, fontSize: 13 }}>
              <span className="eyebrow">Now</span>
              {sources.map(([dir, n]) => (
                <span key={dir} className="truncate" title={dir}>
                  {baseName(dir)} <span className="mono subtle">{n}</span>
                </span>
              ))}
            </div>
            <div className="card stack gap-2" style={{ padding: 14, fontSize: 13, border: `2px dashed var(--accent-primary)` }}>
              <span className="eyebrow" style={{ color: "var(--accent-primary-text)" }}>
                {done ? "After · done" : "After · preview only"}
              </span>
              <strong className="truncate" title={plan.folder ?? "Recycle Bin"}>
                {isCleanup ? "Recycle Bin" : baseName(plan.folder)}
              </strong>
              {selectable
                .filter((o) => chosen.has(o.i))
                .map((o, k) => (
                  <span key={o.i} className={`ghost-item truncate${done ? " is-done" : ""}`} style={{ animationDelay: `${k * 40}ms` }}>
                    {baseName(o.dst) || baseName(o.src)}
                  </span>
                ))}
            </div>
          </div>
          <div className="card stack gap-2" style={{ fontSize: 14 }}>
            <span className="eyebrow">What will happen</span>
            {!isCleanup && plan.folder && (
              <span>
                Destination: <span className="mono" style={{ fontSize: 12.5 }}>{plan.folder}</span>
              </span>
            )}
            <span>
              {count} {count === 1 ? "item" : "items"} will be {isCleanup ? "sent to the Windows Recycle Bin (restorable)" : "moved. Original names are kept unless a name is taken"}.
            </span>
            <span>{isCleanup ? "Nothing is permanently deleted." : "Nothing is deleted. Undo moves every file back."}</span>
          </div>
        </div>
      </div>

      {err && (
        <Notice tone="err">
          <strong>Didn't go through.</strong> {err}
        </Notice>
      )}

      {pending && (
        <div className="approval">
          <div className="grow stack" style={{ minWidth: 220 }}>
            <strong>Waiting for your approval</strong>
            <span className="muted" style={{ fontSize: 14 }}>
              Nothing has changed yet. The dashed list is a preview.
            </span>
          </div>
          <button className="btn btn-line" onClick={decline} disabled={!!busy}>
            {busy === "decline" ? "Cancelling…" : "Cancel"}
          </button>
          <button className="btn btn-primary" onClick={() => setConfirm(true)} disabled={!!busy || count === 0}>
            {busy === "approve" ? "Running…" : `Review and approve ${count}`}
          </button>
        </div>
      )}

      {done && (
        <div className={failed.length ? "notice err" : "approval done"} role="status">
          <Icon name={failed.length ? "alert" : "check"} size={24} />
          <div className="grow stack" style={{ minWidth: 220 }}>
            <strong>
              {failed.length
                ? `${proposal.log.length - failed.length} done, ${failed.length} failed.`
                : `Done. ${proposal.log.filter((l) => l.op !== "mkdir").length} items ${isCleanup ? "in the Recycle Bin" : "moved"}.`}
            </strong>
            <span style={{ fontSize: 14 }}>Logged in operation history.</span>
          </div>
          {!isCleanup && (
            <button className="btn btn-line" onClick={undo} disabled={!!busy}>
              <Icon name="undo" /> {busy === "undo" ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      )}

      {proposal.log.length > 0 && (
        <details className="tech" open={failed.length > 0}>
          <summary>Operation log ({proposal.log.length})</summary>
          <ul className="list-plain" style={{ marginTop: 8 }}>
            {proposal.log.map((l) => (
              <li key={l.id} className="row gap-2" style={{ fontSize: 13 }}>
                <span className={`tag ${l.status === "done" ? "tag-ok" : l.status === "failed" ? "tag-err" : ""}`}>{l.status}</span>
                <span className="mono truncate">
                  {l.op} {baseName(l.src ?? undefined)} {l.dst ? `→ ${baseName(l.dst)}` : ""}
                </span>
                {l.error && <span className="subtle">{l.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        role="alertdialog"
        title={`Are you sure? ${count} ${count === 1 ? "item" : "items"} ${verb}.`}
        initialFocus={noRef}
        describedBy="confirm-desc"
      >
        <p id="confirm-desc" className="muted">
          {isCleanup
            ? "They go to the Windows Recycle Bin, where you can restore them. Each duplicate keeps one copy in place."
            : `They will move into ${baseName(plan.folder)}. You can undo this afterwards.`}
        </p>
        <div className="row wrap gap-3" style={{ justifyContent: "flex-end" }}>
          <button ref={noRef} className="btn btn-line" onClick={() => setConfirm(false)}>
            No
          </button>
          <button className="btn btn-primary" onClick={approve}>
            Yes, go ahead
          </button>
        </div>
      </Dialog>
    </section>
  );
}
