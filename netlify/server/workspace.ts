import { z } from "zod";
import { datasetSchema } from "../../src/lib/dataset-schema.js";
import type { DataSet } from "../../src/lib/types.js";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
const payload = z.object({
  data: datasetSchema,
  version: z.number().int().nonnegative(),
});

interface Services {
  verify: (request: Request) => Promise<string | null>;
  load: (userId: string) => Promise<{ data: DataSet; version: number }>;
  save: (
    userId: string,
    data: DataSet,
    version: number,
  ) => Promise<{ version: number } | null>;
}
export function createWorkspaceHandler(services: Services) {
  return async function handler(request: Request) {
    if (new URL(request.url).pathname !== "/api/workspace")
      return json({ error: "Not found." }, 404);
    if (!["GET", "PUT"].includes(request.method))
      return json({ error: "Method not allowed." }, 405);
    if (
      request.method === "PUT" &&
      request.headers.get("origin") !== new URL(request.url).origin
    ) {
      return json({ error: "Request origin is not allowed." }, 403);
    }
    try {
      const userId = await services.verify(request);
      if (!userId) return json({ error: "Please sign in again." }, 401);
      if (request.method === "GET") return json(await services.load(userId));
      if (!request.headers.get("content-type")?.includes("application/json"))
        return json({ error: "Expected JSON." }, 415);
      const body = await request.text();
      if (body.length > 5_000_000)
        return json(
          {
            error:
              "Workspace exceeds the 5 MB limit. Export a backup to keep your changes.",
          },
          413,
        );
      let input: z.infer<typeof payload>;
      try {
        input = payload.parse(JSON.parse(body));
      } catch {
        return json({ error: "The workspace contains invalid data." }, 400);
      }
      const saved = await services.save(
        userId,
        input.data as DataSet,
        input.version,
      );
      if (!saved)
        return json(
          {
            error:
              "This workspace changed in another tab or device. Download your unsaved backup, then reload to load the latest records.",
          },
          409,
        );
      return json(saved);
    } catch (error) {
      console.error("Workspace request failed", error);
      return json(
        { error: "Your workspace could not be reached. Please try again." },
        503,
      );
    }
  };
}
