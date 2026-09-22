import { useEffect, useState } from "react";
import { Button, Card, Chip, Input, Textarea } from "../components";
import { commitPreimage, normalizePrediction, sha256Hex } from "../lib/hash";

export interface VerifyPrefill {
  text: string;
  salt: string;
  hash: string;
}

export interface VerifyProps {
  /** Set when a visitor clicks "check it yourself" on a revealed commit. */
  prefill: VerifyPrefill | null;
}

type Result =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; computed: string; expected: string }
  | { kind: "failed"; message: string };

export function Verify({ prefill }: VerifyProps) {
  const [text, setText] = useState("");
  const [salt, setSalt] = useState("");
  const [expected, setExpected] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    setSalt(prefill.salt);
    setExpected(prefill.hash);
    setResult({ kind: "idle" });
  }, [prefill]);

  const check = async (): Promise<void> => {
    const target = expected.trim().toLowerCase();
    if (normalizePrediction(text) === "" || salt.trim() === "") {
      setResult({ kind: "failed", message: "paste the revealed prediction and its salt" });
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(target)) {
      setResult({ kind: "failed", message: "a commit hash is 64 hexadecimal characters" });
      return;
    }
    setResult({ kind: "working" });
    try {
      setResult({ kind: "done", computed: await sha256Hex(commitPreimage(text, salt)), expected: target });
    } catch (cause) {
      setResult({ kind: "failed", message: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const matches = result.kind === "done" && result.computed === result.expected;

  return (
    <div className="flex flex-col gap-5">
      <Card
        actions={<Chip>sha-256</Chip>}
        description="paste a revealed prediction, its salt and the hash that was published at commit time. the check runs in your browser."
        title="verify a commit"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <Textarea
            hint="leading, trailing and repeated whitespace is collapsed before hashing"
            label="revealed prediction"
            onChange={(e) => setText(e.target.value)}
            placeholder="the exact text that was revealed"
            rows={4}
            value={text}
          />
          <Input
            className="font-mono"
            label="salt"
            onChange={(e) => setSalt(e.target.value)}
            placeholder="32 hex characters"
            value={salt}
          />
          <Input
            className="font-mono"
            label="commit hash"
            onChange={(e) => setExpected(e.target.value)}
            placeholder="64 hex characters"
            value={expected}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={result.kind === "working"} type="submit">
              {result.kind === "working" ? "hashing…" : "check the hash"}
            </Button>
            <Button
              onClick={() => {
                setText("");
                setSalt("");
                setExpected("");
                setResult({ kind: "idle" });
              }}
              variant="ghost"
            >
              clear
            </Button>
          </div>
        </form>

        <div aria-live="polite" className="mt-5">
          {result.kind === "idle" ? (
            <p className="text-sm text-ink-faint">
              the recipe is <span className="font-mono text-ink-muted">sha256(prediction + &quot;|&quot; + salt)</span>.
              nothing leaves this page.
            </p>
          ) : result.kind === "working" ? (
            <p className="text-sm text-ink-muted">hashing…</p>
          ) : result.kind === "failed" ? (
            <p className="text-sm text-danger" data-testid="verify-result" role="alert">
              {result.message}
            </p>
          ) : (
            <div className="flex flex-col gap-2" data-testid="verify-result">
              <Chip className={matches ? undefined : "border-danger/50 text-danger"} tone={matches ? "violet" : "neutral"}>
                {matches ? "match" : "no match"}
              </Chip>
              <p className="text-sm text-ink-muted">
                {matches
                  ? "this text and salt hash to exactly the published commit — it was not edited after the fact."
                  : "this text and salt do not produce the published commit hash."}
              </p>
              <dl className="flex flex-col gap-1">
                <dt className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">computed</dt>
                <dd className="break-all font-mono text-xs text-ink">{result.computed}</dd>
                <dt className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">published</dt>
                <dd className="break-all font-mono text-xs text-ink-muted">{result.expected}</dd>
              </dl>
            </div>
          )}
        </div>
      </Card>

      <Card description="what the commitment does and does not prove" title="how it works">
        <ol className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
          <li>
            <span className="font-mono text-xs text-ink-faint">1 —</span> a prediction is written with a category and a
            resolution date. the app generates a random 128-bit salt.
          </li>
          <li>
            <span className="font-mono text-xs text-ink-faint">2 —</span> it publishes only{" "}
            <span className="font-mono text-ink">sha256(prediction + &quot;|&quot; + salt)</span> plus the commit and
            resolution timestamps. the text and the salt stay sealed in server storage.
          </li>
          <li>
            <span className="font-mono text-xs text-ink-faint">3 —</span> after the resolution date the text and salt are
            published with an outcome. the server re-hashes before publishing and refuses a reveal that does not match.
          </li>
          <li>
            <span className="font-mono text-xs text-ink-faint">4 —</span> you repeat the hash here. a match proves the
            wording is unchanged. it does not prove the grade is fair — that is why every grade carries an explanation.
          </li>
        </ol>
      </Card>
    </div>
  );
}
