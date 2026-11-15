import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceHandler } from "../netlify/server/workspace.js";
import { verifyIdentity } from "../netlify/server/verify-identity.js";
import { emptyDataset, type DataSet } from "../src/lib/types.js";

function fixture() {
  const rows = new Map<string, { data: DataSet; version: number }>();
  const handler = createWorkspaceHandler({
    async verify(req) {
      return req.headers.get("x-test-user");
    },
    async load(id) {
      if (!rows.has(id)) rows.set(id, { data: emptyDataset(), version: 0 });
      return rows.get(id)!;
    },
    async save(id, data, version) {
      if (rows.get(id)?.version !== version) return null;
      rows.set(id, { data, version: version + 1 });
      return { version: version + 1 };
    },
  });
  const request = (
    user?: string,
    body?: unknown,
    origin = "https://school.example",
  ) =>
    new Request("https://school.example/api/workspace?userId=someone-else", {
      method: body ? "PUT" : "GET",
      headers: {
        ...(user ? { "x-test-user": user } : {}),
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { handler, request };
}

test("anonymous requests cannot read or write records", async () => {
  const { handler, request } = fixture();
  assert.equal((await handler(request())).status, 401);
  assert.equal(
    (await handler(request(undefined, { data: emptyDataset(), version: 0 })))
      .status,
    401,
  );
});
test("users have separate empty workspaces and cannot choose another owner", async () => {
  const { handler, request } = fixture();
  await handler(request("teacher-a"));
  await handler(request("teacher-b"));
  const data = emptyDataset();
  data.students.push({
    id: "student-a",
    name: "Private record",
    studentNumber: "A01",
    archived: false,
  });
  assert.equal(
    (
      await handler(
        request("teacher-a", { userId: "teacher-b", data, version: 0 }),
      )
    ).status,
    200,
  );
  assert.deepEqual(
    (await (await handler(request("teacher-a"))).json()).data.students,
    data.students,
  );
  assert.deepEqual(
    (await (await handler(request("teacher-b"))).json()).data.students,
    [],
  );
});
test("stale saves cannot overwrite a newer version", async () => {
  const { handler, request } = fixture();
  await handler(request("teacher-a"));
  assert.equal(
    (await handler(request("teacher-a", { data: emptyDataset(), version: 0 })))
      .status,
    200,
  );
  assert.equal(
    (await handler(request("teacher-a", { data: emptyDataset(), version: 0 })))
      .status,
    409,
  );
});
test("cross-origin writes and malformed datasets are rejected", async () => {
  const { handler, request } = fixture();
  assert.equal(
    (
      await handler(
        request(
          "teacher-a",
          { data: emptyDataset(), version: 0 },
          "https://untrusted.example",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handler(
        request("teacher-a", { data: { students: [] }, version: 0 }),
      )
    ).status,
    400,
  );
});
test("Identity rejects forged, expired, and unconfirmed sessions", async () => {
  const req = new Request("https://school.example/api/workspace", {
    headers: { Cookie: "nf_jwt=test-session" },
  });
  const endpoint = "https://school.example/.netlify/identity";
  const denied = async () => new Response(null, { status: 401 });
  assert.equal(
    await verifyIdentity(req, endpoint, denied as typeof fetch),
    null,
  );
  const unconfirmed = async () => Response.json({ id: "teacher-a" });
  assert.equal(
    await verifyIdentity(req, endpoint, unconfirmed as typeof fetch),
    null,
  );
  const confirmed = async (url: string) => {
    assert.equal(url, `${endpoint}/user`);
    return Response.json({ id: "verified-user", confirmed_at: "2026-11-15" });
  };
  assert.equal(
    await verifyIdentity(req, endpoint, confirmed as typeof fetch),
    "verified-user",
  );
});
