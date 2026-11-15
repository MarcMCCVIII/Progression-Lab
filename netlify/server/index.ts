import { getIdentityConfig } from "@netlify/identity";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { workspaces } from "../../db/schema.js";
import { emptyDataset } from "../../src/lib/types.js";
import { createWorkspaceHandler } from "./workspace.js";
import { verifyIdentity } from "./verify-identity.js";

export default createWorkspaceHandler({
  verify(request) {
    return verifyIdentity(request, getIdentityConfig()?.url);
  },
  async load(userId) {
    await db
      .insert(workspaces)
      .values({ userId, data: emptyDataset() })
      .onConflictDoNothing();
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId));
    return { data: workspace.data, version: workspace.version };
  },
  async save(userId, data, version) {
    const [saved] = await db
      .update(workspaces)
      .set({ data, version: version + 1, updatedAt: new Date() })
      .where(
        and(eq(workspaces.userId, userId), eq(workspaces.version, version)),
      )
      .returning({ version: workspaces.version });
    return saved ?? null;
  },
});
