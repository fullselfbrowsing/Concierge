import type { BrowserBatchReport } from "@full-self-browsing/concierge/ai-sdk/browser";

export interface ClientFlowOperations {
  readonly addToolOutput: (update: Readonly<{
    tool: string;
    toolCallId: string;
    output: unknown;
  }>) => void;
  readonly recoverCatalog: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly notice: (message: string) => void;
}

export async function applyServerCatalogRetry(
  reason: "catalog-stale",
  operations: Pick<ClientFlowOperations, "recoverCatalog" | "notice">,
): Promise<void> {
  operations.notice(
    reason === "catalog-stale"
      ? "The server catalog changed before signing; regenerating this step."
      : "The server requested a fresh catalog.",
  );
  await operations.recoverCatalog();
}

/** Apply verified bridge control without ever manufacturing a tool result. */
export async function applyBrowserBatchReport(
  report: BrowserBatchReport,
  operations: ClientFlowOperations,
): Promise<void> {
  if (report.kind === "completed") {
    for (const row of report.rows) {
      operations.addToolOutput({
        tool: row.name,
        toolCallId: row.callId,
        output: row.result,
      });
    }
    return;
  }
  if (report.kind === "terminal") {
    operations.notice(
      `Terminal action ${report.enteredBy.name} ended this model loop.`,
    );
    await operations.stop();
    return;
  }

  operations.notice(`Signed action batch rejected: ${report.code}.`);
  if (report.code === "catalog_mismatch" || report.code === "catalog_changed") {
    await operations.recoverCatalog();
    return;
  }
  await operations.stop();
}
