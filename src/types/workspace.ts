import type { CurrencyCode } from "@/lib/money/formatMoney";

export type WorkspaceType = "personal" | "professional" | "church" | "family" | "business";

export type WorkspaceSettings = {
  currency?: CurrencyCode;
  monthlyReportEnabled?: boolean;
  categoriesPresetApplied?: boolean;
};

export type Workspace = {
  id: string;
  uid: string;
  name: string;
  type: WorkspaceType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  settings?: WorkspaceSettings;
};

export type CreateWorkspaceInput = {
  name: string;
  type: WorkspaceType;
  isDefault?: boolean;
  settings?: WorkspaceSettings;
};

export type UpdateWorkspaceInput = {
  id: string;
  name?: string;
  type?: WorkspaceType;
  isDefault?: boolean;
  settings?: WorkspaceSettings;
};

export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  personal: "Pessoal",
  professional: "Profissional / Autônomo",
  church: "Igreja / Ministério",
  family: "Família / Casa",
  business: "Pequeno negócio",
};
