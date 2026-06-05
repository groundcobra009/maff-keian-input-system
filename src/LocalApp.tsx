import { useEffect, useMemo, useState } from "react";
import type { AppIdentity } from "./auth/AuthShell";
import { ApplicationWorkspace } from "./components/ApplicationWorkspace";
import { AdminDashboard } from "./components/AdminDashboard";
import { initialApplications, initialDetail } from "./lib/localSeed";
import { buildLocalCsv, downloadText } from "./lib/download";
import type { AdminDashboardData, ApplicationDetail, ApplicationStatus, AppRecord, LandParcel, OcrProvider, PrimitiveValue } from "./types";
import type { ValidationIssue } from "./types";

type LocalDraftState = {
  applications: AppRecord[];
  selectedId: string | null;
  details: Record<string, ApplicationDetail>;
};

const localStorageKey = "maff-keian-local-drafts";

export function LocalApp({ identity }: { identity: AppIdentity }) {
  const restored = readLocalDrafts();
  const [applications, setApplications] = useState<AppRecord[]>(restored.applications);
  const [selectedId, setSelectedId] = useState(restored.selectedId);
  const [details, setDetails] = useState<Record<string, ApplicationDetail>>(restored.details);
  const [lastManualSaveAt, setLastManualSaveAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"input" | "admin">("input");
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
    writeLocalDrafts({ applications, selectedId, details });
  }, [applications, selectedId, details]);

  const manualSave = () => {
    writeLocalDrafts({ applications, selectedId, details });
    setLastManualSaveAt(Date.now());
  };

  const adminData = useMemo(() => buildLocalAdminData(applications, details), [applications, details]);

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
      onCreate={() => {
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
      }}
      onSaveField={(fieldKey, value) => {
        patchDetail((current) => {
          const exists = current.values.some((item) => item.fieldKey === fieldKey);
          const values = exists
            ? current.values.map((item) => (item.fieldKey === fieldKey ? { ...item, value, source: "manual" as const, status: "draft" as const } : item))
            : [...current.values, { fieldKey, value, source: "manual" as const, status: "draft" as const }];
          return touch({ ...current, values });
        });
      }}
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
            ["application.managementCode", "地域協議会等管理コードは必須です"],
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
        const csv = buildLocalCsv(valueMap, detail.application.year);
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

function buildLocalAdminData(applications: AppRecord[], details: Record<string, ApplicationDetail>): AdminDashboardData {
  const statusCounts: Record<string, number> = {};
  for (const application of applications) statusCounts[application.status] = (statusCounts[application.status] ?? 0) + 1;
  const allIssues = Object.values(details).flatMap((detail) => detail.issues);
  return {
    generatedAt: Date.now(),
    statusCounts,
    ocrCounts: {},
    exportCounts: {},
    issueCounts: {
      errors: allIssues.filter((issue) => issue.severity === "error").length,
      warnings: allIssues.filter((issue) => issue.severity !== "error").length,
    },
    applications: applications.map((application) => {
      const detail = details[application.id];
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
      };
    }),
    recentAuditLogs: [],
  };
}

function ViewSwitcher({ view, onChange }: { view: "input" | "admin"; onChange: (view: "input" | "admin") => void }) {
  return (
    <div className="view-switcher">
      <button className={view === "input" ? "active" : ""} onClick={() => onChange("input")}>
        申請入力
      </button>
      <button className={view === "admin" ? "active" : ""} onClick={() => onChange("admin")}>
        管理
      </button>
    </div>
  );
}
