import { Activity, AlertCircle, Building2, Clock3, Database, FileCheck2, FileDown, ListChecks, Mail, MessageSquareText, Search, ShieldCheck, ScanText, Trash2, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { fieldGroups, statusLabels } from "../data/formDefinition";
import type { AdminDashboardData, ApplicationStatus, CouncilSettings } from "../types";
import type { AppIdentity } from "../auth/AuthShell";

type Props = {
  mode: "local" | "convex";
  identity: AppIdentity;
  data: AdminDashboardData;
  notice?: string;
  statusReadOnly?: boolean;
  onStatusChange: (applicationId: string, status: ApplicationStatus) => Promise<void> | void;
  onSaveCouncilSettings?: (settings: CouncilSettings) => Promise<void> | void;
  onAddAdminUser?: (email: string) => Promise<void> | void;
  onRemoveAdminUser?: (adminUserId: string) => Promise<void> | void;
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

const subsidyFields = fieldGroups
  .find((group) => group.id === "programs")!
  .fields.map((field) => ({ fieldKey: field.key, label: field.label }));

export function AdminDashboard({
  mode,
  identity,
  data,
  notice,
  statusReadOnly,
  onStatusChange,
  onSaveCouncilSettings,
  onAddAdminUser,
  onRemoveAdminUser,
}: Props) {
  const [search, setSearch] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<CouncilSettings>(data.councilSettings ?? {});
  const [adminEmail, setAdminEmail] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [adminUserSaving, setAdminUserSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [adminUserMessage, setAdminUserMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettingsDraft(data.councilSettings ?? {});
  }, [data.councilSettings]);

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
  const areaSummary = data.areaSummary ?? {
    totalAreaM2: data.applications.reduce((sum, application) => sum + (application.totalAreaM2 ?? 0), 0),
    cropAreaM2: data.applications.reduce((sum, application) => sum + (application.cropAreaM2 ?? 0), 0),
    applicationCountWithArea: data.applications.filter((application) => (application.totalAreaM2 ?? 0) > 0 || (application.cropAreaM2 ?? 0) > 0).length,
  };
  const subsidyCounts = data.subsidyCounts?.length
    ? data.subsidyCounts
    : subsidyFields.map((field) => ({
        ...field,
        count: data.applications.filter((application) => application.subsidyPrograms?.includes(field.fieldKey)).length,
      }));
  const recentlyUpdated = data.applications.filter((application) => now - application.updatedAt <= 1000 * 60 * 60 * 2).length;
  const staleDrafts = data.applications.filter(
    (application) => ["draft", "ocr_draft", "needs_review", "returned"].includes(application.status) && now - application.updatedAt >= 1000 * 60 * 60 * 24,
  ).length;
  const actionQueue = data.applications
    .filter((application) => application.errorCount > 0 || application.warningCount > 0 || application.status === "returned")
    .sort((a, b) => b.errorCount - a.errorCount || b.warningCount - a.warningCount || b.updatedAt - a.updatedAt)
    .slice(0, 5);
  const adminUsers = data.adminUsers ?? [];
  const feedbackItems = data.feedbackItems ?? [];
  const updateSetting = (key: keyof CouncilSettings, value: string) => {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  };
  const saveSettings = async () => {
    if (!onSaveCouncilSettings || settingsSaving) return;
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      await onSaveCouncilSettings(settingsDraft);
      setSettingsMessage("協議会設定を保存しました。");
    } catch {
      setSettingsMessage("協議会設定の保存に失敗しました。");
    } finally {
      setSettingsSaving(false);
    }
  };
  const addAdminUser = async () => {
    const email = adminEmail.trim();
    if (!email || !onAddAdminUser || adminUserSaving) return;
    setAdminUserSaving(true);
    setAdminUserMessage(null);
    try {
      await onAddAdminUser(email);
      setAdminEmail("");
      setAdminUserMessage("管理者メールを追加しました。");
    } catch {
      setAdminUserMessage("管理者メールの追加に失敗しました。");
    } finally {
      setAdminUserSaving(false);
    }
  };

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
          <div className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <Activity size={18} />
                <h2>面積サマリ</h2>
              </div>
              <span>{areaSummary.applicationCountWithArea}件</span>
            </div>
            <div className="area-summary">
              <div>
                <span>総面積</span>
                <strong>{formatArea(areaSummary.totalAreaM2)}</strong>
              </div>
              <div>
                <span>作付面積</span>
                <strong>{formatArea(areaSummary.cropAreaM2)}</strong>
              </div>
              <div>
                <span>ha換算</span>
                <strong>{formatHa(areaSummary.cropAreaM2)}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-wide">
            <div className="dashboard-card-heading">
              <div>
                <FileCheck2 size={18} />
                <h2>補助金ごとの件数</h2>
              </div>
              <span>{subsidyCounts.reduce((sum, item) => sum + item.count, 0)}件</span>
            </div>
            <div className="subsidy-list">
              {subsidyCounts.map((program) => (
                <div key={program.fieldKey}>
                  <span>{program.label}</span>
                  <strong>{program.count}</strong>
                  <i style={{ width: `${Math.max(4, (program.count / Math.max(total, 1)) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>

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
              <h2>協議会設定・管理者</h2>
              <p>申請者に聞かない固定コードと、管理画面を扱うメールアドレスを管理します。</p>
            </div>
          </div>
          <div className="admin-settings-grid">
            <div className="settings-panel">
              <div className="settings-panel-heading">
                <Building2 size={18} />
                <h3>協議会設定</h3>
              </div>
              <div className="settings-fields">
                <label>
                  <span>協議会名</span>
                  <input value={settingsDraft.councilName ?? ""} onChange={(event) => updateSetting("councilName", event.target.value)} placeholder="例: 関東農業再生協議会" />
                </label>
                <label>
                  <span>都道府県コード</span>
                  <input value={settingsDraft.prefectureCode ?? ""} onChange={(event) => updateSetting("prefectureCode", event.target.value)} placeholder="13" inputMode="numeric" />
                </label>
                <label>
                  <span>地域協議会コード</span>
                  <input value={settingsDraft.councilCode ?? ""} onChange={(event) => updateSetting("councilCode", event.target.value)} placeholder="001" inputMode="numeric" />
                </label>
                <label>
                  <span>地域協議会等管理コード</span>
                  <input value={settingsDraft.managementCode ?? ""} onChange={(event) => updateSetting("managementCode", event.target.value)} placeholder="13桁" inputMode="numeric" />
                </label>
              </div>
              <div className="settings-actions">
                <button className="primary-button" onClick={saveSettings} disabled={!onSaveCouncilSettings || settingsSaving}>
                  <ShieldCheck size={16} />
                  {settingsSaving ? "保存中" : "設定を保存"}
                </button>
                {settingsMessage ? <span>{settingsMessage}</span> : null}
              </div>
            </div>

            <div className="settings-panel">
              <div className="settings-panel-heading">
                <Mail size={18} />
                <h3>管理者ユーザー</h3>
              </div>
              <div className="admin-user-form">
                <input
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void addAdminUser();
                  }}
                  placeholder="admin@example.jp"
                  type="email"
                />
                <button className="primary-button" onClick={addAdminUser} disabled={!onAddAdminUser || adminUserSaving || !adminEmail.trim()}>
                  <UserPlus size={16} />
                  追加
                </button>
              </div>
              {adminUserMessage ? <p className="settings-message">{adminUserMessage}</p> : null}
              <div className="admin-user-list">
                {adminUsers.length ? (
                  adminUsers.map((user) => (
                    <div key={user.id}>
                      <span>{user.email}</span>
                      <small>{user.role === "owner" ? "オーナー" : "管理者"}</small>
                      <button type="button" onClick={() => void onRemoveAdminUser?.(user.id)} disabled={!onRemoveAdminUser}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="subtle">管理者メールはまだ登録されていません。</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>テスト意見</h2>
              <p>テスト利用者から届いた改修要望や気づきを確認できます。</p>
            </div>
            <span className="mode-pill convex">
              <MessageSquareText size={14} />
              {feedbackItems.length}件
            </span>
          </div>
          <div className="feedback-list">
            {feedbackItems.length ? (
              feedbackItems.map((feedback) => (
                <article key={feedback.id} className="feedback-item">
                  <header>
                    <div>
                      <strong>{feedback.name}</strong>
                      <span>{feedback.view ?? "画面未指定"}</span>
                    </div>
                    <time>{formatTime(feedback.createdAt)}</time>
                  </header>
                  <p>{feedback.message}</p>
                  {feedback.email || feedback.createdBy ? <small>{feedback.email ?? feedback.createdBy}</small> : null}
                </article>
              ))
            ) : (
              <p className="subtle">まだ改修要望は届いていません。</p>
            )}
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
              <span>面積</span>
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
                <span>{formatArea(application.cropAreaM2 ?? application.totalAreaM2 ?? 0)}</span>
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

function formatArea(value: number) {
  if (!value) return "-";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value)}㎡`;
}

function formatHa(value: number) {
  if (!value) return "-";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value / 10000)}ha`;
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
