import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractFields } from "./aiProviders";

export const createJob = mutation({
  args: {
    applicationId: v.id("applications"),
    uploadedFileId: v.id("uploadedFiles"),
    provider: v.union(v.literal("openai"), v.literal("anthropic"), v.literal("gemini")),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const jobId = await ctx.db.insert("ocrJobs", {
      applicationId: args.applicationId,
      uploadedFileId: args.uploadedFileId,
      provider: args.provider,
      modelId: args.modelId,
      status: "queued",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.db.patch(args.applicationId, { status: "ocr_draft", updatedAt: timestamp });
    return jobId;
  },
});

export const runJob = action({
  args: { ocrJobId: v.id("ocrJobs") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.ocr.updateJobStatus, {
      ocrJobId: args.ocrJobId,
      status: "running",
    });
    const job = await ctx.runQuery(internal.ocr.getJobForRun, { ocrJobId: args.ocrJobId });
    if (!job) throw new Error("OCR job not found");
    try {
      const blob = await ctx.storage.get(job.file.storageId);
      if (!blob) throw new Error("Uploaded file not found");
      const fileBase64 = bufferToBase64(await blob.arrayBuffer());
      const fields = await extractFields({
        provider: job.job.provider,
        modelId: job.job.modelId,
        filename: job.file.filename,
        contentType: job.file.contentType,
        fileBase64,
      });
      await ctx.runMutation(internal.ocr.replaceResults, {
        ocrJobId: args.ocrJobId,
        applicationId: job.job.applicationId,
        fields,
      });
      await ctx.runMutation(internal.ocr.updateJobStatus, {
        ocrJobId: args.ocrJobId,
        status: "succeeded",
      });
      return { extracted: fields.length };
    } catch (error) {
      await ctx.runMutation(internal.ocr.updateJobStatus, {
        ocrJobId: args.ocrJobId,
        status: "failed",
        error: error instanceof Error ? error.message : "OCR failed",
      });
      throw error;
    }
  },
});

export const acceptResult = mutation({
  args: {
    resultId: v.id("ocrResults"),
    value: v.union(v.string(), v.number(), v.boolean(), v.null()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) throw new Error("OCR result not found");
    const existing = await ctx.db
      .query("applicationValues")
      .withIndex("by_application_field", (q) =>
        q.eq("applicationId", result.applicationId).eq("fieldKey", result.fieldKey),
      )
      .unique();
    const timestamp = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        source: "ocr",
        confidence: result.confidence,
        status: "confirmed",
        updatedAt: timestamp,
        updatedBy: "local-user",
      });
    } else {
      await ctx.db.insert("applicationValues", {
        applicationId: result.applicationId,
        fieldKey: result.fieldKey,
        value: args.value,
        source: "ocr",
        confidence: result.confidence,
        status: "confirmed",
        updatedAt: timestamp,
        updatedBy: "local-user",
      });
    }
    await ctx.db.patch(args.resultId, {
      value: args.value,
      status: args.value === result.value ? "accepted" : "edited",
      updatedAt: timestamp,
    });
    await ctx.db.patch(result.applicationId, { updatedAt: timestamp });
  },
});

export const rejectResult = mutation({
  args: { resultId: v.id("ocrResults") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.resultId, { status: "rejected", updatedAt: Date.now() });
  },
});

export const getJobForRun = internalQuery({
  args: { ocrJobId: v.id("ocrJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.ocrJobId);
    if (!job) return null;
    const file = await ctx.db.get(job.uploadedFileId);
    if (!file) return null;
    return { job, file };
  },
});

export const updateJobStatus = internalMutation({
  args: {
    ocrJobId: v.id("ocrJobs"),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ocrJobId, {
      status: args.status,
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const replaceResults = internalMutation({
  args: {
    ocrJobId: v.id("ocrJobs"),
    applicationId: v.id("applications"),
    fields: v.array(
      v.object({
        fieldKey: v.string(),
        label: v.string(),
        value: v.union(v.string(), v.number(), v.boolean(), v.null()),
        confidence: v.number(),
        page: v.optional(v.number()),
        rawText: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ocrResults")
      .withIndex("by_job", (q) => q.eq("ocrJobId", args.ocrJobId))
      .collect();
    await Promise.all(existing.map((result) => ctx.db.delete(result._id)));
    const timestamp = Date.now();
    for (const field of args.fields) {
      await ctx.db.insert("ocrResults", {
        ocrJobId: args.ocrJobId,
        applicationId: args.applicationId,
        fieldKey: field.fieldKey,
        label: field.label,
        value: field.value,
        confidence: field.confidence,
        page: field.page,
        rawText: field.rawText,
        status: "suggested",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

function bufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
