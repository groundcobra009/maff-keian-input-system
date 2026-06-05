import {
  AlertCircle,
  Check,
  ChevronRight,
  BotMessageSquare,
  Download,
  FileJson,
  FileText,
  History,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { fieldGroups, modelOptions, statusLabels } from "../data/formDefinition";
import type {
  ApplicationDetail,
  AppRecord,
  FieldDefinition,
  LandParcel,
  OcrProvider,
  PrimitiveValue,
} from "../types";
import type { AppIdentity } from "../auth/AuthShell";

type Props = {
  mode: "local" | "convex";
  identity: AppIdentity;
  applications: AppRecord[];
  detail: ApplicationDetail | null;
  selectedId: string | null;
  busy?: boolean;
  lastManualSaveAt?: number | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void> | void;
  onManualSave: () => Promise<void> | void;
  onSaveField: (fieldKey: string, value: PrimitiveValue) => Promise<void> | void;
  onUpsertParcel: (parcel: LandParcel) => Promise<void> | void;
  onRemoveParcel: (parcelId: string) => Promise<void> | void;
  onUploadOcr: (file: File, provider: OcrProvider, modelId: string) => Promise<void> | void;
  onAcceptOcr: (resultId: string, value: PrimitiveValue) => Promise<void> | void;
  onRejectOcr: (resultId: string) => Promise<void> | void;
  onValidate: () => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
  onExportCsv: () => Promise<void> | void;
};

export function ApplicationWorkspace(props: Props) {
  const [activeGroup, setActiveGroup] = useState(fieldGroups[0].id);
  const [selectedModel, setSelectedModel] = useState<(typeof modelOptions)[number]>(modelOptions[0]);
  const [file, setFile] = useState<File | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  const valueMap = useMemo(() => {
    return new Map(props.detail?.values.map((item) => [item.fieldKey, item.value]) ?? []);
  }, [props.detail]);

  const active = fieldGroups.find((group) => group.id === activeGroup) ?? fieldGroups[0];
  const status = props.detail?.application.status ?? "draft";
  const suggestedOcr = props.detail?.ocrResults.filter((result) => result.status === "suggested") ?? [];
  const errorCount = props.detail?.issues.filter((issue) => issue.severity === "error").length ?? 0;
  const warningCount = props.detail?.issues.filter((issue) => issue.severity !== "error").length ?? 0;
  const saveLabel = props.lastManualSaveAt ? `途中保存 ${formatTime(props.lastManualSaveAt)}` : "途中保存";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">経営所得安定対策等</p>
          <h1>申請入力システム</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => setShowCatalog((value) => !value)}>
            <FileJson size={18} />
            項目カタログ
          </button>
          <span className={`mode-pill ${props.mode}`}>{props.mode === "convex" ? "Convex接続" : "ローカル確認"}</span>
          <span className={`mode-pill ${props.identity.authMode}`}>
            <UserRound size={14} />
            {props.identity.displayName}
          </span>
        </div>
      </header>

      {showCatalog ? <CatalogNotice /> : null}

      <main className="workspace-grid">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>申請</h2>
            <button className="icon-button" onClick={props.onCreate} title="新規申請">
              <Plus size={18} />
            </button>
          </div>
          <div className="application-list">
            {props.applications.map((application) => (
              <button
                key={application.id}
                className={`application-row ${application.id === props.selectedId ? "active" : ""}`}
                onClick={() => props.onSelect(application.id)}
              >
                <span className="row-title">{application.title}</span>
                <span className="row-meta">
                  {application.year}年産 · {statusLabels[application.status]}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="main-panel">
          {props.detail ? (
            <>
              <div className="application-header">
                <div>
                  <span className={`status-badge ${status}`}>{statusLabels[status]}</span>
                  <h2>{props.detail.application.title}</h2>
                  <p>{props.detail.application.year}年産 · 最終保存 {formatTime(props.detail.application.updatedAt)}</p>
                </div>
                <div className="header-actions">
                  <button className="ghost-button" onClick={props.onManualSave}>
                    <Save size={18} />
                    {saveLabel}
                  </button>
                  <button className="ghost-button" onClick={props.onValidate}>
                    <AlertCircle size={18} />
                    検証
                  </button>
                  <button className="ghost-button" onClick={props.onExportCsv}>
                    <Download size={18} />
                    CSV
                  </button>
                  <button className="primary-button" onClick={props.onSubmit}>
                    <Send size={18} />
                    提出
                  </button>
                </div>
              </div>

              <div className="step-tabs">
                {fieldGroups.map((group) => (
                  <button key={group.id} className={group.id === activeGroup ? "active" : ""} onClick={() => setActiveGroup(group.id)}>
                    {group.title}
                  </button>
                ))}
                <button className={activeGroup === "parcels" ? "active" : ""} onClick={() => setActiveGroup("parcels")}>
                  筆情報
                </button>
              </div>

              {activeGroup === "parcels" ? (
                <ParcelEditor
                  parcels={props.detail.parcels}
                  onUpsert={props.onUpsertParcel}
                  onRemove={props.onRemoveParcel}
                />
              ) : (
                <FormSection
                  title={active.title}
                  summary={active.summary}
                  fields={active.fields}
                  valueMap={valueMap}
                  onSave={props.onSaveField}
                />
              )}
            </>
          ) : (
            <div className="empty-state">
              <FileText size={32} />
              <h2>申請を作成してください</h2>
              <button className="primary-button" onClick={props.onCreate}>
                <Plus size={18} />
                新規申請
              </button>
            </div>
          )}
        </section>

        <aside className="right-panel">
          <ChatDraftAssistant valueMap={valueMap} onSave={props.onSaveField} />

          <section className="tool-block">
            <div className="tool-heading">
              <Sparkles size={18} />
              <h2>PDFから下書き</h2>
            </div>
            <label className="file-drop">
              <Upload size={20} />
              <span>{file ? file.name : "手書きPDF/画像を選択"}</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <select
              value={`${selectedModel.provider}:${selectedModel.modelId}`}
              onChange={(event) => {
                const next = modelOptions.find((model) => `${model.provider}:${model.modelId}` === event.target.value);
                if (next) setSelectedModel(next);
              }}
            >
              {modelOptions.map((model) => (
                <option key={`${model.provider}:${model.modelId}`} value={`${model.provider}:${model.modelId}`}>
                  {model.label}
                </option>
              ))}
            </select>
            <button
              className="primary-button full"
              disabled={!file || !props.detail || props.busy}
              onClick={() => file && props.onUploadOcr(file, selectedModel.provider, selectedModel.modelId)}
            >
              {props.busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              下書き保存
            </button>
          </section>

          <section className="tool-block">
            <div className="tool-heading">
              <Check size={18} />
              <h2>OCR候補</h2>
              <span>{suggestedOcr.length}</span>
            </div>
            <div className="ocr-list">
              {suggestedOcr.length === 0 ? <p className="subtle">未確認の候補はありません</p> : null}
              {suggestedOcr.map((result) => (
                <OcrResultRow
                  key={result.id}
                  label={result.label}
                  value={result.value}
                  confidence={result.confidence}
                  onAccept={(value) => props.onAcceptOcr(result.id, value)}
                  onReject={() => props.onRejectOcr(result.id)}
                />
              ))}
            </div>
          </section>

          <section className="tool-block">
            <div className="tool-heading">
              <History size={18} />
              <h2>検証</h2>
            </div>
            <div className="issue-summary">
              <span>{errorCount} エラー</span>
              <span>{warningCount} 確認</span>
            </div>
            <div className="issue-list">
              {props.detail?.issues.length ? (
                props.detail.issues.map((issue) => (
                  <div key={issue.id} className={`issue ${issue.severity}`}>
                    <AlertCircle size={16} />
                    <span>{issue.message}</span>
                  </div>
                ))
              ) : (
                <p className="subtle">検証を実行すると結果が表示されます</p>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

function ChatDraftAssistant({
  valueMap,
  onSave,
}: {
  valueMap: Map<string, PrimitiveValue>;
  onSave: (fieldKey: string, value: PrimitiveValue) => Promise<void> | void;
}) {
  const fields = useMemo(() => fieldGroups.flatMap((group) => group.fields), []);
  const firstMissing = useMemo(() => fields.find((field) => field.required && !valueMap.get(field.key)) ?? fields.find((field) => !valueMap.get(field.key)), [fields, valueMap]);
  const [activeFieldKey, setActiveFieldKey] = useState(firstMissing?.key ?? fields[0]?.key);
  const activeField = fields.find((field) => field.key === activeFieldKey) ?? firstMissing ?? fields[0];
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "assistant",
      text: "未入力項目を順番に質問します。回答は下書きとして保存されます。",
    },
  ]);

  const askText = activeField ? questionFor(activeField) : "入力項目はありません。";

  const moveNext = () => {
    const next = fields.find((field) => field.key !== activeField?.key && !valueMap.get(field.key));
    if (next) setActiveFieldKey(next.key);
  };

  const submitAnswer = async (value: PrimitiveValue) => {
    if (!activeField || value === null || value === "") return;
    await onSave(activeField.key, value);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", text: askText },
      { id: crypto.randomUUID(), role: "user", text: String(value) },
      { id: crypto.randomUUID(), role: "assistant", text: `${activeField.label} を下書きに保存しました。` },
    ]);
    setAnswer("");
    moveNext();
  };

  return (
    <section className="tool-block chat-block">
      <div className="tool-heading">
        <BotMessageSquare size={18} />
        <h2>質問で下書き入力</h2>
      </div>
      <div className="chat-window">
        {messages.slice(-4).map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            {message.text}
          </div>
        ))}
        <div className="chat-message assistant">{askText}</div>
      </div>
      {activeField?.type === "select" ? (
        <div className="choice-list">
          {activeField.options?.map((option) => (
            <button key={option.value} className="ghost-button small" onClick={() => submitAnswer(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="chat-input-row">
          <input
            type={activeField?.type === "number" ? "number" : "text"}
            value={answer}
            placeholder="回答を入力"
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitAnswer(activeField?.type === "number" ? numberOrNull(answer) : answer);
              }
            }}
          />
          <button className="primary-button small" onClick={() => submitAnswer(activeField?.type === "number" ? numberOrNull(answer) : answer)}>
            保存
          </button>
        </div>
      )}
      <button className="ghost-button small" onClick={moveNext}>
        この質問をスキップ
      </button>
    </section>
  );
}

function questionFor(field: FieldDefinition) {
  const required = field.required ? "必須項目です。" : "任意項目です。";
  if (field.type === "select") return `${field.label} を選んでください。${required}`;
  if (field.unit) return `${field.label} を入力してください。単位は ${field.unit} です。${required}`;
  return `${field.label} を入力してください。${required}`;
}

function FormSection({
  title,
  summary,
  fields,
  valueMap,
  onSave,
}: {
  title: string;
  summary: string;
  fields: FieldDefinition[];
  valueMap: Map<string, PrimitiveValue>;
  onSave: (key: string, value: PrimitiveValue) => void | Promise<void>;
}) {
  return (
    <div className="form-surface">
      <div className="section-title">
        <h3>{title}</h3>
        <p>{summary}</p>
      </div>
      <div className="field-grid">
        {fields.map((field) => (
          <label key={field.key} className="field">
            <span>
              {field.label}
              {field.required ? <b>必須</b> : null}
            </span>
            <FieldInput field={field} value={valueMap.get(field.key) ?? ""} onSave={(value) => onSave(field.key, value)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onSave,
}: {
  field: FieldDefinition;
  value: PrimitiveValue;
  onSave: (value: PrimitiveValue) => void | Promise<void>;
}) {
  if (field.type === "select") {
    return (
      <select value={String(value ?? "")} onChange={(event) => onSave(event.target.value)}>
        <option value="">未選択</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className="input-with-unit">
      <input
        type={field.type === "number" ? "number" : field.type}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onSave(field.type === "number" ? numberOrNull(event.target.value) : event.target.value)}
      />
      {field.unit ? <small>{field.unit}</small> : null}
    </div>
  );
}

function ParcelEditor({
  parcels,
  onUpsert,
  onRemove,
}: {
  parcels: LandParcel[];
  onUpsert: (parcel: LandParcel) => void | Promise<void>;
  onRemove: (parcelId: string) => void | Promise<void>;
}) {
  const addParcel = () => {
    onUpsert({
      id: `new-${crypto.randomUUID()}`,
      fieldNo: "",
      splitNo: "001",
      cropSeason: "1",
      cropName: "",
      cropType: "",
    });
  };
  return (
    <div className="form-surface">
      <div className="section-title inline">
        <div>
          <h3>農地利用計画（筆情報）</h3>
          <p>耕地番号、分筆番号、作期、作物、面積を明細で管理します</p>
        </div>
        <button className="ghost-button" onClick={addParcel}>
          <Plus size={18} />
          行追加
        </button>
      </div>
      <div className="parcel-table">
        <div className="parcel-head">
          <span>耕地</span>
          <span>分筆</span>
          <span>作期</span>
          <span>地番</span>
          <span>作物名</span>
          <span>本地㎡</span>
          <span>作付㎡</span>
          <span></span>
        </div>
        {parcels.map((parcel) => (
          <ParcelRow
            key={parcel.id}
            parcel={parcel}
            onChange={(next) => onUpsert(next)}
            onRemove={() => onRemove(parcel.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ParcelRow({
  parcel,
  onChange,
  onRemove,
}: {
  parcel: LandParcel;
  onChange: (parcel: LandParcel) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const update = (patch: Partial<LandParcel>) => onChange({ ...parcel, ...patch });
  return (
    <div className="parcel-row">
      <input value={parcel.fieldNo} onChange={(event) => update({ fieldNo: event.target.value })} />
      <input value={parcel.splitNo} onChange={(event) => update({ splitNo: event.target.value })} />
      <select value={parcel.cropSeason} onChange={(event) => update({ cropSeason: event.target.value })}>
        <option value="1">基幹</option>
        <option value="2">二毛作</option>
      </select>
      <input value={parcel.location ?? ""} onChange={(event) => update({ location: event.target.value })} />
      <input value={parcel.cropName ?? ""} onChange={(event) => update({ cropName: event.target.value })} />
      <input type="number" value={parcel.mainAreaM2 ?? ""} onChange={(event) => update({ mainAreaM2: numberOrUndefined(event.target.value) })} />
      <input type="number" value={parcel.cropAreaM2 ?? ""} onChange={(event) => update({ cropAreaM2: numberOrUndefined(event.target.value) })} />
      <button className="icon-button danger" onClick={onRemove} title="削除">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function OcrResultRow({
  label,
  value,
  confidence,
  onAccept,
  onReject,
}: {
  label: string;
  value: PrimitiveValue;
  confidence: number;
  onAccept: (value: PrimitiveValue) => void | Promise<void>;
  onReject: () => void | Promise<void>;
}) {
  const [edited, setEdited] = useState(String(value ?? ""));
  return (
    <div className="ocr-result">
      <div>
        <strong>{label}</strong>
        <span>{Math.round(confidence * 100)}%</span>
      </div>
      <input value={edited} onChange={(event) => setEdited(event.target.value)} />
      <div className="ocr-actions">
        <button className="ghost-button small" onClick={() => onReject()}>
          却下
        </button>
        <button className="primary-button small" onClick={() => onAccept(edited)}>
          採用
        </button>
      </div>
    </div>
  );
}

function CatalogNotice() {
  return (
    <div className="catalog-notice">
      <FileJson size={18} />
      <span>IF仕様から抽出した249項目のカタログを `public/field_catalog.csv` に配置済みです。</span>
      <a href="/field_catalog.csv" download>
        ダウンロード
        <ChevronRight size={16} />
      </a>
    </div>
  );
}

function numberOrUndefined(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberOrNull(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
