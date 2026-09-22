import { useState } from "react";
import { pyreEnv } from "@pyre/app-sdk";
import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { Button, PageHeader } from "./components";
import { formatRate } from "./lib/format";
import type { FeedItem } from "./lib/types";
import { useBoard } from "./lib/useBoard";
import { Console } from "./views/Console";
import { Feed } from "./views/Feed";
import { HolderPanel } from "./views/HolderPanel";
import { Scoreboard } from "./views/Scoreboard";
import { Verify, type VerifyPrefill } from "./views/Verify";

type Tab = "feed" | "scoreboard" | "verify" | "holders" | "console";

const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "feed" },
  { id: "scoreboard", label: "scoreboard" },
  { id: "verify", label: "verify" },
  { id: "holders", label: "holders" },
  { id: "console", label: "scorekeeper" },
];

export default function App() {
  const env = pyreEnv();
  const { user } = usePyre();
  const board = useBoard();
  const [tab, setTab] = useState<Tab>("feed");
  const [prefill, setPrefill] = useState<VerifyPrefill | null>(null);

  const stats = board.data?.stats.overall ?? null;
  const canOperate = board.data?.operator.isYou ?? false;
  const tabs = TABS.filter((entry) => entry.id !== "console" || canOperate);

  const verifyItem = (item: FeedItem): void => {
    if (!item.text || !item.salt) return;
    setPrefill({ text: item.text, salt: item.salt, hash: item.hash });
    setTab("verify");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        actions={
          <LoginButton className="h-10 rounded-card border border-border bg-surface px-4 text-sm font-medium text-ink hover:border-border-strong">
            log in
          </LoginButton>
        }
        description="predictions are committed as a hash before anyone can read them, then revealed and graded in public. paste the text and salt back in to prove nothing changed."
        eyebrow={env.ticker ? `$${env.ticker}` : "pyre app"}
        title={env.name ?? "Jackpot: The Scorekeeper"}
      />

      {stats ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 font-mono text-xs tabular-nums text-ink-muted">
          <div className="flex gap-2">
            <dt className="text-ink-faint">sealed</dt>
            <dd className="text-ink">{stats.pending}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">revealed</dt>
            <dd className="text-ink">{stats.revealed}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">record</dt>
            <dd className="text-ink">
              {stats.win}-{stats.loss}-{stats.partial}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">win rate</dt>
            <dd className="text-ink">{formatRate(stats.winRate)}</dd>
          </div>
        </dl>
      ) : null}

      <nav aria-label="sections" className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <Button
            aria-current={tab === entry.id ? "page" : undefined}
            key={entry.id}
            onClick={() => setTab(entry.id)}
            size="sm"
            variant={tab === entry.id ? "primary" : "ghost"}
          >
            {entry.label}
          </Button>
        ))}
      </nav>

      <main className="flex-1">
        {tab === "feed" ? (
          <Feed board={board} onVerify={verifyItem} />
        ) : tab === "scoreboard" ? (
          <Scoreboard board={board} />
        ) : tab === "verify" ? (
          <Verify prefill={prefill} />
        ) : tab === "holders" ? (
          <HolderPanel board={board} />
        ) : (
          <Console board={board} />
        )}
      </main>

      <footer className="mt-auto flex flex-col gap-2 border-t border-border pt-6 text-sm text-ink-faint">
        <p>
          a commitment proves the wording was fixed before the outcome was known. grading is done by hand, with the
          reasoning attached to every reveal. no betting, no payouts, free to use.
        </p>
        <p>{user ? `signed in as ${user.displayName ?? user.wallet ?? user.id}. ` : ""}powered by pyre.</p>
      </footer>
    </div>
  );
}
