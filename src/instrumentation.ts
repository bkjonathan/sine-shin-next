// Next.js runs register() once when the server starts.
export async function register() {
  // Keep request values out of every log line, including the ones Next.js writes
  // for errors a route handler doesn't catch (AUDIT.md F-22).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installLogRedaction } = await import("./lib/log-redaction");
    installLogRedaction();
  }
}
