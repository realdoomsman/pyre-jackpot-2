import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { Card } from "../components";
import type { Board } from "../lib/useBoard";
import { CommitForm } from "./CommitForm";
import { RevealPanel } from "./RevealPanel";

export interface ConsoleProps {
  board: Board;
}

/**
 * The scorekeeper's side of the app: commit to the public board and grade what is due.
 * Every write is enforced server-side — `functions/commit.js` records the first
 * authenticated committer as the operator and refuses public commits from anyone else.
 */
export function Console({ board }: ConsoleProps) {
  const { user, loading } = usePyre();
  const claimed = board.data?.operator.claimed ?? false;

  return (
    <div className="flex flex-col gap-5">
      {!user && !loading ? (
        <Card title="you are not signed in">
          <p className="text-sm text-ink-muted">
            {claimed
              ? "this board already has a scorekeeper. sign in as that account to commit or reveal."
              : "the first account to commit becomes this board's scorekeeper. everything below is refused until you sign in."}
          </p>
          <div className="mt-4">
            <LoginButton className="inline-flex h-10 items-center rounded-card bg-violet px-4 text-sm font-medium text-bg hover:bg-violet-hover">
              log in
            </LoginButton>
          </div>
        </Card>
      ) : null}

      <CommitForm
        allowDraft
        categories={board.data?.categories ?? []}
        onCommitted={board.reload}
        skew={board.skew}
        visibility="public"
      />

      <RevealPanel onRevealed={board.reload} own={board.data?.own ?? []} scope="public" skew={board.skew} />
    </div>
  );
}
