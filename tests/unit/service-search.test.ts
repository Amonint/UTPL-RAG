import { describe, expect, it } from "vitest";
import { searchServices } from "@/lib/search/service-search";

const services = [
  {
    serviceId: "a",
    serviceName: "Solicitar edición de matrícula",
    category: "SERVICIOS",
    studentTypes: ["X"],
    jsonPayload: { descripcion: "..." },
    pdfRefs: [],
  },
  {
    serviceId: "b",
    serviceName: "Retiro voluntario",
    category: "SERVICIOS",
    studentTypes: ["X"],
    jsonPayload: { nota: "..." },
    pdfRefs: [{ label: "Formato", url: "x.pdf", localPath: "x.pdf", sourcePath: "0" }],
  },
] as any;

describe("searchServices", () => {
  it("is accent-insensitive", () => {
    const res = searchServices({ query: "matricula", services, limit: 10 });
    expect(res[0]?.serviceId).toBe("a");
  });

  it("includes hasPdfs flag", () => {
    const res = searchServices({ query: "retiro", services, limit: 10 });
    expect(res[0]?.hasPdfs).toBe(true);
  });
});

