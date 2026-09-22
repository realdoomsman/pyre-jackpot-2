import { useState } from "react";
import { Button, Card, Chip, EmptyState, Select, Textarea } from "../components";
import { call, describeError } from "../lib/api";
import { OUTCOME_LABEL, formatCountdown, formatStamp } from "../lib/format";
import type { Outcome, OwnCommit, RevealResult } from "../lib/types";
import { useNow } from "../lib/useBoard";
import { HashProof } from "./HashProof";

export interface RevealPanelProps {
  own: OwnCommit[];
  skew: number;
  /** `private` lists sealed holder calls, which open on demand; `public` waits for the date. */
  scope: "public" | "private";
  onRevealed: () => void;
}

interface FormState {
  outcome: Outcome;
  explanation: string;
  note: string;
}

const BLANK: FormState = { outcome: "win", explanation: "", note: "" };

export function RevealPanel({ own, skew, scope, onRevealed }: RevealPanelProps) {
  const now = useNow(skew);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<RevealResult | null>(null);

  const mine = own.filter((item) => (scope === "private" ? item.hidden : !item.hidden));
  const open = (id: string): void => {
    setOpenId(id);
    setForm(BLANK);
    setError(null);
    setProof(null);
  };

  const submit = async (id: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await call<RevealResult>("reveal", {
        id,
        outcome: form.outcome,
        explanation: form.explanation,
      });
      setProof(result);
      setOpenId(null);
      onRevealed();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const suggest = async (id: string): Promise<void> => {
    setGrading(true);
    setError(null);
    try {
      const graded = await call<{ outcome: Outcome; explanation: string }>("grade", { id, note: form.note });
      setForm((previous) => ({ ...previous, outcome: graded.outcome, explanation: graded.explanation }));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setGrading(false);
    }
  };

  return (
    <Card
      description={
        scope === "private"
          ? "your sealed calls. revealing one publishes its text, salt and hash to the public board."
          : "commitments past their resolution date. revealing publishes the original text and salt next to the hash."
      }
      title={scope === "private" ? "your sealed calls" : "reveal what is due"}
    >
      {proof ? (
        <div className="mb-5 flex flex-col gap-3 rounded-card border border-border bg-bg p-4" data-testid="reveal-result">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="violet">revealed · {OUTCOME_LABEL[proof.entry.outcome ?? "partial"]}</Chip>
            <span className="text-xs text-ink-faint">{formatStamp(proof.entry.revealedAt ?? Date.now())}</span>
          </div>
          <p className="text-sm leading-relaxed text-ink">{proof.entry.text}</p>
          <dl className="flex flex-col gap-1">
            <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">salt</dt>
            <dd className="break-all font-mono text-xs text-ink-muted">{proof.entry.salt}</dd>
          </dl>
          {proof.entry.text && proof.entry.salt ? (
            <HashProof hash={proof.hash} salt={proof.entry.salt} text={proof.entry.text} />
          ) : null}
        </div>
      ) : null}

      {mine.length === 0 ? (
        <EmptyState
          description={
            scope === "private"
              ? "nothing sealed. a private call stays invisible to everyone else until you open it."
              : "nothing to reveal. commitments appear here once their resolution date passes."
          }
          title="nothing waiting"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {mine.map((item) => {
            const left = item.resolvesAt - now;
            const ready = item.hidden || left <= 0;
            return (
              <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>{item.category}</Chip>
                  {ready ? <Chip tone="heat">ready</Chip> : <Chip>{formatCountdown(left)}</Chip>}
                  <span className="ml-auto text-xs text-ink-faint">resolves {formatStamp(item.resolvesAt)}</span>
                </div>
                <p className="break-all font-mono text-xs leading-relaxed text-ink-muted">{item.hash}</p>

                {openId === item.id ? (
                  <form
                    className="flex flex-col gap-4 rounded-card border border-border bg-bg p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit(item.id);
                    }}
                  >
                    <Select
                      label="outcome"
                      onChange={(e) => setForm({ ...form, outcome: e.target.value as Outcome })}
                      value={form.outcome}
                    >
                      <option value="win">right</option>
                      <option value="partial">partial</option>
                      <option value="loss">wrong</option>
                    </Select>
                    <Textarea
                      hint="one or two sentences: what happened, and why it counts that way"
                      label="explanation"
                      onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                      rows={3}
                      value={form.explanation}
                    />
                    <div className="flex flex-col gap-2 border-t border-border pt-4">
                      <Textarea
                        hint="optional: describe what happened and let the model propose the grade"
                        label="what happened"
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        rows={2}
                        value={form.note}
                      />
                      <div>
                        <Button
                          disabled={grading || form.note.trim().length < 4}
                          onClick={() => void suggest(item.id)}
                          size="sm"
                          variant="secondary"
                        >
                          {grading ? "grading…" : "suggest a grade"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button disabled={busy || form.explanation.trim().length < 4} type="submit">
                        {busy ? "revealing…" : "reveal and publish"}
                      </Button>
                      <Button onClick={() => setOpenId(null)} variant="ghost">
                        cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <Button
                      disabled={!ready}
                      onClick={() => open(item.id)}
                      size="sm"
                      variant={ready ? "primary" : "secondary"}
                    >
                      {ready ? "reveal" : "not due yet"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div aria-live="polite">
        {error ? (
          <p className="mt-4 text-sm text-danger" data-testid="reveal-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
