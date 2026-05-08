import { describe, expect, it } from "vitest";
import { pdfNeeded } from "@/lib/search/pdf-needed";

describe("pdfNeeded", () => {
  it("detects document/form intent", () => {
    expect(pdfNeeded("descargar el formato de retiro")).toBe(true);
  });

  it("does not trigger for generic short queries", () => {
    expect(pdfNeeded("retiro voluntario")).toBe(false);
  });

  it("does not trigger on substrings for single-word triggers", () => {
    expect(pdfNeeded("manualidades")).toBe(false);
  });

  it("triggers when a single-word trigger is adjacent to punctuation", () => {
    expect(pdfNeeded("manual, por favor")).toBe(true);
    expect(pdfNeeded("pdf?")).toBe(true);
    expect(pdfNeeded("formato.")).toBe(true);
  });
});
