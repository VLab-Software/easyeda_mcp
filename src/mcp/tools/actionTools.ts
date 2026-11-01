import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EditorClient } from "../../editor/EditorClient.js";
import { BridgeTimeoutError, BridgeUnavailableError } from "../../bridge/errors.js";
import { DrcEditQuerySchema, drcConfirmation } from "../../drc/contracts.js";
import { ok, fail } from "../toolResult.js";
import { DefaultTimeoutSchema, hasExplicitMutationConfirmation } from "./common.js";

export function registerActionTools(server: McpServer, bridge: EditorClient): void {
  server.registerTool(
    "easyeda_confirmed_action",
    {
      title: "Confirmed EasyEDA Pro action",
      description:
        "Runs a mutating EasyEDA Pro action after human approval. For editDrcRules pass params:{editId} and the exact prepared confirmation. Saving the PCB remains separate.",
      inputSchema: {
        action: z.enum([
          "save",
          "importChanges",
          "autoroute",
          "autolayout",
          "nativeAutoRoute",
          "nativeAutoLayout",
          "unroute",
          "importAutoRouteFile",
          "importAutoLayoutFile",
          "editDrcRules",
          "mutation"
        ]),
        confirmation: z
          .string()
          .describe(
            "DRC: exact CONFIRM editDrcRules <editId> after human review. Mutation: exact CONFIRM <domain>:<action> <mutationId>. Legacy actions require an explicit confirmation phrase."
          ),
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
      let mutationDispatched = false;
      try {
        if (action === "editDrcRules") {
          const edit = DrcEditQuerySchema.parse(params);
          if (confirmation !== drcConfirmation(edit.editId))
            return fail(new Error("DRC edit blocked: use the exact prepared edit confirmation after human approval."));
          mutationDispatched = true;
        } else if (action === "mutation") {
          if (!params?.mutationId) {
            return fail(new Error("Mutation action requires params.mutationId."));
          }
          mutationDispatched = true;
        } else if (!hasExplicitMutationConfirmation(confirmation)) {
          return fail(
            new Error(
              `Action "${action}" was blocked. The confirmation text must explicitly include a confirmation phrase such as "confirma salvar".`
            )
          );
        }
        const result = await bridge.call("confirmedAction", { action, confirmation, params }, timeoutMs);
        const response = ok(`EasyEDA Pro action result: ${action}.`, {
          action,
          result
        });
        if (action === "editDrcRules" && (result as { status?: string }).status !== "applied") response.isError = true;
        if (action === "mutation" && (result as { status?: string }).status !== "applied") response.isError = true;
        return response;
      } catch (error) {
        if (mutationDispatched && (error instanceof BridgeTimeoutError || error instanceof BridgeUnavailableError)) {
          const isDrc = action === "editDrcRules";
          const response = ok(
            isDrc
              ? "DRC edit outcome is inconclusive; query the edit without repeating it."
              : "Mutation outcome is inconclusive; query the mutation without repeating it.",
            {
              error: isDrc ? "drc_edit_outcome_unknown" : "mutation_outcome_unknown",
              status: "unknown",
              ...(isDrc ? { editId: params?.editId } : { mutationId: params?.mutationId }),
              retryable: false,
              nextSteps: [
                isDrc
                  ? "Call easyeda_get_drc_edit_result with this editId. Never automatically replay it."
                  : "Query the mutation result with this mutationId. Never automatically replay it."
              ]
            }
          );
          response.isError = true;
          return response;
        }
        return fail(error);
      }
    }
  );
}
