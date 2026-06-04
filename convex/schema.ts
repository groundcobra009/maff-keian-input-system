import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    code: v.string(),
    type: v.union(v.literal("council"), v.literal("ja"), v.literal("admin")),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  applicants: defineTable({
    organizationId: v.optional(v.id("organizations")),
    managementCode: v.string(),
    name: v.string(),
    nameKana: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_management_code", ["managementCode"]),

  applications: defineTable({
    applicantId: v.optional(v.id("applicants")),
    organizationId: v.optional(v.id("organizations")),
    year: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("ocr_draft"),
      v.literal("needs_review"),
      v.literal("returned"),
      v.literal("submitted"),
      v.literal("accepted"),
      v.literal("export_ready"),
      v.literal("exported"),
      v.literal("withdrawn"),
    ),
    title: v.string(),
    currentStep: v.string(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_year_status", ["year", "status"])
    .index("by_organization_year_status", ["organizationId", "year", "status"])
    .index("by_applicant_year", ["applicantId", "year"]),

  applicationValues: defineTable({
    applicationId: v.id("applications"),
    fieldKey: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.null()),
    source: v.union(
      v.literal("manual"),
      v.literal("ocr"),
      v.literal("copied"),
      v.literal("system"),
    ),
    confidence: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("confirmed"), v.literal("needs_review")),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_application", ["applicationId"])
    .index("by_application_field", ["applicationId", "fieldKey"]),

  landParcels: defineTable({
    applicationId: v.id("applications"),
    fieldNo: v.string(),
    splitNo: v.string(),
    cropSeason: v.string(),
    location: v.optional(v.string()),
    landCategory: v.optional(v.string()),
    mainAreaM2: v.optional(v.number()),
    cropAreaM2: v.optional(v.number()),
    cropName: v.optional(v.string()),
    cropType: v.optional(v.string()),
    paymentExcluded: v.optional(v.boolean()),
    continuationExcluded: v.optional(v.boolean()),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_application_key", ["applicationId", "fieldNo", "splitNo", "cropSeason"]),

  uploadedFiles: defineTable({
    applicationId: v.id("applications"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    kind: v.union(v.literal("application_pdf"), v.literal("attachment"), v.literal("export")),
    createdAt: v.number(),
  }).index("by_application", ["applicationId"]),

  ocrJobs: defineTable({
    applicationId: v.id("applications"),
    uploadedFileId: v.id("uploadedFiles"),
    provider: v.union(v.literal("openai"), v.literal("anthropic"), v.literal("gemini")),
    modelId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_status", ["status"]),

  ocrResults: defineTable({
    ocrJobId: v.id("ocrJobs"),
    applicationId: v.id("applications"),
    fieldKey: v.string(),
    label: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.null()),
    confidence: v.number(),
    page: v.optional(v.number()),
    rawText: v.optional(v.string()),
    status: v.union(
      v.literal("suggested"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("edited"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_job", ["ocrJobId"]),

  validationIssues: defineTable({
    applicationId: v.id("applications"),
    fieldKey: v.optional(v.string()),
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("ocr_review")),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_application", ["applicationId"]),

  exportJobs: defineTable({
    applicationId: v.id("applications"),
    format: v.union(v.literal("csv"), v.literal("mcp")),
    status: v.union(v.literal("queued"), v.literal("succeeded"), v.literal("failed")),
    fileName: v.optional(v.string()),
    content: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  }).index("by_application", ["applicationId"]),

  auditLogs: defineTable({
    applicationId: v.optional(v.id("applications")),
    actor: v.optional(v.string()),
    action: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_application", ["applicationId"]),
});
