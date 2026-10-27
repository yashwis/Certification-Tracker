import Dashboard from "./dashboard";
import type { DashboardPayload } from "../lib/types";
import { readState, storageConfigured } from "../lib/blob-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { cases } = await readState();
  const payload: DashboardPayload = {
    cases,
    updatedAt: cases.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, ""),
    storageConfigured: storageConfigured(),
  };
  return <Dashboard initialData={payload} />;
}
