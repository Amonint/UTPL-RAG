import { loadArtifacts } from "@/lib/data/load-artifacts";
import { searchServices } from "@/lib/search/service-search";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    limit?: number;
  };
  const query = body.query?.trim() ?? "";
  const limit = Math.min(Math.max(body.limit ?? 12, 1), 50);

  if (!query) {
    return Response.json({ results: [] }, { status: 200 });
  }

  const { services } = await loadArtifacts();
  const results = searchServices({ query, services, limit });
  return Response.json({ results });
}

