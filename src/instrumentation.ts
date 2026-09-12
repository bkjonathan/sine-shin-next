// Next.js runs register() once when the server starts.
export async function register() {
  // Keep request values out of every log line, including the ones Next.js writes
  // for errors a route handler doesn't catch (AUDIT.md F-22).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Refuse to start with a missing or invalid setting (AUDIT.md F-29), but not
    // while building: `next build` runs without the runtime settings.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { envProblems } = await import("./env");
      const problems = envProblems();
      if (problems.length > 0) {
        console.error(`Refusing to start: invalid environment settings\n${problems.map((p) => `  - ${p}`).join("\n")}`);
        process.exit(1);
      }
    }

    const { installLogRedaction } = await import("./lib/log-redaction");
    installLogRedaction();
  }
}
