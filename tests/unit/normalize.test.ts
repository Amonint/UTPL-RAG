import { describe, expect, it } from "vitest";
import { normalizeText } from "@/lib/search/normalize";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("Matrícula Presencial")).toBe("matricula presencial");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  Retiro   voluntario ")).toBe("retiro voluntario");
  });
});

