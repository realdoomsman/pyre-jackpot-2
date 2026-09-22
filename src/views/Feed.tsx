import { Button, Card, EmptyState, cx } from "../components";
import { useNow } from "../lib/useBoard";
import type { Board } from "../lib/useBoard";
import type { FeedItem } from "../lib/types";
import { PredictionCard } from "./PredictionCard";

export interface FeedProps {
  board: Board;
  onVerify: (item: FeedItem) => void;
}

function CategoryFilter({ board }: { board: Board }) {
  const categories = board.data?.categories ?? [];
  return (
    <div aria-label="filter by category" className="flex flex-wrap gap-2" role="group">
      <Button
        aria-pressed={board.category === null}
        onClick={() => board.setCategory(null)}
        size="sm"
        variant={board.category === null ? "primary" : "secondary"}
      >
        all
      </Button>
      {categories.map((category) => (
        <Button
          aria-pressed={board.category === category}
          key={category}
          onClick={() => board.setCategory(category)}
          size="sm"
          variant={board.category === category ? "primary" : "secondary"}
        >
          {category}
        </Button>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div className="rounded-card border border-border bg-surface p-5" key={i}>
          <div className="h-4 w-24 animate-pulse rounded-card bg-surface-raised" />
          <div className="mt-4 h-8 w-40 animate-pulse rounded-card bg-surface-raised" />
          <div className="mt-4 h-3 w-full animate-pulse rounded-card bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}

export function Feed({ board, onVerify }: FeedProps) {
  const now = useNow(board.skew);

  return (
    <div className="flex flex-col gap-5">
      <CategoryFilter board={board} />

      {board.status === "loading" ? (
        <>
          <p aria-live="polite" className="text-sm text-ink-muted">
            loading the board…
          </p>
          <Skeleton />
        </>
      ) : board.status === "error" ? (
        <Card title="the board did not load">
          <p className="text-sm text-danger" role="alert">
            {board.error}
          </p>
          <Button className="mt-4" onClick={board.reload} variant="secondary">
            try again
          </Button>
        </Card>
      ) : board.items.length === 0 ? (
        <EmptyState
          description={
            board.category
              ? "nothing committed in this category yet. clear the filter to see the whole board."
              : "no commitments yet. the scorekeeper seals a prediction and only its hash goes public until the resolution date."
          }
          title="nothing sealed yet"
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {board.items.map((item) => (
              <PredictionCard item={item} key={item.id} now={now} onVerify={onVerify} />
            ))}
          </div>
          <div className={cx("flex items-center gap-3", !board.hasMore && "hidden")}>
            <Button disabled={board.loadingMore} onClick={board.loadMore} variant="secondary">
              {board.loadingMore ? "loading…" : "load older commits"}
            </Button>
            <span className="font-mono text-xs text-ink-faint">
              {board.items.length}/{board.data?.total ?? 0}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
