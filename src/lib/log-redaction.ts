/**
 * Keeps request values out of server logs (AUDIT.md F-22).
 *
 * A failed query reaches a log as drizzle's DrizzleQueryError. Its message and
 * `params` hold every value sent with the query (a password hash, a customer's
 * name and phone), and its cause, the postgres.js error, can hold the whole
 * failing row in `detail`. redactForLog() turns such an error into a copy that
 * keeps what's needed to debug: the SQL (placeholders only), the Postgres code,
 * table, column, constraint and routine, and the stack. installLogRedaction()
 * applies it to everything passed to console.*, which covers the app's own error
 * logs and the ones Next.js writes for errors a route handler doesn't catch.
 * src/instrumentation.ts installs it when the server starts.
 *
 * The original error is never changed, so code that handles it still sees
 * everything. Only what is printed is redacted.
 */

type Fields = Record<string, unknown>;
type QueryError = Error & { query: string; params: unknown[] };

const METHODS = ["error", "warn", "log", "info", "debug"] as const;
const INSTALLED = Symbol.for("sine-shin-next.logRedaction");
const POSTGRES_FIELDS = ["table_name", "column_name", "constraint_name", "routine"];

const isQueryError = (value: Error): value is QueryError => {
  const { query, params } = value as Partial<QueryError>;
  return typeof query === "string" && Array.isArray(params);
};

const isPostgresError = (value: Error): value is Error & Fields => {
  const { severity, code } = value as Error & { severity?: unknown; code?: unknown };
  return typeof severity === "string" && /^[0-9A-Z]{5}$/.test(String(code));
};

/** A new error with `err`'s name and stack frames, but the given message, fields and cause. */
function copyOf(err: Error, message: string, fields: Fields, cause: unknown): Error {
  const copy = new Error(message, cause === undefined ? undefined : { cause });
  copy.name = err.name;
  const frames = (err.stack ?? "").split("\n").filter((line) => /^\s+at /.test(line));
  copy.stack = [`${err.name}: ${message}`, ...frames].join("\n");
  return Object.assign(copy, fields);
}

/**
 * Returns `value` unchanged unless it is, or has in its cause chain, a database
 * error; then returns a redacted copy for printing.
 */
export function redactForLog(value: unknown, depth = 0): unknown {
  if (!(value instanceof Error) || depth > 5) return value;

  if (isQueryError(value)) {
    const count = value.params.length;
    const message = `Failed query: ${value.query}\nparams: ${count} ${count === 1 ? "value" : "values"} withheld`;
    return copyOf(value, message, {}, redactForLog(value.cause, depth + 1));
  }

  if (isPostgresError(value)) {
    const code = String(value.code);
    const fields: Fields = { code };
    for (const key of POSTGRES_FIELDS) if (typeof value[key] === "string") fields[key] = value[key];
    // Class 22 (data exception) messages can quote the value that was sent, e.g.
    // `invalid input syntax for type date: "…"`. Others name only tables, columns and constraints.
    const message = code.startsWith("22") ? "message withheld (it can quote the input)" : value.message;
    return copyOf(value, message, fields, undefined);
  }

  const cause = value.cause;
  const redactedCause = redactForLog(cause, depth + 1);
  return redactedCause === cause ? value : copyOf(value, value.message, {}, redactedCause);
}

/** Makes the given console's methods print every argument through redactForLog(). Installing twice has no further effect. */
export function installLogRedaction(target: Pick<Console, (typeof METHODS)[number]> = console): void {
  const marked = target as typeof target & { [INSTALLED]?: true };
  if (marked[INSTALLED]) return;
  for (const method of METHODS) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(...args.map((arg) => redactForLog(arg)));
  }
  marked[INSTALLED] = true;
}
