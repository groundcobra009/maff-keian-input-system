import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

type ExportPayload = {
  application: Doc<"applications">;
  values: Doc<"applicationValues">[];
  councilSettings: Doc<"councilSettings"> | null;
};

type GenerateCsvResult = {
  exportJobId: Id<"exportJobs">;
  fileName: string;
  content: string;
};

const csvColumns = [
  ["1", "ファイル識別コード", "1"],
  ["2", "都道府県コード", "application.prefectureCode"],
  ["3", "地域協議会コード", "application.councilCode"],
  ["4", "地域協議会等管理コード", "application.managementCode"],
  ["5", "申請年産", "application.year"],
  ["6", "申請年月日", "application.submittedDate"],
  ["9", "交付申請者名（フリガナ）", "applicant.nameKana"],
  ["10", "交付申請者名（漢字）", "applicant.nameKanji"],
  ["13", "郵便番号", "applicant.postalCode"],
  ["16", "住所（市区町村以下）", "applicant.address"],
  ["18", "電話番号", "applicant.phone"],
  ["20", "メールアドレス", "applicant.email"],
  ["21", "経営形態", "applicant.businessType"],
  ["38", "水田活用の直接支払交付金申請", "application.applyWaterDirectPayment"],
  ["42", "畑作物の直接支払交付金（ゲタ）の申請", "application.applyGeta"],
  ["43", "収入減少影響緩和交付金（ナラシ）の申請", "application.applyNarashi"],
] as const;

export const generateCsv = action({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args): Promise<GenerateCsvResult> => {
    const payload = (await ctx.runQuery(internal.export.getExportPayload, {
      applicationId: args.applicationId,
    })) as ExportPayload | null;
    if (!payload) throw new Error("Application not found");
    const valueMap = new Map(payload.values.map((item) => [item.fieldKey, item.value]));
    const row = csvColumns.map(([, , key]) => {
      if (key === "1") return "1";
      if (key === "application.year") return payload.application.year;
      if (key === "application.submittedDate") return toDate(new Date());
      if (key === "application.prefectureCode") return payload.councilSettings?.prefectureCode ?? valueMap.get(key) ?? "";
      if (key === "application.councilCode") return payload.councilSettings?.councilCode ?? valueMap.get(key) ?? "";
      if (key === "application.managementCode") return payload.councilSettings?.managementCode ?? valueMap.get(key) ?? "";
      return valueMap.get(key) ?? "";
    });
    const csv = [
      csvColumns.map(([, label]) => quoteCsv(label)).join(","),
      row.map((value) => quoteCsv(String(value))).join(","),
    ].join("\r\n");
    const fileName = `common_application_${payload.application.year}_${payload.application._id}.csv`;
    const exportJobId = await ctx.runMutation(internal.export.saveExportJob, {
      applicationId: args.applicationId,
      fileName,
      content: csv,
    });
    return { exportJobId, fileName, content: csv };
  },
});

export const getExportPayload = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args): Promise<ExportPayload | null> => {
    const application = await ctx.db.get(args.applicationId);
    if (!application) return null;
    const values = await ctx.db
      .query("applicationValues")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const councilSettings = await ctx.db
      .query("councilSettings")
      .withIndex("by_scope", (q) => q.eq("scope", "default"))
      .unique();
    return { application, values, councilSettings };
  },
});

export const saveExportJob = internalMutation({
  args: {
    applicationId: v.id("applications"),
    fileName: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"exportJobs">> => {
    const timestamp = Date.now();
    const exportJobId = await ctx.db.insert("exportJobs", {
      applicationId: args.applicationId,
      format: "csv",
      status: "succeeded",
      fileName: args.fileName,
      content: args.content,
      createdAt: timestamp,
      createdBy: "local-user",
    });
    await ctx.db.patch(args.applicationId, { status: "exported", updatedAt: timestamp });
    await ctx.db.insert("auditLogs", {
      applicationId: args.applicationId,
      actor: "local-user",
      action: "export.csv",
      detail: args.fileName,
      createdAt: timestamp,
    });
    return exportJobId;
  },
});

function quoteCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}
