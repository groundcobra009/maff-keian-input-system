import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const applicationStatus = v.union(
  v.literal("draft"),
  v.literal("ocr_draft"),
  v.literal("needs_review"),
  v.literal("returned"),
  v.literal("submitted"),
  v.literal("accepted"),
  v.literal("export_ready"),
  v.literal("exported"),
  v.literal("withdrawn"),
);

const subsidyPrograms = [
  { fieldKey: "application.applyWaterDirectPayment", label: "水田活用の直接支払交付金" },
  { fieldKey: "application.applyNewMarketRice", label: "コメ新市場開拓等促進事業" },
  { fieldKey: "application.applyFieldCropFormation", label: "畑作物産地形成促進事業" },
  { fieldKey: "application.applyFieldConversion", label: "畑地化促進事業" },
  { fieldKey: "application.applyGeta", label: "畑作物の直接支払交付金（ゲタ）" },
  { fieldKey: "application.applyNarashi", label: "収入減少影響緩和交付金（ナラシ）" },
];

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const [applications, ocrJobs, exportJobs, issues, auditLogs] = await Promise.all([
      ctx.db.query("applications").order("desc").take(200),
      ctx.db.query("ocrJobs").order("desc").take(200),
      ctx.db.query("exportJobs").order("desc").take(200),
      ctx.db.query("validationIssues").order("desc").take(300),
      ctx.db.query("auditLogs").order("desc").take(50),
    ]);

    const issueCountByApplication = new Map<string, { errors: number; warnings: number }>();
    for (const issue of issues) {
      const current = issueCountByApplication.get(issue.applicationId) ?? { errors: 0, warnings: 0 };
      if (issue.severity === "error") current.errors += 1;
      else current.warnings += 1;
      issueCountByApplication.set(issue.applicationId, current);
    }

    const exportCountByApplication = new Map<string, number>();
    for (const job of exportJobs) {
      exportCountByApplication.set(job.applicationId, (exportCountByApplication.get(job.applicationId) ?? 0) + 1);
    }

    const ocrCountByApplication = new Map<string, number>();
    for (const job of ocrJobs) {
      ocrCountByApplication.set(job.applicationId, (ocrCountByApplication.get(job.applicationId) ?? 0) + 1);
    }

    const statusCounts: Record<string, number> = {};
    for (const application of applications) {
      statusCounts[application.status] = (statusCounts[application.status] ?? 0) + 1;
    }

    const ocrCounts: Record<string, number> = {};
    for (const job of ocrJobs) {
      ocrCounts[job.status] = (ocrCounts[job.status] ?? 0) + 1;
    }

    const exportCounts: Record<string, number> = {};
    for (const job of exportJobs) {
      exportCounts[job.status] = (exportCounts[job.status] ?? 0) + 1;
    }

    const valueEntries = await Promise.all(
      applications.map(async (application) => [
        application._id,
        await ctx.db
          .query("applicationValues")
          .withIndex("by_application", (q) => q.eq("applicationId", application._id))
          .collect(),
      ] as const),
    );
    const parcelEntries = await Promise.all(
      applications.map(async (application) => [
        application._id,
        await ctx.db
          .query("landParcels")
          .withIndex("by_application", (q) => q.eq("applicationId", application._id))
          .collect(),
      ] as const),
    );
    const valuesByApplication = new Map(valueEntries);
    const parcelsByApplication = new Map(parcelEntries);
    const areaByApplication = new Map<string, { totalAreaM2: number; cropAreaM2: number }>();
    const subsidyProgramsByApplication = new Map<string, string[]>();
    for (const application of applications) {
      const parcels = parcelsByApplication.get(application._id) ?? [];
      const totalAreaM2 = parcels.reduce((sum, parcel) => sum + (parcel.mainAreaM2 ?? 0), 0);
      const cropAreaM2 = parcels.reduce((sum, parcel) => sum + (parcel.cropAreaM2 ?? 0), 0);
      areaByApplication.set(application._id, { totalAreaM2, cropAreaM2 });

      const values = valuesByApplication.get(application._id) ?? [];
      subsidyProgramsByApplication.set(
        application._id,
        subsidyPrograms
          .filter((program) => values.some((value) => value.fieldKey === program.fieldKey && value.value === "1"))
          .map((program) => program.fieldKey),
      );
    }
    const areaSummary = Array.from(areaByApplication.values()).reduce(
      (summary, area) => ({
        totalAreaM2: summary.totalAreaM2 + area.totalAreaM2,
        cropAreaM2: summary.cropAreaM2 + area.cropAreaM2,
        applicationCountWithArea: summary.applicationCountWithArea + (area.totalAreaM2 > 0 || area.cropAreaM2 > 0 ? 1 : 0),
      }),
      { totalAreaM2: 0, cropAreaM2: 0, applicationCountWithArea: 0 },
    );
    const subsidyCounts = subsidyPrograms.map((program) => ({
      ...program,
      count: Array.from(subsidyProgramsByApplication.values()).filter((programs) => programs.includes(program.fieldKey)).length,
    }));

    return {
      generatedAt: Date.now(),
      statusCounts,
      ocrCounts,
      exportCounts,
      issueCounts: {
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity !== "error").length,
      },
      areaSummary,
      subsidyCounts,
      applications: applications.map((application) => {
        const issueCount = issueCountByApplication.get(application._id) ?? { errors: 0, warnings: 0 };
        const area = areaByApplication.get(application._id) ?? { totalAreaM2: 0, cropAreaM2: 0 };
        return {
          id: application._id,
          title: application.title,
          year: application.year,
          status: application.status,
          currentStep: application.currentStep,
          createdBy: application.createdBy,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
          submittedAt: application.submittedAt,
          errorCount: issueCount.errors,
          warningCount: issueCount.warnings,
          ocrJobCount: ocrCountByApplication.get(application._id) ?? 0,
          exportJobCount: exportCountByApplication.get(application._id) ?? 0,
          totalAreaM2: area.totalAreaM2,
          cropAreaM2: area.cropAreaM2,
          subsidyPrograms: subsidyProgramsByApplication.get(application._id) ?? [],
        };
      }),
      recentAuditLogs: auditLogs.map((log) => ({
        id: log._id,
        applicationId: log.applicationId,
        actor: log.actor,
        action: log.action,
        detail: log.detail,
        createdAt: log.createdAt,
      })),
    };
  },
});

export const setApplicationStatus = mutation({
  args: {
    applicationId: v.id("applications"),
    status: applicationStatus,
    actor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    await ctx.db.patch(args.applicationId, {
      status: args.status,
      updatedAt: timestamp,
    });
    await ctx.db.insert("auditLogs", {
      applicationId: args.applicationId,
      actor: args.actor ?? "admin",
      action: "admin.status.update",
      detail: args.status,
      createdAt: timestamp,
    });
  },
});
