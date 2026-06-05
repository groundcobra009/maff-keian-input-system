import { Activity, AlertCircle, Database, FileDown, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { statusLabels } from "../data/formDefinition";
import type { AdminDashboardData, ApplicationStatus } from "../types";
import type { AppIdentity } from "../auth/AuthShell";

type Props = {
  mode: "local" | "convex";
  identity: AppIdentity;
  data: AdminDashboardData;
  notice?: string;
  statusReadOnly?: boolean;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => Promise<void> | void;
};

const statusOptions: ApplicationStatus[] = [
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

export function AdminDashboard({ mode, identity, data, notice, statusReadOnly, onStatusChange }: Props) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.applications;
    return data.applications.filter((application) =>
      [application.title, application.year, statusLabels[application.status], application.createdBy]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data.applications, search]);

  const total = data.applications.length;
  const submitted = (data.statusCounts.submitted ?? 0) + (data.statusCounts.accepted ?? 0) + (data.statusCounts.exported ?? 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">管理画面</p>
          <h1>経営安定申請 管理</h1>
        </div>
        <div className="topbar-actions">
          <span className={`mode-pill ${mode}`}>
            <Database size={14} />
            {mode === "convex" ? "Convex DB" : "ローカルDB"}
          </span>
          <span className={`mode-pill ${identity.authMode}`}>
            <ShieldCheck size={14} />
            {identity.displayName}
          </span>
        </div>
      </header>

      <main className="admin-layout">
        <section className="metric-grid">
          <Metric title="申請数" value={total} note="登録済み申請" icon={<Activity size={18} />} />
          <Metric title="提出以降" value={submitted} note="提出・受付・出力済み" icon={<ShieldCheck size={18} />} />
          <Metric title="検証エラー" value={data.issueCounts.errors} note="全申請の未解消エラー" icon={<AlertCircle size={18} />} tone="danger" />
          <Metric title="CSV出力" value={Object.values(data.exportCounts).reduce((sum, value) => sum + value, 0)} note="出力ジョブ数" icon={<FileDown size={18} />} />
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>申請管理</h2>
              <p>申請の状態、検証、OCR、CSV出力状況を確認できます。</p>
              {notice ? <p className="admin-notice">{notice}</p> : null}
            </div>
            <label className="admin-search">
              <Search size={16} />
              <input value={search} placeholder="申請名・状態で検索" onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>

          <div className="admin-table">
            <div className="admin-table-head">
              <span>申請</span>
              <span>年度</span>
              <span>状態</span>
              <span>検証</span>
              <span>OCR</span>
              <span>CSV</span>
              <span>更新</span>
            </div>
            {rows.map((application) => (
              <div key={application.id} className="admin-table-row">
                <strong>{application.title}</strong>
                <span>{application.year}</span>
                <select
                  value={application.status}
                  disabled={statusReadOnly}
                  onChange={(event) => onStatusChange(application.id, event.target.value as ApplicationStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
                <span className={application.errorCount ? "danger-text" : ""}>
                  {application.errorCount} エラー / {application.warningCount} 確認
                </span>
                <span>{application.ocrJobCount}</span>
                <span>{application.exportJobCount}</span>
                <span>{formatTime(application.updatedAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>最近の監査ログ</h2>
              <p>状態変更、提出、CSV出力などの履歴です。</p>
            </div>
          </div>
          <div className="audit-list">
            {data.recentAuditLogs.length ? (
              data.recentAuditLogs.map((log) => (
                <div key={log.id} className="audit-row">
                  <span>{formatTime(log.createdAt)}</span>
                  <strong>{log.action}</strong>
                  <span>{log.detail ?? "-"}</span>
                  <span>{log.actor ?? "-"}</span>
                </div>
              ))
            ) : (
              <p className="subtle">監査ログはまだありません。</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  title,
  value,
  note,
  icon,
  tone,
}: {
  title: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone?: "danger";
}) {
  return (
    <div className={`metric-card ${tone ?? ""}`}>
      <div>
        {icon}
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
