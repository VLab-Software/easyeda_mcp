import { describe, expect, it } from "vitest";
import { hasExplicitMutationConfirmation } from "./registerTools.js";

describe("mutation confirmation guard", () => {
  it("accepts explicit confirmation phrases", () => {
    expect(hasExplicitMutationConfirmation("confirma salvar")).toBe(true);
    expect(hasExplicitMutationConfirmation("I confirm this save")).toBe(true);
  });

  it("rejects vague or missing confirmation", () => {
    expect(hasExplicitMutationConfirmation("pode salvar")).toBe(false);
    expect(hasExplicitMutationConfirmation("save it")).toBe(false);
  });
});
