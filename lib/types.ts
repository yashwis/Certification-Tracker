export type Certification = "PAC" | "AP";

export type CertificationCase = {
  key: string;
  certification: Certification;
  testId: string;
  description: string;
  status: string;
  inScope: boolean;
  isMutual: boolean;
  category: string;
  date: string;
  details: string;
  txnStatus: string;
  testSteps: string;
  responseCode: string;
  initiatedBy: string;
  flowType: string;
  expectedResult: string;
  remarks: string;
  sourceFile: string;
  sortOrder: number;
  updatedAt: string;
};

export type DashboardPayload = {
  cases: CertificationCase[];
  updatedAt: string;
  storageConfigured: boolean;
};

export const EDITABLE_STATUSES = ["Pass", "Fail", "Not Executed Yet", "Blocked", "Not in Scope"] as const;
