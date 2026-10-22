import initialData from "../data/certification-seed.json";
import Dashboard from "./dashboard";
import type { DashboardPayload, CertificationCase } from "../lib/types";

export default function Home() {
  const cases = initialData as CertificationCase[];
  const payload: DashboardPayload = { cases, updatedAt: cases[0]?.updatedAt ?? "", storageConfigured: false };
  return <Dashboard initialData={payload} />;
}
