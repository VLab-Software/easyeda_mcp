import { describe, expect, it } from "vitest";
import { createDisconnectedStatus, parseClientMessage } from "./messages.js";

describe("bridge protocol messages", () => {
  it("parses supported client messages", () => {
    const message = parseClientMessage(JSON.stringify({
      kind: "result",
      requestId: "abc",
      result: { ok: true }
    }));

    expect(message.kind).toBe("result");
  });

  it("rejects unsupported message kinds", () => {
    expect(() => parseClientMessage(JSON.stringify({ kind: "nope" }))).toThrow("Unsupported bridge message kind");
  });

  it("creates actionable disconnected status", () => {
    const status = createDisconnectedStatus();
    expect(status.connected).toBe(false);
    expect(status.message).toContain("EasyEDA Pro extension is not connected");
  });
});
