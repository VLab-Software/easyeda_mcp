import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EasyEdaBridge } from "../../bridge/EasyEdaBridge.js";
import { BridgeTimeoutError, BridgeUnavailableError } from "../../bridge/errors.js";
import { DrcEditQuerySchema, drcConfirmation } from "../../drc/contracts.js";
import { ok, fail } from "../toolResult.js";
import { DefaultTimeoutSchema, hasExplicitMutationConfirmation } from "./common.js";

export function registerActionTools(server: McpServer, bridge: EasyEdaBridge): void {
  server.registerTool(
    "easyeda_confirmed_action",
    {
      title: "Confirmed EasyEDA Pro action",
      description: "Runs a mutating EasyEDA Pro action after human approval. For editDrcRules pass params:{editId} and the exact prepared confirmation. Saving the PCB remains separate.",
      inputSchema: {
        action: z.enum(["save", "importChanges", "autoroute", "autolayout", "editDrcRules"]),
        confirmation: z.string().describe("DRC: exact CONFIRM editDrcRules <editId> after human review. Legacy actions require an explicit confirmation phrase."),
        params: z.record(z.string(), z.unknown()).optional(),
        timeoutMs: DefaultTimeoutSchema.default(60_000)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ action, confirmation, params, timeoutMs }) => {
      let drcDispatched = false;
      try {
        if (action === "editDrcRules") {
          const edit = DrcEditQuerySchema.parse(params);
          if (confirmation !== drcConfirmation(edit.editId)) return fail(new Error("DRC edit blocked: use the exact prepared edit confirmation after human approval."));
        } else if (!hasExplicitMutationConfirmation(confirmation)) {
          return fail(new Error(`Action "${action}" was blocked. The confirmation text must explicitly include a confirmation phrase such as "confirma salvar".`));
        }
        drcDispatched = action === "editDrcRules";
        const result = await bridge.call("confirmedAction", { action, confirmation, params }, timeoutMs);
        const response = ok(`EasyEDA Pro action result: ${action}.`, {
          action,
          result
        });
        if (action === "editDrcRules" && (result as { status?: string }).status !== "applied") response.isError = true;
        return response;
      } catch (error) {
        if (drcDispatched && (error instanceof BridgeTimeoutError || error instanceof BridgeUnavailableError)) {
          const response = ok("DRC edit outcome is inconclusive; query the edit without repeating it.", {
            error: "drc_edit_outcome_unknown", status: "unknown", editId: params?.editId, retryable: false,
            nextSteps: ["Call easyeda_get_drc_edit_result with this editId. Never automatically replay it."]
          });
          response.isError = true;
          return response;
        }
        return fail(error);
      }
    }
  );
}
