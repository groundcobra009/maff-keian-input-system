import { Activity, AlertCircle, Clock3, Database, FileCheck2, FileDown, ListChecks, Search, ShieldCheck, ScanText } from "lucide-react";
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
  const now = Date.now();
  const statusSegments = statusOptions
    .map((status) => ({ status, label: statusLabels[status], count: data.statusCounts[status] ?? 0 }))
    .filter((segment) => segment.count > 0);
  const issueDashboard = {
    errorApplications: data.applications.filter((application) => application.errorCount > 0).length,
    warningApplications: data.applications.filter((application) => application.warningCount > 0 && application.errorCount === 0).length,
    cleanApplications: data.applications.filter((application) => application.errorCount === 0 && application.warningCount === 0).length,
  };
  const ocrTotal = Object.values(data.ocrCounts).reduce((sum, value) => sum + value, 0);
  const exportTotal = Object.values(data.exportCounts).reduce((sum, value) => sum + value, 0);
  const recentlyUpdated = data.applications.filter((application) => now - application.updatedAt <= 1000 * 60 * 60 * 2).length;
  const staleDrafts = data.applications.filter(
    (application) => ["draft", "ocr_draft", "needs_review", "returned"].includes(application.status) && now - application.updatedAt >= 1000 * 60 * 60 * 24,
  ).length;
  const actionQueue = data.applications
    .filter((application) => application.errorCount > 0 || application.warningCount > 0 || application.status === "returned")
    .sort((a, b) => b.errorCount - a.errorCount || b.warningCount - a.warningCount || b.updatedAt - a.updatedAt)
    .slice(0, 5);

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

        <section className="dashboard-grid">
          <div className="dashboard-card dashboard-card-wide">
            <div className="dashboard-card-heading">
              <div>
                <ListChecks size={18} />
                <h2>申請ステータス</h2>
              </div>
              <span>{total}件</span>
            </div>
            <div className="status-distribution" aria-label="状態別件数">
              {statusSegments.map((segment) => (
                <span
                  key={segment.status}
                  className={`status-segment ${segment.status}`}
                  style={{ width: `${Math.max(5, (segment.count / Math.max(total, 1)) * 100)}%` }}
                  title={`${segment.label}: ${segment.count}件`}
                />
              ))}
            </div>
            <div className="status-legend">
              {statusSegments.map((segment) => (
                <div key={segment.status}>
                  <i className={`status-dot ${segment.status}`} />
                  <span>{segment.label}</span>
                  <strong>{segment.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <AlertCircle size={18} />
                <h2>対応優先度</h2>
              </div>
            </div>
            <div className="priority-stack">
              <PriorityRow label="エラーあり" value={issueDashboard.errorApplications} tone="danger" total={total} />
              <PriorityRow label="確認あり" value={issueDashboard.warningApplications} tone="warning" total={total} />
              <PriorityRow label="問題なし" value={issueDashboard.cleanApplications} tone="ok" total={total} />
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <ScanText size={18} />
                <h2>AI / OCR</h2>
              </div>
              <span>{ocrTotal}件</span>
            </div>
            <JobSummary counts={data.ocrCounts} emptyLabel="OCRジョブなし" />
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <FileCheck2 size={18} />
                <h2>CSV出力</h2>
              </div>
              <span>{exportTotal}件</span>
            </div>
            <JobSummary counts={data.exportCounts} emptyLabel="CSV出力なし" />
          </div>

          <div className="dashboard-card dashboard-card-wide">
            <div className="dashboard-card-heading">
              <div>
                <Clock3 size={18} />
                <h2>運用キュー</h2>
              </div>
              <span>直近2時間 {recentlyUpdated}件</span>
            </div>
            <div className="queue-summary">
              <div>
                <strong>{actionQueue.length}</strong>
                <span>対応候補</span>
              </div>
              <div>
                <strong>{staleDrafts}</strong>
                <span>24時間以上停滞</span>
              </div>
              <div>
                <strong>{submitted}</strong>
                <span>提出以降</span>
              </div>
            </div>
            <div className="action-queue">
              {actionQueue.length ? (
                actionQueue.map((application) => (
                  <div key={application.id}>
                    <strong>{application.title}</strong>
                    <span>
                      {statusLabels[application.status]} · {application.errorCount} エラー / {application.warningCount} 確認
                    </span>
                  </div>
                ))
              ) : (
                <p className="subtle">優先対応が必要な申請はありません。</p>
              )}
            </div>
          </div>
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

function PriorityRow({ label, value, tone, total }: { label: string; value: number; tone: "danger" | "warning" | "ok"; total: number }) {
  const percent = Math.round((value / Math.max(total, 1)) * 100);
  return (
    <div className={`priority-row ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}件</strong>
      </div>
      <div className="priority-bar">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function JobSummary({ counts, emptyLabel }: { counts: Record<string, number>; emptyLabel: string }) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (!entries.length) return <p className="subtle">{emptyLabel}</p>;
  return (
    <div className="job-summary">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{jobLabel(key)}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function jobLabel(value: string) {
  const labels: Record<string, string> = {
    queued: "待機中",
    running: "実行中",
    succeeded: "成功",
    failed: "失敗",
  };
  return labels[value] ?? value;
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
