/** Wire shapes returned by `functions/*.js`. */

export type Outcome = "win" | "loss" | "partial";

export interface FeedItem {
  id: string;
  hash: string;
  category: string;
  committedAt: number;
  resolvesAt: number;
  status: "pending" | "revealed";
  outcome: Outcome | null;
  /** The author held the coin when they committed. */
  holder: boolean;
  source: "operator" | "holder";
  /** Sealed private commit — only its author sees it in the feed. */
  hidden: boolean;
  mine: boolean;
  text: string | null;
  salt: string | null;
  explanation: string | null;
  revealedAt: number | null;
  graded: "operator" | "llm" | null;
}

export interface OwnCommit {
  id: string;
  hash: string;
  category: string;
  committedAt: number;
  resolvesAt: number;
  hidden: boolean;
  revealable: boolean;
}

export interface BoardRecord {
  total: number;
  pending: number;
  revealed: number;
  win: number;
  loss: number;
  partial: number;
  /** Partial counts as half a win; `null` until something is graded. */
  winRate: number | null;
}

export interface CategoryRecord extends BoardRecord {
  category: string;
}

export interface FeedResult {
  now: number;
  categories: string[];
  operator: { claimed: boolean; isYou: boolean };
  items: FeedItem[];
  own: OwnCommit[];
  total: number;
  offset: number;
  limit: number;
  stats: { overall: BoardRecord; byCategory: CategoryRecord[] };
}

export interface CommitResult {
  entry: FeedItem;
  hash: string;
  committedAt: number;
}

export interface RevealResult {
  entry: FeedItem;
  hash: string;
  recomputed: string;
  verified: boolean;
}
