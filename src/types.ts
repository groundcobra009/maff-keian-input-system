export type ApplicationStatus =
  | "draft"
  | "ocr_draft"
  | "needs_review"
  | "returned"
  | "submitted"
  | "accepted"
  | "export_ready"
  | "exported"
  | "withdrawn";

export type PrimitiveValue = string | number | boolean | null;

export type AppRecord = {
  id: string;
  title: string;
  year: string;
  status: ApplicationStatus;
  updatedAt: number;
};

export type FieldValue = {
  id?: string;
  fieldKey: string;
  value: PrimitiveValue;
  source?: "manual" | "ocr" | "copied" | "system";
  confidence?: number;
  status?: "draft" | "confirmed" | "needs_review";
};

export type LandParcel = {
  id: string;
  fieldNo: string;
  splitNo: string;
  cropSeason: string;
  location?: string;
  landCategory?: string;
  mainAreaM2?: number;
  cropAreaM2?: number;
  cropName?: string;
  cropType?: string;
  paymentExcluded?: boolean;
  continuationExcluded?: boolean;
  note?: string;
};

export type OcrResult = {
  id: string;
  fieldKey: string;
  label: string;
  value: PrimitiveValue;
  confidence: number;
  page?: number;
  status: "suggested" | "accepted" | "rejected" | "edited";
};

export type ValidationIssue = {
  id: string;
  fieldKey?: string;
  severity: "error" | "warning" | "ocr_review";
  message: string;
};

export type ApplicationDetail = {
  application: AppRecord;
  values: FieldValue[];
  parcels: LandParcel[];
  ocrResults: OcrResult[];
  issues: ValidationIssue[];
};

export type FieldDefinition = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "email" | "tel";
  required?: boolean;
  unit?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type FieldGroup = {
  id: string;
  title: string;
  summary: string;
  fields: FieldDefinition[];
};

export type OcrProvider = "openai" | "anthropic" | "gemini";

export type AdminApplicationRow = {
  id: string;
  title: string;
  year: string;
  status: ApplicationStatus;
  currentStep?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  errorCount: number;
  warningCount: number;
  ocrJobCount: number;
  exportJobCount: number;
  totalAreaM2?: number;
  cropAreaM2?: number;
  subsidyPrograms?: string[];
};

export type AdminAuditLog = {
  id: string;
  applicationId?: string;
  actor?: string;
  action: string;
  detail?: string;
  createdAt: number;
};

export type CouncilSettings = {
  councilName?: string;
  prefectureCode?: string;
  councilCode?: string;
  managementCode?: string;
  updatedAt?: number;
  updatedBy?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "owner";
  addedAt: number;
  addedBy?: string;
};

export type FeedbackItem = {
  id: string;
  name: string;
  email?: string;
  message: string;
  view?: string;
  status: "new" | "reviewing" | "done" | "archived";
  createdAt: number;
  createdBy?: string;
};

export type AdminDashboardData = {
  generatedAt: number;
  statusCounts: Record<string, number>;
  ocrCounts: Record<string, number>;
  exportCounts: Record<string, number>;
  issueCounts: {
    errors: number;
    warnings: number;
  };
  areaSummary?: {
    totalAreaM2: number;
    cropAreaM2: number;
    applicationCountWithArea: number;
  };
  subsidyCounts?: Array<{
    fieldKey: string;
    label: string;
    count: number;
  }>;
  councilSettings?: CouncilSettings | null;
  adminUsers?: AdminUser[];
  feedbackItems?: FeedbackItem[];
  applications: AdminApplicationRow[];
  recentAuditLogs: AdminAuditLog[];
};
