import { getUser, refreshSession } from "@netlify/identity";
import type { DataSet } from "./types";
export interface Workspace {
  data: DataSet;
  version: number;
}
export async function workspaceRequest(
  method: "GET" | "PUT",
  body?: Workspace,
) {
  await refreshSession();
  if (!(await getUser()))
    throw new Error("Your session has ended. Sign in again to continue.");
  const response = await fetch("/api/workspace", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response
    .json()
    .catch(() => ({
      error: "Unable to reach your workspace. Please try again.",
    }));
  if (!response.ok)
    throw new Error(
      result.error || "Unable to reach your workspace. Please try again.",
    );
  return result as Workspace;
}
export function downloadWorkspace(data: DataSet) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `progression-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
