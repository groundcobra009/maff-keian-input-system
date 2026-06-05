import type { AdminDashboardData, ApplicationStatus } from "../types";

const names = [
  "農林 太郎",
  "霞ヶ関 花子",
  "水田 一郎",
  "稲作 美咲",
  "大豆 健太",
  "麦田 陽子",
  "里山 誠",
  "青田 直子",
  "畑作 裕介",
  "新市場 真央",
];

const councils = ["北海道協議会", "東北水田協議会", "関東農業再生協", "北陸営農協議会", "九州地域協議会"];

const statuses: ApplicationStatus[] = [
  "draft",
  "draft",
  "ocr_draft",
  "needs_review",
  "returned",
  "submitted",
  "accepted",
  "export_ready",
  "exported",
  "withdrawn",
];

const subsidyPrograms = [
  { fieldKey: "application.applyWaterDirectPayment", label: "水田活用の直接支払交付金" },
  { fieldKey: "application.applyNewMarketRice", label: "コメ新市場開拓等促進事業" },
  { fieldKey: "application.applyFieldCropFormation", label: "畑作物産地形成促進事業" },
  { fieldKey: "application.applyFieldConversion", label: "畑地化促進事業" },
  { fieldKey: "application.applyGeta", label: "畑作物の直接支払交付金（ゲタ）" },
  { fieldKey: "application.applyNarashi", label: "収入減少影響緩和交付金（ナラシ）" },
];

export function buildDemoAdminData(count = 30): AdminDashboardData {
  const baseTime = Date.now();
  const applications = Array.from({ length: count }, (_, index) => {
    const status = statuses[index % statuses.length];
    const errorCount = index % 6 === 0 ? 2 : index % 5 === 0 ? 1 : 0;
    const warningCount = index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0;
    const updatedAt = baseTime - index * 1000 * 60 * 44;
    const totalAreaM2 = 1800 + (index % 8) * 420 + Math.floor(index / 3) * 120;
    const cropAreaM2 = Math.round(totalAreaM2 * (0.82 + (index % 4) * 0.03));
    const selectedPrograms = subsidyPrograms.filter((_, programIndex) => (index + programIndex) % 3 === 0).map((program) => program.fieldKey);
    return {
      id: `demo-application-${String(index + 1).padStart(2, "0")}`,
      title: `令和9年産 交付申請 / ${names[index % names.length]}`,
      year: "2027",
      status,
      currentStep: index % 3 === 0 ? "ocr_review" : index % 3 === 1 ? "programs" : "applicant",
      createdBy: councils[index % councils.length],
      createdAt: updatedAt - 1000 * 60 * 60 * 24 * (index % 8),
      updatedAt,
      submittedAt: ["submitted", "accepted", "export_ready", "exported"].includes(status) ? updatedAt - 1000 * 60 * 80 : undefined,
      errorCount,
      warningCount,
      ocrJobCount: index % 2 === 0 ? 1 : 0,
      exportJobCount: status === "exported" || status === "export_ready" ? 1 : 0,
      totalAreaM2,
      cropAreaM2,
      subsidyPrograms: selectedPrograms,
    };
  });

  const statusCounts = applications.reduce<Record<string, number>>((counts, application) => {
    counts[application.status] = (counts[application.status] ?? 0) + 1;
    return counts;
  }, {});

  const issueCounts = applications.reduce(
    (counts, application) => ({
      errors: counts.errors + application.errorCount,
      warnings: counts.warnings + application.warningCount,
    }),
    { errors: 0, warnings: 0 },
  );

  const exportSuccessCount = applications.filter((application) => application.exportJobCount > 0).length;
  const ocrSuccessCount = applications.filter((application) => application.ocrJobCount > 0).length;
  const areaSummary = applications.reduce(
    (summary, application) => ({
      totalAreaM2: summary.totalAreaM2 + (application.totalAreaM2 ?? 0),
      cropAreaM2: summary.cropAreaM2 + (application.cropAreaM2 ?? 0),
      applicationCountWithArea:
        summary.applicationCountWithArea + ((application.totalAreaM2 ?? 0) > 0 || (application.cropAreaM2 ?? 0) > 0 ? 1 : 0),
    }),
    { totalAreaM2: 0, cropAreaM2: 0, applicationCountWithArea: 0 },
  );
  const subsidyCounts = subsidyPrograms.map((program) => ({
    ...program,
    count: applications.filter((application) => application.subsidyPrograms?.includes(program.fieldKey)).length,
  }));

  return {
    generatedAt: baseTime,
    statusCounts,
    ocrCounts: {
      succeeded: ocrSuccessCount,
      queued: 3,
      failed: 1,
    },
    exportCounts: {
      succeeded: exportSuccessCount,
      queued: 2,
    },
    issueCounts,
    areaSummary,
    subsidyCounts,
    councilSettings: {
      councilName: "関東農業再生協",
      prefectureCode: "13",
      councilCode: "001",
      managementCode: "0000000000001",
      updatedAt: baseTime,
      updatedBy: "demo",
    },
    adminUsers: [
      {
        id: "demo-admin-1",
        email: "nakashima.keitarou@gmail.com",
        role: "owner",
        addedAt: baseTime,
        addedBy: "demo",
      },
      {
        id: "demo-admin-2",
        email: "keian",
        role: "admin",
        addedAt: baseTime,
        addedBy: "demo",
      },
    ],
    applications,
    recentAuditLogs: applications.slice(0, 12).map((application, index) => ({
      id: `demo-audit-${index + 1}`,
      applicationId: application.id,
      actor: index % 2 === 0 ? "keian" : application.createdBy,
      action: index % 3 === 0 ? "application.create" : index % 3 === 1 ? "validation.run" : "admin.status.update",
      detail: application.title,
      createdAt: application.updatedAt,
    })),
  };
}
