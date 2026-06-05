import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import type { AppIdentity } from "./auth/AuthShell";
import { AdminDashboard } from "./components/AdminDashboard";
import { ApplicationWorkspace } from "./components/ApplicationWorkspace";
import { ChatApplicationMode } from "./components/ChatApplicationMode";
import { buildDemoAdminData } from "./lib/demoDashboardData";
import { downloadText } from "./lib/download";
import { convexApi } from "./lib/convexRefs";
import type { AdminDashboardData, ApplicationDetail, ApplicationStatus, AppRecord, LandParcel, OcrProvider, PrimitiveValue } from "./types";

export function ConvexApp({ identity }: { identity: AppIdentity }) {
  const rawApplications = useQuery(convexApi.applications.list) ?? [];
  const rawAdminData = useQuery(convexApi.admin.dashboard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedConvexId = selectedId && !selectedId.startsWith("optimistic-") ? selectedId : null;
  const rawDetail = useQuery(convexApi.applications.get, selectedConvexId ? { applicationId: selectedConvexId } : "skip");
  const [busy, setBusy] = useState(false);
  const [optimisticDetail, setOptimisticDetail] = useState<ApplicationDetail | null>(null);

  const createApplication = useMutation(convexApi.applications.create);
  const saveField = useMutation(convexApi.applications.saveField);
  const upsertParcel = useMutation(convexApi.applications.upsertParcel);
  const removeParcel = useMutation(convexApi.applications.removeParcel);
  const validate = useMutation(convexApi.applications.validate);
  const submit = useMutation(convexApi.applications.submit);
  const generateUploadUrl = useMutation(convexApi.files.generateUploadUrl);
  const attachUploadedFile = useMutation(convexApi.files.attachUploadedFile);
  const createOcrJob = useMutation(convexApi.ocr.createJob);
  const runOcrJob = useAction(convexApi.ocr.runJob);
  const acceptOcr = useMutation(convexApi.ocr.acceptResult);
  const rejectOcr = useMutation(convexApi.ocr.rejectResult);
  const generateCsv = useAction(convexApi.export.generateCsv);
  const setApplicationStatus = useMutation(convexApi.admin.setApplicationStatus);
  const [lastManualSaveAt, setLastManualSaveAt] = useState<number | null>(null);
  const [view, setView] = useState<AppView>("input");
  const demoAdminData = useMemo(() => buildDemoAdminData(30), []);
  const adminData = useMemo(() => {
    const data = rawAdminData as AdminDashboardData | undefined;
    return data?.applications?.length ? data : demoAdminData;
  }, [demoAdminData, rawAdminData]);
  const usingDemoAdminData = !rawAdminData || !(rawAdminData as AdminDashboardData).applications?.length;

  const applications = useMemo<AppRecord[]>(
    () =>
      rawApplications.map((item: any) => ({
        id: item._id,
        title: item.title,
        year: item.year,
        status: item.status,
        updatedAt: item.updatedAt,
      })),
    [rawApplications],
  );

  useEffect(() => {
    if (!selectedId && applications[0]) setSelectedId(applications[0].id);
  }, [applications, selectedId]);

  useEffect(() => {
    if (rawDetail && optimisticDetail) setOptimisticDetail(null);
  }, [optimisticDetail, rawDetail]);

  const detail = useMemo<ApplicationDetail | null>(() => {
    if (!rawDetail) return optimisticDetail;
    return {
      application: {
        id: rawDetail.application._id,
        title: rawDetail.application.title,
        year: rawDetail.application.year,
        status: rawDetail.application.status,
        updatedAt: rawDetail.application.updatedAt,
      },
      values: rawDetail.values.map((item: any) => ({
        id: item._id,
        fieldKey: item.fieldKey,
        value: item.value,
        source: item.source,
        confidence: item.confidence,
        status: item.status,
      })),
      parcels: rawDetail.parcels.map((item: any) => ({
        id: item._id,
        fieldNo: item.fieldNo,
        splitNo: item.splitNo,
        cropSeason: item.cropSeason,
        location: item.location,
        landCategory: item.landCategory,
        mainAreaM2: item.mainAreaM2,
        cropAreaM2: item.cropAreaM2,
        cropName: item.cropName,
        cropType: item.cropType,
        paymentExcluded: item.paymentExcluded,
        continuationExcluded: item.continuationExcluded,
        note: item.note,
      })),
      ocrResults: rawDetail.ocrResults.map((item: any) => ({
        id: item._id,
        fieldKey: item.fieldKey,
        label: item.label,
        value: item.value,
        confidence: item.confidence,
        page: item.page,
        status: item.status,
      })),
      issues: rawDetail.issues.map((item: any) => ({
        id: item._id,
        fieldKey: item.fieldKey,
        severity: item.severity,
        message: item.message,
      })),
    };
  }, [optimisticDetail, rawDetail, selectedId]);

  const createDraft = async () => {
    const timestamp = Date.now();
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimisticApplication: AppRecord = {
      id: optimisticId,
      year: "2027",
      title: "令和9年産 交付申請 / 新規",
      status: "draft",
      updatedAt: timestamp,
    };
    setSelectedId(optimisticId);
    setOptimisticDetail({
      application: optimisticApplication,
      values: identity.displayName
        ? [{ fieldKey: "applicant.nameKanji", value: identity.displayName, source: "manual", status: "draft" }]
        : [],
      parcels: [],
      ocrResults: [],
      issues: [],
    });
    const id = await createApplication({
      year: "2027",
      title: "令和9年産 交付申請 / 新規",
      applicantName: identity.displayName,
    });
    setSelectedId(id);
  };

  const saveFieldValue = async (fieldKey: string, value: PrimitiveValue) => {
    if (selectedId?.startsWith("optimistic-")) {
      setOptimisticDetail((current) => {
        if (!current) return current;
        const timestamp = Date.now();
        const exists = current.values.some((item) => item.fieldKey === fieldKey);
        const values = exists
          ? current.values.map((item) => (item.fieldKey === fieldKey ? { ...item, value, source: "manual" as const, status: "draft" as const } : item))
          : [...current.values, { fieldKey, value, source: "manual" as const, status: "draft" as const }];
        return { ...current, values, application: { ...current.application, updatedAt: timestamp } };
      });
      return;
    }
    if (!selectedId) return;
    await saveField({ applicationId: selectedId, fieldKey, value });
  };

  const selectApplication = (applicationId: string) => {
    setOptimisticDetail(null);
    setSelectedId(applicationId);
  };

  return (
    <>
      <ViewSwitcher view={view} onChange={setView} />
      {view === "admin" ? (
        <AdminDashboard
          mode="convex"
          identity={identity}
          data={adminData}
          notice={usingDemoAdminData ? "ダミーデータ30件を表示中です。Convex DBに実データが入ると実データ表示に切り替わります。" : undefined}
          statusReadOnly={usingDemoAdminData}
          onStatusChange={async (applicationId: string, status: ApplicationStatus) => {
            await setApplicationStatus({ applicationId, status, actor: identity.email ?? identity.displayName });
          }}
        />
      ) : view === "chat" ? (
        <ChatApplicationMode
          mode="convex"
          identity={identity}
          detail={detail}
          selectedId={selectedId}
          onCreate={createDraft}
          onSaveField={saveFieldValue}
        />
      ) : (
    <ApplicationWorkspace
      mode="convex"
      identity={identity}
      applications={applications}
      detail={detail}
      selectedId={selectedId}
      busy={busy}
      lastManualSaveAt={lastManualSaveAt}
      onSelect={selectApplication}
      onManualSave={() => setLastManualSaveAt(Date.now())}
      onCreate={createDraft}
      onSaveField={saveFieldValue}
      onUpsertParcel={async (parcel: LandParcel) => {
        if (!selectedId) return;
        await upsertParcel({
          applicationId: selectedId,
          parcelId: parcel.id.startsWith("new-") ? undefined : parcel.id,
          fieldNo: parcel.fieldNo,
          splitNo: parcel.splitNo,
          cropSeason: parcel.cropSeason,
          location: parcel.location,
          landCategory: parcel.landCategory,
          mainAreaM2: parcel.mainAreaM2,
          cropAreaM2: parcel.cropAreaM2,
          cropName: parcel.cropName,
          cropType: parcel.cropType,
          paymentExcluded: parcel.paymentExcluded,
          continuationExcluded: parcel.continuationExcluded,
          note: parcel.note,
        });
      }}
      onRemoveParcel={async (parcelId) => {
        if (!selectedId) return;
        await removeParcel({ applicationId: selectedId, parcelId });
      }}
      onUploadOcr={async (file: File, provider: OcrProvider, modelId: string) => {
        if (!selectedId) return;
        setBusy(true);
        try {
          const uploadUrl = await generateUploadUrl();
          const uploadResult = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          const { storageId } = await uploadResult.json();
          const uploadedFileId = await attachUploadedFile({
            applicationId: selectedId,
            storageId,
            filename: file.name,
            contentType: file.type || "application/pdf",
            kind: "application_pdf",
          });
          const jobId = await createOcrJob({
            applicationId: selectedId,
            uploadedFileId,
            provider,
            modelId,
          });
          await runOcrJob({ ocrJobId: jobId });
        } finally {
          setBusy(false);
        }
      }}
      onAcceptOcr={async (resultId: string, value: PrimitiveValue) => {
        await acceptOcr({ resultId, value });
      }}
      onRejectOcr={async (resultId: string) => {
        await rejectOcr({ resultId });
      }}
      onValidate={async () => {
        if (!selectedId) return;
        await validate({ applicationId: selectedId });
      }}
      onSubmit={async () => {
        if (!selectedId) return;
        await submit({ applicationId: selectedId });
      }}
      onExportCsv={async () => {
        if (!selectedId) return;
        const result = await generateCsv({ applicationId: selectedId });
        downloadText(result.fileName, result.content);
      }}
    />
      )}
    </>
  );
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
