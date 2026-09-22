import { Button, Card, Chip } from "../components";
import { OUTCOME_LABEL, OUTCOME_TONE, formatCountdown, formatStamp } from "../lib/format";
import type { FeedItem } from "../lib/types";
import { HashProof } from "./HashProof";

export interface PredictionCardProps {
  item: FeedItem;
  now: number;
  /** Opens the standalone verifier with this reveal already filled in. */
  onVerify: (item: FeedItem) => void;
}

export function PredictionCard({ item, now, onVerify }: PredictionCardProps) {
  const left = item.resolvesAt - now;
  const revealed = item.status === "revealed";

  return (
    <Card className="flex flex-col gap-4" data-testid="prediction-card">
      <div className="flex flex-wrap items-center gap-2">
        <Chip>{item.category}</Chip>
        {revealed && item.outcome ? (
          <Chip data-testid="outcome-chip" tone={OUTCOME_TONE[item.outcome]}>
            {OUTCOME_LABEL[item.outcome]}
          </Chip>
        ) : (
          <Chip tone="heat">sealed</Chip>
        )}
        {item.hidden ? <Chip>private</Chip> : null}
        {item.holder ? <Chip tone="violet">holder</Chip> : null}
        <span className="ml-auto font-mono text-xs text-ink-faint">committed {formatStamp(item.committedAt)}</span>
      </div>

      {revealed && item.text ? (
        <div className="flex flex-col gap-3">
          <p className="text-base leading-relaxed text-ink" data-testid="prediction-text">
            {item.text}
          </p>
          {item.explanation ? (
            <p className="text-sm leading-relaxed text-ink-muted">
              {item.explanation}
              {item.graded === "llm" ? <span className="text-ink-faint"> — graded with model assistance</span> : null}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-muted">
            {item.hidden
              ? "your sealed private call — the text stays with you until you reveal it"
              : "the text is sealed. only its hash is public until the resolution date."}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-2xl tabular-nums text-ink" data-testid="countdown">
              {formatCountdown(left)}
            </span>
            <span className="text-xs text-ink-faint">
              {left > 0 ? `until ${formatStamp(item.resolvesAt)}` : `resolution date passed ${formatStamp(item.resolvesAt)}`}
            </span>
          </div>
        </div>
      )}

      <dl className="flex flex-col gap-1 border-t border-border pt-3">
        <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">commit hash</dt>
        <dd className="break-all font-mono text-xs leading-relaxed text-ink-muted" data-testid="commit-hash">
          {item.hash}
        </dd>
        {revealed && item.salt ? (
          <>
            <dt className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">salt</dt>
            <dd className="break-all font-mono text-xs leading-relaxed text-ink-muted" data-testid="commit-salt">
              {item.salt}
            </dd>
          </>
        ) : null}
      </dl>

      {revealed && item.text && item.salt ? (
        <div className="flex flex-col gap-3">
          <HashProof hash={item.hash} salt={item.salt} text={item.text} />
          <div>
            <Button onClick={() => onVerify(item)} size="sm" variant="secondary">
              check it yourself
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
