import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState, ErrorState, InlineIris } from "../../components/feedback/Feedback";
import { Icon } from "../../components/Icon";
import { useTrackedRequest } from "../../hooks/useTrackedRequest";
import { useIris } from "../../mascot/IrisContext";
import { useBackend } from "../../services/BackendContext";
import { isAbort } from "../../services/apiClient";
import { formatDate } from "../../services/normalize";
import type { Proposal } from "../../services/types";
import { ProposalReview } from "./ProposalReview";

export function KilosPage({ q }: { q: string }) {
  const backend = useBackend();
  const { send } = useIris();
  const [draft, setDraft] = useState(q);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [history, setHistory] = useState<Proposal[] | null>(null);
  const propose = useTrackedRequest<Proposal, [string]>("propose", (signal, r) => backend.propose(r, signal), () => "proposal");
  const { run } = propose;

  const loadHistory = useCallback(
    (signal?: AbortSignal) =>
      backend
        .history(signal)
        .then(setHistory)
        .catch((e) => !isAbort(e) && setHistory([])),
    [backend],
  );

  useEffect(() => {
    const c = new AbortController();
    loadHistory(c.signal);
    return () => c.abort();
  }, [loadHistory]);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  // Leaving Kilos with a proposal still pending should not leave Iris waiting.
  useEffect(() => () => send({ type: "approval-cleared" }), [send]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setProposal(null);
    const p = await run(draft.trim());
    if (p) {
      setProposal(p);
      loadHistory();
    }
  }

  const onChange = (p: Proposal) => {
    setProposal(p);
    loadHistory();
  };

  return (
    <AppShell page="kilos" title="Kilos" eyebrow="Organize · nothing moves without your OK">
      <form className={`seam-field${propose.status === "loading" ? " is-busy" : ""}`} onSubmit={submit} aria-busy={propose.status === "loading"}>
        <Icon name="organize" size={20} />
        <label htmlFor="kilos-q" className="sr-only">
          What should MAT-AH organize?
        </label>
        <input id="kilos-q" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='Halimbawa: "Ipunin mo lahat ng enrollment requirements"' autoComplete="off" />
        <button className="btn btn-primary" type="submit" disabled={propose.status === "loading"}>
          Gumawa ng plano
        </button>
        <span className="seam-line" aria-hidden="true" />
      </form>

      <div aria-live="polite">
        {propose.status === "loading" && (
          <div className="card row gap-4" role="status">
            <InlineIris state="planning" size={56} />
            <div className="stack gap-1">
              <strong>Pinaplano ko…</strong>
              <span className="subtle" style={{ fontSize: 14 }}>Finding matching files and drafting a proposal. Nothing is moved.</span>
            </div>
          </div>
        )}
        {propose.status === "error" && <ErrorState error={propose.error} onRetry={() => run(draft.trim())} title="Hindi makagawa ng plano." />}
      </div>

      {!proposal && propose.status === "idle" && (
        <EmptyState iris="idle" title="Sabihin kung paano aayusin." body="Describe a group of files. MAT-AH proposes a folder and shows every move before anything happens." />
      )}

      {proposal && <ProposalReview key={proposal.id} proposal={proposal} onChange={onChange} />}

      <section className="stack gap-3" aria-label="Operation history">
        <h2 style={{ fontSize: 20 }}>History</h2>
        {history === null && <span className="subtle">Loading…</span>}
        {history && history.length === 0 && <span className="subtle" style={{ fontSize: 14 }}>No proposals yet.</span>}
        {history && history.length > 0 && (
          <ul className="list-plain">
            {history.slice(0, 8).map((h) => (
              <li key={h.id} className="card row wrap gap-3" style={{ padding: 12 }}>
                <span className={`tag ${h.status === "approved" ? "tag-ok" : h.status === "pending" ? "tag-violet" : ""}`}>{h.status}</span>
                <span className="grow truncate" style={{ fontSize: 14 }}>
                  {h.request}
                </span>
                <span className="mono subtle" style={{ fontSize: 12 }}>
                  {h.plan.ops.length} ops · {formatDate(h.created_at)}
                </span>
                {(h.status === "pending" || h.status === "approved") && h.id !== proposal?.id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setProposal(h)}>
                    {h.status === "pending" ? "Review" : "Details"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
