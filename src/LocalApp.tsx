import { useEffect, useMemo, useState } from "react";
import type { AppIdentity } from "./auth/AuthShell";
import { ApplicationWorkspace } from "./components/ApplicationWorkspace";
import { AdminDashboard } from "./components/AdminDashboard";
import { ChatApplicationMode } from "./components/ChatApplicationMode";
import { initialApplications, initialDetail } from "./lib/localSeed";
import { buildLocalCsv, downloadText } from "./lib/download";
import type { AdminDashboardData, AdminUser, ApplicationDetail, ApplicationStatus, AppRecord, CouncilSettings, LandParcel, OcrProvider, PrimitiveValue } from "./types";
import type { ValidationIssue } from "./types";

type LocalDraftState = {
  applications: AppRecord[];
  selectedId: string | null;
  details: Record<string, ApplicationDetail>;
  councilSettings?: CouncilSettings;
  adminUsers?: AdminUser[];
};

const localStorageKey = "maff-keian-local-drafts";
const subsidyPrograms = [
  { fieldKey: "application.applyWaterDirectPayment", label: "水田活用の直接支払交付金" },
  { fieldKey: "application.applyNewMarketRice", label: "コメ新市場開拓等促進事業" },
  { fieldKey: "application.applyFieldCropFormation", label: "畑作物産地形成促進事業" },
  { fieldKey: "application.applyFieldConversion", label: "畑地化促進事業" },
  { fieldKey: "application.applyGeta", label: "畑作物の直接支払交付金（ゲタ）" },
  { fieldKey: "application.applyNarashi", label: "収入減少影響緩和交付金（ナラシ）" },
];

