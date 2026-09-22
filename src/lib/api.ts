import { NotAuthenticatedError, ship } from "@pyre/app-sdk";

/**
 * `ship.fn` wrapper: server functions answer `{ error }` for anything a caller can fix,
 * so turn that into a rejected promise and let every call site render one error path.
 */
export async function call<T>(name: string, input?: unknown): Promise<T> {
  const result = await ship.fn<T>(name, input);
  const failure = (result as unknown as { error?: unknown } | null)?.error;
  if (typeof failure === "string") throw new Error(failure);
  return result;
}

/** One human sentence for any failure, including the platform's auth and holder answers. */
export function describeError(cause: unknown): string {
  if (cause instanceof NotAuthenticatedError) return "log in first — the platform holds your session, not this app";
  if (cause instanceof Error) {
    if (/\b403\b|holder/i.test(cause.message) && /forbidden|403/i.test(cause.message)) {
      return "that action is holder-only";
    }
    return cause.message;
  }
  return String(cause);
}
