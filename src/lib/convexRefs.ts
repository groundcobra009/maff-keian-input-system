import { makeFunctionReference } from "convex/server";

export const convexApi = {
  applications: {
    list: makeFunctionReference<"query", Record<string, never>, any[]>("applications:list"),
    get: makeFunctionReference<"query", { applicationId: string }, any | null>("applications:get"),
    create: makeFunctionReference<"mutation", { year: string; title: string; applicantName?: string }, string>("applications:create"),
    saveField: makeFunctionReference<
      "mutation",
      { applicationId: string; fieldKey: string; value: string | number | boolean | null; source?: "manual" | "ocr" | "copied" | "system" },
      null
    >("applications:saveField"),
    upsertParcel: makeFunctionReference<"mutation", Record<string, any>, string>("applications:upsertParcel"),
    removeParcel: makeFunctionReference<"mutation", { applicationId: string; parcelId: string }, null>("applications:removeParcel"),
    validate: makeFunctionReference<"mutation", { applicationId: string }, { errorCount: number; ocrReviewCount: number }>("applications:validate"),
    submit: makeFunctionReference<"mutation", { applicationId: string }, null>("applications:submit"),
  },
  files: {
    generateUploadUrl: makeFunctionReference<"mutation", Record<string, never>, string>("files:generateUploadUrl"),
    attachUploadedFile: makeFunctionReference<
      "mutation",
      { applicationId: string; storageId: string; filename: string; contentType: string; kind: "application_pdf" | "attachment" | "export" },
      string
    >("files:attachUploadedFile"),
  },
  ocr: {
    createJob: makeFunctionReference<
      "mutation",
      { applicationId: string; uploadedFileId: string; provider: "openai" | "anthropic" | "gemini"; modelId: string },
      string
    >("ocr:createJob"),
    runJob: makeFunctionReference<"action", { ocrJobId: string }, { extracted: number }>("ocr:runJob"),
    acceptResult: makeFunctionReference<"mutation", { resultId: string; value: string | number | boolean | null }, null>("ocr:acceptResult"),
    rejectResult: makeFunctionReference<"mutation", { resultId: string }, null>("ocr:rejectResult"),
  },
  export: {
    generateCsv: makeFunctionReference<"action", { applicationId: string }, { fileName: string; content: string }>("export:generateCsv"),
  },
  admin: {
    dashboard: makeFunctionReference<"query", Record<string, never>, any>("admin:dashboard"),
    setApplicationStatus: makeFunctionReference<
      "mutation",
      { applicationId: string; status: string; actor?: string },
      null
    >("admin:setApplicationStatus"),
  },
};