export function LocalApp({ identity }: { identity: AppIdentity }) {
  const restored = readLocalDrafts();
  const [applications, setApplications] = useState<AppRecord[]>(restored.applications);
  const [selectedId, setSelectedId] = useState(restored.selectedId);
  const [details, setDetails] = useState<Record<string, ApplicationDetail>>(restored.details);
  const [councilSettings, setCouncilSettings] = useState<CouncilSettings>(restored.councilSettings ?? {});
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(restored.adminUsers ?? []);
  const [lastManualSaveAt, setLastManualSaveAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<AppView>("input");
  const detail = selectedId ? details[selectedId] ?? null : null;

  const valueMap = useMemo(() => new Map(detail?.values.map((item) => [item.fieldKey, item.value]) ?? []), [detail]);

  const patchDetail = (updater: (current: ApplicationDetail) => ApplicationDetail) => {
    if (!selectedId || !details[selectedId]) return;
    const updated = updater(details[selectedId]);
    setDetails((current) => ({ ...current, [selectedId]: updated }));
    setApplications((current) =>
      current.map((item) => (item.id === selectedId ? { ...updated.application, updatedAt: updated.application.updatedAt } : item)),
    );
  };

  useEffect(() => {
    writeLocalDrafts({ applications, selectedId, details, councilSettings, adminUsers });
  }, [adminUsers, applications, councilSettings, selectedId, details]);

  const manualSave = () => {
    writeLocalDrafts({ applications, selectedId, details, councilSettings, adminUsers });
    setLastManualSaveAt(Date.now());
  };

  const adminData = useMemo(() => buildLocalAdminData(applications, details, councilSettings, adminUsers), [adminUsers, applications, councilSettings, details]);

  const createDraft = () => {
    const id = crypto.randomUUID();
    const app: AppRecord = {
      id,
      title: `令和9年産 交付申請 / 新規`,
      year: "2027",
      status: "draft",
      updatedAt: Date.now(),
    };
    setApplications((current) => [app, ...current]);
    setDetails((current) => ({
      ...current,
      [id]: { application: app, values: [], parcels: [], ocrResults: [], issues: [] },
    }));
    setSelectedId(id);
  };

  const saveFieldValue = (fieldKey: string, value: PrimitiveValue) => {
    patchDetail((current) => {
      const exists = current.values.some((item) => item.fieldKey === fieldKey);
      const values = exists
        ? current.values.map((item) => (item.fieldKey === fieldKey ? { ...item, value, source: "manual" as const, status: "draft" as const } : item))
        : [...current.values, { fieldKey, value, source: "manual" as const, status: "draft" as const }];
      return touch({ ...current, values });
    });
  };

  return (
    <>
      <ViewSwitcher view={view} onChange={setView} />
      {view === "admin" ? (
        <AdminDashboard
          mode="local"
          identity={identity}
          data={adminData}
          onStatusChange={(applicationId, status) => {
            setApplications((current) => current.map((item) => (item.id === applicationId ? { ...item, status, updatedAt: Date.now() } : item)));
            setDetails((current) => {
              const target = current[applicationId];
              if (!target) return current;
              return {
                ...current,
                [applicationId]: touch({ ...target, application: { ...target.application, status } }),
              };
            });
          }}
          onSaveCouncilSettings={(settings) => {
            setCouncilSettings({ ...settings, updatedAt: Date.now(), updatedBy: identity.email ?? identity.displayName });
          }}
          onAddAdminUser={(email) => {
            const normalized = email.trim().toLowerCase();
            if (!normalized) return;
            setAdminUsers((current) => {
              if (current.some((user) => user.email === normalized)) return current;
              return [
                {
                  id: crypto.randomUUID(),
                  email: normalized,
                  role: "admin",
                  addedAt: Date.now(),
                  addedBy: identity.email ?? identity.displayName,
                },
                ...current,
              ];
            });
          }}
          onRemoveAdminUser={(adminUserId) => {
            setAdminUsers((current) => current.filter((user) => user.id !== adminUserId));
          }}
        />
      ) : view === "chat" ? (
        <ChatApplicationMode
          mode="local"
          identity={identity}
          detail={detail}
          selectedId={selectedId}
          onCreate={createDraft}
          onSaveField={saveFieldValue}
        />
      ) : (
    <ApplicationWorkspace
      mode="local"
      identity={identity}
      applications={applications}
      detail={detail}
      selectedId={selectedId}
      busy={busy}
      lastManualSaveAt={lastManualSaveAt}
      onSelect={setSelectedId}
      onManualSave={manualSave}
      onCreate={createDraft}
      onSaveField={saveFieldValue}
      onUpsertParcel={(parcel) => {
        patchDetail((current) => {
          const exists = current.parcels.some((item) => item.id === parcel.id);
          return touch({
            ...current,
            parcels: exists ? current.parcels.map((item) => (item.id === parcel.id ? parcel : item)) : [...current.parcels, parcel],
          });
        });
      }}
      onRemoveParcel={(parcelId) => {
        patchDetail((current) => touch({ ...current, parcels: current.parcels.filter((item) => item.id !== parcelId) }));
      }}
      onUploadOcr={async (file, provider: OcrProvider, modelId) => {
        setBusy(true);
        await new Promise((resolve) => setTimeout(resolve, 700));
        patchDetail((current) =>
          touch({
            ...current,
            application: { ...current.application, status: "ocr_draft" },
            ocrResults: [
              ...current.ocrResults,
              {
                id: crypto.randomUUID(),
                fieldKey: "applicant.nameKanji",
                label: "交付申請者名（漢字）",
                value: provider === "anthropic" ? "農林 花子" : "農林 太郎",
                confidence: modelId.includes("flash") ? 0.72 : 0.86,
                page: 1,
                status: "suggested",
              },
              {
                id: crypto.randomUUID(),
                fieldKey: "application.applyNarashi",
                label: "収入減少影響緩和交付金（ナラシ）の申請",
                value: "1",
                confidence: 0.63,
                page: 2,
                status: "suggested",
              },
            ],
          }),
        );
        console.info(`local OCR draft created from ${file.name}`);
        setBusy(false);
      }}
      onAcceptOcr={(resultId, value) => {
        patchDetail((current) => {
          const result = current.ocrResults.find((item) => item.id === resultId);
          if (!result) return current;
          const exists = current.values.some((item) => item.fieldKey === result.fieldKey);
          return touch({
            ...current,
            values: exists
              ? current.values.map((item) =>
                  item.fieldKey === result.fieldKey ? { ...item, value, source: "ocr" as const, confidence: result.confidence, status: "confirmed" as const } : item,
                )
              : [...current.values, { fieldKey: result.fieldKey, value, source: "ocr" as const, confidence: result.confidence, status: "confirmed" as const }],
            ocrResults: current.ocrResults.map((item) => (item.id === resultId ? { ...item, value, status: "accepted" as const } : item)),
          });
        });
      }}
      onRejectOcr={(resultId) => {
        patchDetail((current) =>
          touch({
            ...current,
            ocrResults: current.ocrResults.map((item) => (item.id === resultId ? { ...item, status: "rejected" as const } : item)),
          }),
        );
      }}
      onValidate={() => {
        patchDetail((current) => {
          const required = [
            ["applicant.nameKana", "交付申請者名（フリガナ）は必須です"],
            ["applicant.nameKanji", "交付申請者名（漢字）は必須です"],
            ["applicant.phone", "電話番号は必須です"],
          ];
          const issues: ValidationIssue[] = required
            .filter(([key]) => !valueMap.get(key))
            .map(([, message]) => ({
              id: crypto.randomUUID(),
              severity: "error" as const,
              message,
            }));
          current.ocrResults
            .filter((item) => item.status === "suggested")
            .forEach((item) => issues.push({ id: crypto.randomUUID(), severity: "ocr_review", message: `${item.label} のOCR候補が未確認です` }));
          return touch({ ...current, issues });
        });
      }}
      onSubmit={() => {
        patchDetail((current) => touch({ ...current, application: { ...current.application, status: "submitted" } }));
      }}
      onExportCsv={() => {
        if (!detail) return;
        const csv = buildLocalCsv(valueMap, detail.application.year, councilSettings);
        downloadText(`common_application_${detail.application.year}_${detail.application.id}.csv`, csv);
        patchDetail((current) => touch({ ...current, application: { ...current.application, status: "exported" } }));
      }}
    />
      )}
    </>
  );
}

function touch(detail: ApplicationDetail): ApplicationDetail {
  return {
    ...detail,
    application: {
      ...detail.application,
      updatedAt: Date.now(),
    },
  };
}

function readLocalDrafts(): LocalDraftState {
  try {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) throw new Error("No local drafts");
    const parsed = JSON.parse(raw) as LocalDraftState;
    if (!Array.isArray(parsed.applications) || !parsed.details) throw new Error("Invalid local drafts");
    return parsed;
  } catch {
    return {
      applications: initialApplications,
      selectedId: initialApplications[0]?.id ?? null,
      details: {
        [initialDetail.application.id]: initialDetail,
      },
    };
  }
}

