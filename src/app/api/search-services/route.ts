import { loadArtifacts } from '@/lib/data'
import { searchServices } from "@/lib/search/service-search";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      limit?: unknown;
    };
    const query = body.query?.trim() ?? "";

    const rawLimit = typeof body.limit === "number" ? body.limit : Number(body.limit);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 12, 1), 50);

    if (!query) {
      return Response.json({ results: [] }, { status: 200 });
    }

    const { services } = await loadArtifacts();
    const results = searchServices({ query, services, limit });
    return Response.json({ results });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ message }, { status: 500 });
  }
}
