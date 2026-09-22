import { useState } from "react";
import { Button, Card, EmptyState } from "../components";
import { formatRate } from "../lib/format";
import type { BoardRecord, CategoryRecord } from "../lib/types";
import type { Board } from "../lib/useBoard";

export interface ScoreboardProps {
  board: Board;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className="mt-2 font-mono text-3xl tabular-nums leading-none text-ink">{value}</p>
      {hint ? <p className="mt-2 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Stacked record bar: heat ramp only, widths proportional to graded calls. */
function RecordBar({ record }: { record: BoardRecord }) {
  const graded = record.win + record.partial + record.loss;
  if (graded === 0) return <div className="h-2 w-full rounded-card bg-heat-1" />;
  const pct = (n: number): string => `${(n / graded) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-card bg-heat-1">
      <div className="bg-heat-3" style={{ width: pct(record.win) }} />
      <div className="bg-heat-4" style={{ width: pct(record.partial) }} />
      <div className="bg-heat-2" style={{ width: pct(record.loss) }} />
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div className="rounded-card border border-border bg-surface p-4" key={i}>
            <div className="h-3 w-16 animate-pulse rounded-card bg-surface-raised" />
            <div className="mt-3 h-8 w-10 animate-pulse rounded-card bg-surface-raised" />
          </div>
        ))}
      </div>
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="h-2 w-full animate-pulse rounded-card bg-surface-raised" />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-4 rounded-card bg-heat-3" /> right
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-4 rounded-card bg-heat-4" /> partial
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-4 rounded-card bg-heat-2" /> wrong
      </li>
    </ul>
  );
}

export function Scoreboard({ board }: ScoreboardProps) {
  const [filter, setFilter] = useState<string | null>(null);
  const stats = board.data?.stats;

  if (board.status === "loading") {
    return (
      <div className="flex flex-col gap-5">
        <p aria-live="polite" className="text-sm text-ink-muted">
          loading the record…
        </p>
        <Skeleton />
      </div>
    );
  }
  if (board.status === "error" || !stats) {
    return (
      <Card title="the record did not load">
        <p className="text-sm text-danger" role="alert">
          {board.error ?? "the scoreboard is unavailable right now"}
        </p>
        <Button className="mt-4" onClick={board.reload} variant="secondary">
          try again
        </Button>
      </Card>
    );
  }

  const byCategory: CategoryRecord[] = stats.byCategory;
  const active: BoardRecord = filter ? (byCategory.find((c) => c.category === filter) ?? stats.overall) : stats.overall;
  const graded = active.win + active.loss + active.partial;

  return (
    <div className="flex flex-col gap-5">
      <div aria-label="filter the record by category" className="flex flex-wrap gap-2" role="group">
        <Button
          aria-pressed={filter === null}
          onClick={() => setFilter(null)}
          size="sm"
          variant={filter === null ? "primary" : "secondary"}
        >
          all categories
        </Button>
        {byCategory.map((row) => (
          <Button
            aria-pressed={filter === row.category}
            key={row.category}
            onClick={() => setFilter(row.category)}
            size="sm"
            variant={filter === row.category ? "primary" : "secondary"}
          >
            {row.category}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          hint="right counts one, partial counts a half"
          label="win rate"
          value={formatRate(active.winRate)}
        />
        <Tile hint={`${graded} graded`} label="right" value={String(active.win)} />
        <Tile label="partial" value={String(active.partial)} />
        <Tile label="wrong" value={String(active.loss)} />
      </div>

      <Card
        description={`${active.total} commitments, ${active.pending} still sealed`}
        title={filter ?? "whole board"}
      >
        <div className="flex flex-col gap-3">
          <RecordBar record={active} />
          <Legend />
        </div>
      </Card>

      <Card description="every revealed call, grouped by the category it was committed under" title="by category">
        {byCategory.length === 0 ? (
          <EmptyState
            description="the record fills in as commitments reach their resolution date and get revealed."
            title="no graded calls yet"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {byCategory.map((row) => (
              <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" key={row.category}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-ink">{row.category}</span>
                  <span className="font-mono text-sm tabular-nums text-ink-muted">
                    {row.win}-{row.loss}-{row.partial}
                    <span className="ml-3 text-ink">{formatRate(row.winRate)}</span>
                  </span>
                </div>
                <RecordBar record={row} />
                <p className="font-mono text-xs text-ink-faint">
                  {row.revealed} revealed · {row.pending} sealed
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-ink-faint">
        hashing proves a revealed prediction is word-for-word the one that was committed. it does not prove the grade
        is fair — every outcome on this board is graded by hand, with the explanation attached.
      </p>
    </div>
  );
}