function writeLocalDrafts(state: LocalDraftState) {
  window.localStorage.setItem(localStorageKey, JSON.stringify(state));
}

function buildLocalAdminData(
  applications: AppRecord[],
  details: Record<string, ApplicationDetail>,
  councilSettings: CouncilSettings,
  adminUsers: AdminUser[],
): AdminDashboardData {
  const statusCounts: Record<string, number> = {};
  for (const application of applications) statusCounts[application.status] = (statusCounts[application.status] ?? 0) + 1;
  const allIssues = Object.values(details).flatMap((detail) => detail.issues);
  const areaSummary = Object.values(details).reduce(
    (summary, detail) => {
      const totalAreaM2 = detail.parcels.reduce((sum, parcel) => sum + (parcel.mainAreaM2 ?? 0), 0);
      const cropAreaM2 = detail.parcels.reduce((sum, parcel) => sum + (parcel.cropAreaM2 ?? 0), 0);
      return {
        totalAreaM2: summary.totalAreaM2 + totalAreaM2,
        cropAreaM2: summary.cropAreaM2 + cropAreaM2,
        applicationCountWithArea: summary.applicationCountWithArea + (totalAreaM2 > 0 || cropAreaM2 > 0 ? 1 : 0),
      };
    },
    { totalAreaM2: 0, cropAreaM2: 0, applicationCountWithArea: 0 },
  );
  const subsidyCounts = subsidyPrograms.map((program) => ({
    ...program,
    count: Object.values(details).filter((detail) => detail.values.some((value) => value.fieldKey === program.fieldKey && value.value === "1")).length,
  }));
  return {
    generatedAt: Date.now(),
    statusCounts,
    ocrCounts: {},
    exportCounts: {},
    issueCounts: {
      errors: allIssues.filter((issue) => issue.severity === "error").length,
      warnings: allIssues.filter((issue) => issue.severity !== "error").length,
    },
    areaSummary,
    subsidyCounts,
    councilSettings,
    adminUsers,
    applications: applications.map((application) => {
      const detail = details[application.id];
      const totalAreaM2 = detail?.parcels.reduce((sum, parcel) => sum + (parcel.mainAreaM2 ?? 0), 0) ?? 0;
      const cropAreaM2 = detail?.parcels.reduce((sum, parcel) => sum + (parcel.cropAreaM2 ?? 0), 0) ?? 0;
      return {
        id: application.id,
        title: application.title,
        year: application.year,
        status: application.status,
        currentStep: "local",
        createdAt: application.updatedAt,
        updatedAt: application.updatedAt,
        errorCount: detail?.issues.filter((issue) => issue.severity === "error").length ?? 0,
        warningCount: detail?.issues.filter((issue) => issue.severity !== "error").length ?? 0,
        ocrJobCount: detail?.ocrResults.length ? 1 : 0,
        exportJobCount: application.status === "exported" ? 1 : 0,
        totalAreaM2,
        cropAreaM2,
        subsidyPrograms: subsidyPrograms
          .filter((program) => detail?.values.some((value) => value.fieldKey === program.fieldKey && value.value === "1"))
          .map((program) => program.fieldKey),
      };
    }),
    recentAuditLogs: [],
  };
}

type AppView = "input" | "chat" | "admin";

function ViewSwitcher({ view, onChange }: { view: AppView; onChange: (view: AppView) => void }) {
  return (
    <div className="view-switcher">
      <button className={view === "input" ? "active" : ""} onClick={() => onChange("input")}>
        申請入力
      </button>
      <button className={view === "chat" ? "active" : ""} onClick={() => onChange("chat")}>
        チャット申請
      </button>
      <button className={view === "admin" ? "active" : ""} onClick={() => onChange("admin")}>
        管理
      </button>
    </div>
  );
}
