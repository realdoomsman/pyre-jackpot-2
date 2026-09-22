import { useState } from "react";
import { pyreEnv } from "@pyre/app-sdk";
import { HolderGate, usePyre } from "@pyre/app-sdk/react";
import { Button, Card, Chip, Input } from "../components";
import { call, describeError } from "../lib/api";
import type { Board } from "../lib/useBoard";
import { CommitForm } from "./CommitForm";
import { RevealPanel } from "./RevealPanel";

export interface HolderPanelProps {
  board: Board;
}

const PERKS = [
  "seal private calls that stay invisible to everyone else until you reveal them",
  "add categories the whole board can commit against",
  "draft model-written prediction feeds before anything reaches the public board",
  "a holder badge next to your calls on the public scoreboard",
];

function CategoryCreator({ board }: { board: Board }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      await call<{ categories: string[] }>("addcategory", { name });
      setAdded(name.trim().toLowerCase());
      setName("");
      board.reload();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card description="a new category shows up in the filters and in every commit form" title="add a category">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          className="flex-1"
          label="category name"
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="elections, ai labs, football"
          value={name}
        />
        <Button disabled={busy || name.trim().length < 2} type="submit">
          {busy ? "adding…" : "add"}
        </Button>
      </form>
      <div aria-live="polite" className="mt-4">
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : added ? (
          <p className="text-sm text-ink-muted">
            <span className="font-mono text-ink">{added}</span> is on the board
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(board.data?.categories ?? []).map((category) => (
          <Chip key={category}>{category}</Chip>
        ))}
      </div>
    </Card>
  );
}

export function HolderPanel({ board }: HolderPanelProps) {
  const { holder } = usePyre();
  const env = pyreEnv();
  const ticker = env.ticker ? `$${env.ticker}` : "the app's coin";

  return (
    <div className="flex flex-col gap-5">
      <HolderGate
        fallback={
          <Card
            actions={<Chip tone="violet">holders</Chip>}
            description="the rest of the app is free and needs no login. this panel is the one part gated on holding the coin."
            title="holder panel"
          >
            <p className="text-sm text-ink-muted" data-testid="holder-locked">
              hold at least <span className="font-mono tabular-nums text-ink">{holder.minHold}</span> {ticker} to
              unlock:
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {PERKS.map((perk) => (
                <li className="flex gap-3 text-sm text-ink-muted" key={perk}>
                  <span aria-hidden className="mt-2 h-1 w-3 shrink-0 rounded-card bg-violet" />
                  {perk}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-faint">
              your balance: <span className="font-mono tabular-nums">{holder.balance}</span>
            </p>
          </Card>
        }
      >
        <Card
          actions={<Chip tone="violet">holder</Chip>}
          description="private commits are sealed to you: the hash is not published until you reveal them."
          title="holder panel"
        >
          <p className="text-sm text-ink-muted" data-testid="holder-unlocked">
            holding <span className="font-mono tabular-nums text-ink">{holder.balance}</span> {ticker}. your calls carry
            a holder badge on the public scoreboard.
          </p>
        </Card>

        <CommitForm
          allowDraft
          categories={board.data?.categories ?? []}
          onCommitted={board.reload}
          skew={board.skew}
          visibility="private"
        />

        <RevealPanel onRevealed={board.reload} own={board.data?.own ?? []} scope="private" skew={board.skew} />

        <CategoryCreator board={board} />
      </HolderGate>
    </div>
  );
}
