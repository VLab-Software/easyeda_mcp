import { describe, expect, it } from "vitest";
import { fail, ok } from "./toolResult.js";

describe("toolResult", () => {
  it("includes structured payload inside text content for success results", () => {
    const result = ok("Fetched EasyEDA Pro context.", {
      result: {
        projectName: "Power Supply",
        componentCount: 61
      }
    });

    expect(result.content[0]).toMatchObject({
      type: "text"
    });
    expect(result.content[0]?.text).toContain("Fetched EasyEDA Pro context.");
    expect(result.content[0]?.text).toContain("\"projectName\": \"Power Supply\"");
    expect(result.structuredContent).toMatchObject({
      result: {
        projectName: "Power Supply"
      }
    });
  });

  it("includes normalized payload inside text content for error results", () => {
    const result = fail(new Error("boom"));

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("boom");
    expect(result.content[0]?.text).toContain("\"error\": \"unexpected_error\"");
    expect(result.structuredContent).toMatchObject({
      error: "unexpected_error",
      message: "boom"
    });
  });
});
