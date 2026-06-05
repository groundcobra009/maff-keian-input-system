import { BotMessageSquare, CheckCircle2, Loader2, Plus, Save, Send, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppIdentity } from "../auth/AuthShell";
import { fieldGroups, statusLabels } from "../data/formDefinition";
import type { ApplicationDetail, PrimitiveValue } from "../types";
import type { FieldDefinition } from "../types";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  savedCount?: number;
};

type DraftField = {
  fieldKey: string;
  label: string;
  value: PrimitiveValue;
  confidence?: number;
};

type DirectFieldSave = {
  fieldKey: string;
  label: string;
  value: PrimitiveValue;
};

type Props = {
  mode: "local" | "convex";
  identity: AppIdentity;
  detail: ApplicationDetail | null;
  selectedId: string | null;
  onCreate: () => Promise<void> | void;
  onSaveField: (fieldKey: string, value: PrimitiveValue) => Promise<void> | void;
};

const allFields = fieldGroups.flatMap((group) => group.fields.map((field) => ({ ...field, groupTitle: group.title })));
const fieldLabels = new Map(allFields.map((field) => [field.key, field.label]));

export function ChatApplicationMode({ mode, identity, detail, selectedId, onCreate, onSaveField }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "チャット申請モードです。まず、交付申請者名（漢字）を教えてください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastSavedFields, setLastSavedFields] = useState<DraftField[]>([]);
  const [nextFieldKey, setNextFieldKey] = useState<string | null>("applicant.nameKanji");

  const valueMap = useMemo(() => new Map(detail?.values.map((item) => [item.fieldKey, item.value]) ?? []), [detail]);
  const filledCount = detail?.values.length ?? 0;
  const requiredCount = allFields.filter((field) => field.required).length;
  const requiredFilledCount = allFields.filter((field) => field.required && valueMap.has(field.key)).length;
  const visibleValues = allFields.filter((field) => valueMap.has(field.key)).slice(0, 12);
  const nextField = allFields.find((field) => field.key === nextFieldKey);
  const choiceField = nextField?.type === "select" && nextField.options?.length ? nextField : null;

  const sendToAssistant = async (text: string, directSave?: DirectFieldSave) => {
    if (!detail || busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    const nextMessages = [...messages, userMessage];
    const currentFields = allFields
      .filter((field) => valueMap.has(field.key))
      .map((field) => ({ fieldKey: field.key, label: field.label, value: valueMap.get(field.key) }));
    const requestFields = directSave
      ? [...currentFields.filter((field) => field.fieldKey !== directSave.fieldKey), directSave]
      : currentFields;

    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      if (directSave) await onSaveField(directSave.fieldKey, directSave.value);
      const response = await fetch("/api/application-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selectedId,
          identity: {
            displayName: identity.displayName,
            email: identity.email,
            authMode: identity.authMode,
          },
          currentFields: requestFields,
          messages: nextMessages.map((message) => ({ role: message.role, text: message.text })),
        }),
      });
      const result = await response.json();
      const fields = normalizeDraftFields(result.fields);
      for (const field of fields) {
        await onSaveField(field.fieldKey, field.value);
      }
      const savedFields = directSave ? [directSave, ...fields.filter((field) => field.fieldKey !== directSave.fieldKey)] : fields;
      setLastSavedFields(savedFields);
      setNextFieldKey(typeof result.nextFieldKey === "string" ? result.nextFieldKey : nextUnfilledFieldKey(requestFields, savedFields));
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: typeof result.reply === "string" && result.reply ? result.reply : fallbackQuestion(valueMap),
          savedCount: savedFields.length,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `${fallbackQuestion(valueMap)} AI応答に失敗したため、次の確認だけ進めます。`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const submitFreeText = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const selectedChoice = choiceField ? choiceFromInput(trimmed, choiceField) : null;
    if (choiceField && selectedChoice) {
      void sendToAssistant(selectedChoice.text, {
        fieldKey: choiceField.key,
        label: choiceField.label,
        value: selectedChoice.value,
      });
      return;
    }
    void sendToAssistant(trimmed);
  };

  const submitChoice = (field: FieldDefinition, optionIndex: number) => {
    const option = field.options?.[optionIndex];
    if (!option) return;
    void sendToAssistant(choiceText(option.label, optionIndex), {
      fieldKey: field.key,
      label: field.label,
      value: option.value,
    });
  };

  const createDraftFromChat = () => {
    void sendToAssistant("ここまでの会話内容で申請書の下書きを作成してください。未入力の重要項目があれば次の質問を1つだけ出してください。");
  };

  const createDraft = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreate();
    } catch {
      setCreateError("Convexへの下書き作成に時間がかかっています。一時下書きとして入力を開始できます。");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="chat-application-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">経営所得安定対策等</p>
          <h1>チャット申請</h1>
        </div>
        <div className="topbar-actions">
          <span className={`mode-pill ${mode}`}>{mode === "convex" ? "Convex接続" : "ローカル確認"}</span>
          <span className={`mode-pill ${identity.authMode}`}>
            <UserRound size={14} />
            {identity.displayName}
          </span>
        </div>
      </header>

      <main className="chat-application-layout">
        <section className="chat-main-panel">
          {detail ? (
            <>
              <div className="chat-draft-header">
                <div>
                  <span className={`status-badge ${detail.application.status}`}>{statusLabels[detail.application.status]}</span>
                  <h2>{detail.application.title}</h2>
                  <p>
                    必須 {requiredFilledCount}/{requiredCount} 項目 · 保存済み {filledCount} 項目
                  </p>
                  {selectedId?.startsWith("optimistic-") ? <p className="admin-notice">Convex同期待ちの一時下書きです。</p> : null}
                </div>
                <div className="chat-draft-actions">
                  <button className="ghost-button" onClick={() => sendToAssistant("次の質問をお願いします。")} disabled={busy}>
                    <BotMessageSquare size={18} />
                    次の質問
                  </button>
                  <button className="primary-button" onClick={createDraftFromChat} disabled={busy}>
                    {busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    下書き作成
                  </button>
                </div>
              </div>

              <div className="chat-thread-large">
                {messages.map((message) => (
                  <div key={message.id} className={`draft-chat-message ${message.role}`}>
                    <p>{message.text}</p>
                    {message.savedCount ? (
                      <span>
                        <CheckCircle2 size={14} />
                        {message.savedCount}項目を下書き保存
                      </span>
                    ) : null}
                  </div>
                ))}
                {busy ? (
                  <div className="draft-chat-message assistant">
                    <p>
                      <Loader2 className="spin" size={16} />
                      回答から下書きを作成中です
                    </p>
                  </div>
                ) : null}
              </div>

              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitFreeText();
                }}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitFreeText();
                    }
                  }}
                  placeholder="回答を入力"
                  rows={3}
                  disabled={busy}
                />
                {choiceField ? (
                  <div className="chat-choice-list" aria-label={`${choiceField.label}の選択肢`}>
                    {choiceField.options?.map((option, index) => (
                      <button key={option.value} type="button" className="ghost-button" disabled={busy} onClick={() => submitChoice(choiceField, index)}>
                        {choiceText(option.label, index)}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button className="primary-button" type="submit" disabled={busy || !input.trim()}>
                  <Send size={18} />
                  送信
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state">
              <BotMessageSquare size={36} />
              <h2>チャットで申請下書きを作成します</h2>
              <button className="primary-button" onClick={createDraft} disabled={creating}>
                {creating ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
                {creating ? "作成中" : "申請下書きを作成"}
              </button>
              {createError ? <p className="auth-error">{createError}</p> : null}
            </div>
          )}
        </section>

        <aside className="chat-context-panel">
          <section>
            <h2>保存済み項目</h2>
            <div className="progress-line">
              <span style={{ width: `${Math.round((requiredFilledCount / requiredCount) * 100)}%` }} />
            </div>
            <p className="subtle">AIが聞き取った内容はすべて下書きとして保存されます。</p>
          </section>

          <section className="saved-field-list">
            {visibleValues.length === 0 ? <p className="subtle">まだ保存された項目はありません</p> : null}
            {visibleValues.map((field) => (
              <div key={field.key} className="saved-field-row">
                <span>{field.label}</span>
                <strong>{formatPrimitive(valueMap.get(field.key))}</strong>
              </div>
            ))}
          </section>

          {lastSavedFields.length ? (
            <section className="last-saved-list">
              <h2>直近の保存</h2>
              {lastSavedFields.map((field) => (
                <div key={field.fieldKey} className="saved-field-row">
                  <span>{fieldLabels.get(field.fieldKey) ?? field.label}</span>
                  <strong>{formatPrimitive(field.value)}</strong>
                </div>
              ))}
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function normalizeDraftFields(fields: unknown): DraftField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field): field is DraftField => {
      if (!field || typeof field !== "object") return false;
      const candidate = field as DraftField;
      return typeof candidate.fieldKey === "string" && fieldLabels.has(candidate.fieldKey) && candidate.value !== undefined;
    })
    .slice(0, 8);
}

function fallbackQuestion(valueMap: Map<string, PrimitiveValue>) {
  const next = allFields.find((field) => field.required && !valueMap.has(field.key)) ?? allFields.find((field) => !valueMap.has(field.key));
  return next ? `${next.label}を教えてください。` : "主要項目は埋まりました。追加で伝えたい内容があれば教えてください。";
}

function nextUnfilledFieldKey(currentFields: Array<{ fieldKey: string }>, savedFields: Array<{ fieldKey: string }>) {
  const filledKeys = new Set([...currentFields.map((field) => field.fieldKey), ...savedFields.map((field) => field.fieldKey)]);
  return allFields.find((field) => field.required && !filledKeys.has(field.key))?.key ?? allFields.find((field) => !filledKeys.has(field.key))?.key ?? null;
}

function choiceText(label: string, index: number) {
  return `${index + 1} ${label.replace("あり / ", "").replace("なし / ", "")}`;
}

function choiceFromInput(input: string, field: FieldDefinition) {
  const numericChoice = Number(input.replace(/[^\d]/g, ""));
  const index = Number.isInteger(numericChoice) ? numericChoice - 1 : -1;
  const option = field.options?.[index];
  if (!option) return null;
  return {
    text: choiceText(option.label, index),
    value: option.value,
  };
}

function formatPrimitive(value: PrimitiveValue | undefined) {
  if (value === undefined || value === null || value === "") return "未入力";
  if (value === "1") return "あり / 申請する";
  if (value === "0") return "なし / 申請しない";
  return String(value);
}
