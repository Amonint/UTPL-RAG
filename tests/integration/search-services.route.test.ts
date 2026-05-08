import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/search-services/route";

describe("POST /api/search-services", () => {
  it("returns results array", async () => {
    const req = new Request("http://localhost/api/search-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "matricula", limit: 5 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.results)).toBe(true);
  });
});

