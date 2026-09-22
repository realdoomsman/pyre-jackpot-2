import { useEffect, useState } from "react";
import { Chip } from "../components";
import { commitPreimage, sha256Hex } from "../lib/hash";

export interface HashProofProps {
  text: string;
  salt: string;
  hash: string;
  /** Shown under the verdict: the sealed text and salt this was computed from. */
  showPreimage?: boolean;
}

type State =
  | { kind: "computing" }
  | { kind: "done"; computed: string }
  | { kind: "failed"; message: string };

/**
 * Re-hashes a revealed prediction in the visitor's own browser and compares the result
 * with the hash that was published at commit time. Nothing here trusts the server.
 */
export function HashProof({ text, salt, hash, showPreimage = false }: HashProofProps) {
  const [state, setState] = useState<State>({ kind: "computing" });

  useEffect(() => {
    let live = true;
    setState({ kind: "computing" });
    sha256Hex(commitPreimage(text, salt))
      .then((computed) => {
        if (live) setState({ kind: "done", computed });
      })
      .catch((cause: unknown) => {
        if (live) setState({ kind: "failed", message: cause instanceof Error ? cause.message : String(cause) });
      });
    return () => {
      live = false;
    };
  }, [text, salt]);

  const matches = state.kind === "done" && state.computed === hash;

  return (
    <div className="flex flex-col gap-2" data-testid="hash-proof">
      <div className="flex flex-wrap items-center gap-2">
        {state.kind === "computing" ? (
          <Chip>recomputing sha-256</Chip>
        ) : state.kind === "failed" ? (
          <Chip>hash check unavailable</Chip>
        ) : matches ? (
          <Chip data-testid="hash-proof-ok" tone="violet">
            hash matches the commit
          </Chip>
        ) : (
          <Chip className="border-danger/50 text-danger" data-testid="hash-proof-bad">
            hash does not match
          </Chip>
        )}
        <span className="text-xs text-ink-faint">recomputed in your browser</span>
      </div>

      {state.kind === "done" ? (
        <p className="break-all font-mono text-xs leading-relaxed text-ink-muted" data-testid="hash-proof-value">
          {state.computed}
        </p>
      ) : state.kind === "failed" ? (
        <p className="text-xs text-ink-faint">{state.message}</p>
      ) : null}

      {showPreimage ? (
        <p className="break-all font-mono text-xs leading-relaxed text-ink-faint">
          sha256(prediction + &quot;|&quot; + salt)
        </p>
      ) : null}

      {state.kind === "done" && !matches ? (
        <p className="text-sm text-danger" role="alert">
          the revealed text does not hash to the published commit — treat this reveal as untrustworthy
        </p>
      ) : null}
    </div>
  );
}
