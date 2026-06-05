import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const now = () => Date.now();

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("applications").order("desc").take(50);
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    const values = await ctx.db
      .query("applicationValues")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const parcels = await ctx.db
      .query("landParcels")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const ocrJobs = await ctx.db
      .query("ocrJobs")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .order("desc")
      .take(10);
    const ocrResults = await ctx.db
      .query("ocrResults")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const issues = await ctx.db
      .query("validationIssues")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const exports = await ctx.db
      .query("exportJobs")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .order("desc")
      .take(10);
    return { application, values, parcels, ocrJobs, ocrResults, issues, exports };
  },
});

export const create = mutation({
  args: {
    year: v.string(),
    title: v.string(),
    applicantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const applicationId = await ctx.db.insert("applications", {
      year: args.year,
      status: "draft",
      title: args.title,
      currentStep: "applicant",
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: "local-user",
    });
    if (args.applicantName) {
      await ctx.db.insert("applicationValues", {
        applicationId,
        fieldKey: "applicant.nameKanji",
        value: args.applicantName,
        source: "manual",
        status: "draft",
        updatedAt: timestamp,
        updatedBy: "local-user",
      });
    }
    await ctx.db.insert("auditLogs", {
      applicationId,
      actor: "local-user",
      action: "application.create",
      detail: args.title,
      createdAt: timestamp,
    });
    return applicationId;
  },
});

export const saveField = mutation({
  args: {
    applicationId: v.id("applications"),
    fieldKey: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.null()),
    source: v.optional(v.union(v.literal("manual"), v.literal("ocr"), v.literal("copied"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("applicationValues")
      .withIndex("by_application_field", (q) =>
        q.eq("applicationId", args.applicationId).eq("fieldKey", args.fieldKey),
      )
      .unique();
    const timestamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        source: args.source ?? "manual",
        status: "draft",
        updatedAt: timestamp,
        updatedBy: "local-user",
      });
    } else {
      await ctx.db.insert("applicationValues", {
        applicationId: args.applicationId,
        fieldKey: args.fieldKey,
        value: args.value,
        source: args.source ?? "manual",
        status: "draft",
        updatedAt: timestamp,
        updatedBy: "local-user",
      });
    }
    await ctx.db.patch(args.applicationId, { updatedAt: timestamp });
  },
});

export const upsertParcel = mutation({
  args: {
    applicationId: v.id("applications"),
    parcelId: v.optional(v.id("landParcels")),
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
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const doc = {
      applicationId: args.applicationId,
      fieldNo: args.fieldNo,
      splitNo: args.splitNo,
      cropSeason: args.cropSeason,
      location: args.location,
      landCategory: args.landCategory,
      mainAreaM2: args.mainAreaM2,
      cropAreaM2: args.cropAreaM2,
      cropName: args.cropName,
      cropType: args.cropType,
      paymentExcluded: args.paymentExcluded,
      continuationExcluded: args.continuationExcluded,
      note: args.note,
      updatedAt: timestamp,
    };
    if (args.parcelId) {
      await ctx.db.patch(args.parcelId, doc);
      await ctx.db.patch(args.applicationId, { updatedAt: timestamp });
      return args.parcelId;
    }
    const parcelId = await ctx.db.insert("landParcels", doc);
    await ctx.db.patch(args.applicationId, { updatedAt: timestamp });
    return parcelId;
  },
});

export const removeParcel = mutation({
  args: { parcelId: v.id("landParcels"), applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.parcelId);
    await ctx.db.patch(args.applicationId, { updatedAt: now() });
  },
});

export const validate = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const timestamp = now();
    const currentIssues = await ctx.db
      .query("validationIssues")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    await Promise.all(currentIssues.map((issue) => ctx.db.delete(issue._id)));

    const values = await ctx.db
      .query("applicationValues")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const valueMap = new Map(values.map((item) => [item.fieldKey, item.value]));
    const required = [
      ["applicant.nameKanji", "交付申請者名（漢字）は必須です"],
      ["applicant.nameKana", "交付申請者名（フリガナ）は必須です"],
      ["applicant.postalCode", "郵便番号は必須です"],
      ["applicant.phone", "電話番号は必須です"],
    ];

    let errorCount = 0;
    for (const [fieldKey, message] of required) {
      const value = valueMap.get(fieldKey);
      if (value === undefined || value === null || value === "") {
        errorCount += 1;
        await ctx.db.insert("validationIssues", {
          applicationId: args.applicationId,
          fieldKey,
          severity: "error",
          message,
          createdAt: timestamp,
        });
      }
    }

    const postalCode = String(valueMap.get("applicant.postalCode") ?? "");
    if (postalCode && !/^\d{3}-?\d{4}$/.test(postalCode)) {
      errorCount += 1;
      await ctx.db.insert("validationIssues", {
        applicationId: args.applicationId,
        fieldKey: "applicant.postalCode",
        severity: "error",
        message: "郵便番号は999-9999形式で入力してください",
        createdAt: timestamp,
      });
    }

    const ocrReview = await ctx.db
      .query("ocrResults")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .filter((q) => q.eq(q.field("status"), "suggested"))
      .collect();
    for (const result of ocrReview) {
      await ctx.db.insert("validationIssues", {
        applicationId: args.applicationId,
        fieldKey: result.fieldKey,
        severity: "ocr_review",
        message: `${result.label} のOCR候補が未確認です`,
        createdAt: timestamp,
      });
    }

    return { errorCount, ocrReviewCount: ocrReview.length };
  },
});

export const submit = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const timestamp = now();
    await ctx.db.patch(args.applicationId, {
      status: "submitted",
      submittedAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.db.insert("auditLogs", {
      applicationId: args.applicationId,
      actor: "local-user",
      action: "application.submit",
      createdAt: timestamp,
    });
  },
});
