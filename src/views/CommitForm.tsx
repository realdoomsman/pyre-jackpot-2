import { useState } from "react";
import { Button, Card, Chip, Input, Select, Textarea } from "../components";
import { call, describeError } from "../lib/api";
import { formatStamp, toDateTimeLocal } from "../lib/format";
import type { CommitResult } from "../lib/types";

const MAX_TEXT = 280;
const WEEK = 7 * 24 * 60 * 60 * 1000;

export interface CommitFormProps {
  categories: string[];
  visibility: "public" | "private";
  /** Server clock offset, so the default resolution date is a week from the server's now. */
  skew: number;
  onCommitted: () => void;
  /** Adds the model-drafted prediction helper above the field. */
  allowDraft?: boolean;
}

export function CommitForm({ categories, visibility, skew, onCommitted, allowDraft = false }: CommitFormProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "crypto");
  const [when, setWhen] = useState(() => toDateTimeLocal(Date.now() + skew + WEEK));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  const [niche, setNiche] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const resolvesAt = new Date(when).getTime();
    if (!Number.isFinite(resolvesAt)) {
      setError("pick a resolution date");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const committed = await call<CommitResult>("commit", { text, category, resolvesAt, visibility });
      setResult(committed);
      setText("");
      onCommitted();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const draft = async (): Promise<void> => {
    setDrafting(true);
    setDraftError(null);
    try {
      const horizonDays = Math.max(1, Math.round((new Date(when).getTime() - (Date.now() + skew)) / 86_400_000));
      const suggestion = await call<{ text: string }>("draft", { niche, category, horizonDays });
      setText(suggestion.text);
    } catch (cause) {
      setDraftError(describeError(cause));
    } finally {
      setDrafting(false);
    }
  };

  const over = text.length > MAX_TEXT;

  return (
    <Card
      actions={<Chip tone={visibility === "private" ? "violet" : "neutral"}>{visibility}</Chip>}
      description={
        visibility === "private"
          ? "sealed to you. nothing about it is public — not the hash, not the category — until you reveal it."
          : "the hash goes public immediately. the text stays sealed until the resolution date passes."
      }
      title={visibility === "private" ? "seal a private call" : "commit a prediction"}
    >
      {allowDraft ? (
        <div className="mb-5 flex flex-col gap-2 rounded-card border border-border bg-bg p-4">
          <p className="text-sm text-ink-muted">draft one with the model, then edit it before committing</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              className="flex-1"
              label="niche"
              onChange={(e) => setNiche(e.target.value)}
              placeholder="l2 fee markets, fed policy, box office"
              value={niche}
            />
            <Button disabled={drafting || niche.trim().length < 2} onClick={() => void draft()} variant="secondary">
              {drafting ? "drafting…" : "draft"}
            </Button>
          </div>
          {draftError ? (
            <p className="text-sm text-danger" role="alert">
              {draftError}
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          error={over ? `${text.length} characters — the limit is ${MAX_TEXT}` : undefined}
          hint={over ? undefined : `${text.length}/${MAX_TEXT} characters, falsifiable and specific`}
          label="prediction"
          onChange={(e) => setText(e.target.value)}
          placeholder="by the resolution date, …"
          rows={4}
          value={text}
        />
        <div className="flex flex-col gap-4 sm:flex-row">
          <Select className="sm:w-48" label="category" onChange={(e) => setCategory(e.target.value)} value={category}>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input
            className="flex-1"
            label="resolution date"
            min={toDateTimeLocal(Date.now() + skew + 60_000)}
            onChange={(e) => setWhen(e.target.value)}
            type="datetime-local"
            value={when}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy || over || text.trim().length < 12} type="submit">
            {busy ? "sealing…" : "seal and commit"}
          </Button>
          <span className="text-xs text-ink-faint">a 128-bit salt is generated server-side and kept sealed</span>
        </div>
      </form>

      <div aria-live="polite" className="mt-5">
        {error ? (
          <p className="text-sm text-danger" data-testid="commit-error" role="alert">
            {error}
          </p>
        ) : result ? (
          <div className="flex flex-col gap-2 rounded-card border border-border bg-bg p-4" data-testid="commit-result">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="violet">committed</Chip>
              <span className="text-xs text-ink-faint">
                resolves {formatStamp(result.entry.resolvesAt)} · {result.entry.category}
              </span>
            </div>
            <dl>
              <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">commit hash</dt>
              <dd className="break-all font-mono text-xs leading-relaxed text-ink" data-testid="commit-result-hash">
                {result.hash}
              </dd>
            </dl>
            <p className="text-xs text-ink-muted">
              the text and salt are sealed. they become public, together with this hash, at reveal.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
