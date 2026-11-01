import { describe, expect, it } from "vitest";
import { createDispatcher } from "./dispatcher.js";

describe("Extension RPC Dispatcher", () => {
  it("dispatches valid call message to matching handler and sends result", async () => {
    const sent: unknown[] = [];
    const handlers = {
      testMethod: async (params: Record<string, any>) => ({ echo: params.value * 2 })
    };
    const dispatch = createDispatcher(handlers, (msg) => sent.push(msg));

    await dispatch(JSON.stringify({
      kind: "call",
      requestId: "req-1",
      method: "testMethod",
      params: { value: 21 }
    }));

    expect(sent).toEqual([
      {
        kind: "result",
        requestId: "req-1",
        result: { echo: 42 }
      }
    ]);
  });

  it("handles unknown method with structured error message", async () => {
    const sent: unknown[] = [];
    const dispatch = createDispatcher({}, (msg) => sent.push(msg));

    await dispatch(JSON.stringify({
      kind: "call",
      requestId: "req-2",
      method: "missingMethod",
      params: {}
    }));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: "error",
      requestId: "req-2",
      error: {
        code: "unknown_method"
      }
    });
  });

  it("safely ignores malformed or non-call messages", async () => {
    const sent: unknown[] = [];
    const dispatch = createDispatcher({}, (msg) => sent.push(msg));

    await dispatch("not json");
    await dispatch(JSON.stringify({ kind: "ping" }));
    await dispatch(JSON.stringify({ kind: "call" })); // missing requestId / method

    expect(sent).toEqual([]);
  });
});
