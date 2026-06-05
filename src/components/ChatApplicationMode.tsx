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

type AssistantRequestOptions = {
  hiddenUserText?: boolean;
  draftOnly?: boolean;
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
  const [skippedFieldKeys, setSkippedFieldKeys] = useState<string[]>([]);

  const valueMap = useMemo(() => new Map(detail?.values.map((item) => [item.fieldKey, item.value]) ?? []), [detail]);
  const filledCount = detail?.values.length ?? 0;
  const requiredCount = allFields.filter((field) => field.required).length;
  const requiredFilledCount = allFields.filter((field) => field.required && valueMap.has(field.key)).length;
  const visibleValues = allFields.filter((field) => valueMap.has(field.key)).slice(0, 12);
  const nextField = allFields.find((field) => field.key === nextFieldKey);
  const choiceField = nextField?.type === "select" && nextField.options?.length ? nextField : null;

  const sendToAssistant = async (text: string, directSave?: DirectFieldSave, options: AssistantRequestOptions = {}) => {
    if (!detail || busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    const nextMessages = options.hiddenUserText ? messages : [...messages, userMessage];
    const requestMessages = options.hiddenUserText ? [...messages, userMessage] : nextMessages;
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
          messages: requestMessages.map((message) => ({ role: message.role, text: message.text })),
        }),
      });
      const result = await response.json();
      const fields = normalizeDraftFields(result.fields);
      for (const field of fields) {
        await onSaveField(field.fieldKey, field.value);
      }
      const savedFields = directSave ? [directSave, ...fields.filter((field) => field.fieldKey !== directSave.fieldKey)] : fields;
      setLastSavedFields(savedFields);
      const filledAfterSave = mergeFieldEntries(requestFields, savedFields);
      const computedNextFieldKey = nextUnfilledFieldKey(filledAfterSave, [], skippedFieldKeys);
      const resultNextFieldKey =
        typeof result.nextFieldKey === "string" && !skippedFieldKeys.includes(result.nextFieldKey) && !filledAfterSave.some((field) => field.fieldKey === result.nextFieldKey)
          ? result.nextFieldKey
          : null;
      const finalNextFieldKey = resultNextFieldKey ?? computedNextFieldKey;
      setNextFieldKey(finalNextFieldKey);
      const resultReply = typeof result.reply === "string" ? result.reply.trim() : "";
      const repeatedSavedQuestion = savedFields.some((field) => isSameQuestion(resultReply, field.fieldKey));
      const assistantText = options.draftOnly
        ? savedFields.length > 0
          ? "ここまでの内容を下書きに反映しました。続ける場合は次の回答を入力してください。"
          : "ここまでの内容はすでに下書きへ反映済みです。分からない項目は空欄のまま進められます。"
        : resultReply && !repeatedSavedQuestion
          ? resultReply
          : finalNextFieldKey
            ? questionForFieldKey(finalNextFieldKey)
            : "主要項目は埋まりました。追加で伝えたい内容があれば教えてください。";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: assistantText,
          savedCount: savedFields.length,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: options.draftOnly
            ? "下書き作成に失敗しました。入力を続けるか、もう一度試してください。"
            : `${fallbackQuestion(valueMap, skippedFieldKeys)} AI応答に失敗したため、次の確認だけ進めます。`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const submitFreeText = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (isUnknownAnswer(trimmed) && nextFieldKey) {
      skipCurrentField(trimmed);
      return;
    }
    const selectedChoice = choiceField ? choiceFromInput(trimmed, choiceField) : null;
    if (choiceField && selectedChoice) {
      void sendToAssistant(selectedChoice.text, {
        fieldKey: choiceField.key,
        label: choiceField.label,
        value: selectedChoice.value,
      });
      return;
    }
    if (nextField && nextField.type !== "select") {
      if (nextField.key === "applicant.address" && isIncompleteAddress(trimmed)) {
        askCurrentFieldAgain(
          trimmed,
          "住所が途中までの可能性があります。市区町村に加えて、町名・番地・建物名まで分かる範囲で教えてください。",
        );
        return;
      }
      void sendToAssistant(trimmed, {
        fieldKey: nextField.key,
        label: nextField.label,
        value: coerceDirectAnswer(trimmed, nextField),
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

  const skipCurrentField = (text: string) => {
    if (!nextFieldKey) return;
    const skipped = Array.from(new Set([...skippedFieldKeys, nextFieldKey]));
    const currentFields = allFields.filter((field) => valueMap.has(field.key)).map((field) => ({ fieldKey: field.key }));
    const nextKey = nextUnfilledFieldKey(currentFields, [], skipped);
    setSkippedFieldKeys(skipped);
    setNextFieldKey(nextKey);
    setInput("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: nextKey
          ? `分からない項目は空欄のまま進めます。${questionForFieldKey(nextKey)}`
          : "分からない項目は空欄のままにしました。主要項目は一通り確認しました。",
      },
    ]);
  };

  const askCurrentFieldAgain = (text: string, assistantText: string) => {
    setInput("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: assistantText,
      },
    ]);
  };

  const goToNextQuestion = () => {
    if (!nextFieldKey || busy) return;
    skipCurrentField("次の質問へ");
  };

  const createDraftFromChat = () => {
    void sendToAssistant(
      "ここまでの会話内容から、新しく下書き保存できる申請項目だけを抽出してください。質問は返さないでください。",
      undefined,
      { hiddenUserText: true, draftOnly: true },
    );
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
                  <button className="ghost-button" onClick={goToNextQuestion} disabled={busy}>
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
                    if (event.key === "Enter" && event.shiftKey) {
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

function fallbackQuestion(valueMap: Map<string, PrimitiveValue>, skippedFieldKeys: string[] = []) {
  const skipped = new Set(skippedFieldKeys);
  const next = allFields.find((field) => field.required && !valueMap.has(field.key) && !skipped.has(field.key)) ?? allFields.find((field) => !valueMap.has(field.key) && !skipped.has(field.key));
  return next ? `${next.label}を教えてください。` : "主要項目は埋まりました。追加で伝えたい内容があれば教えてください。";
}

function nextUnfilledFieldKey(currentFields: Array<{ fieldKey: string }>, savedFields: Array<{ fieldKey: string }>, skippedFieldKeys: string[] = []) {
  const filledKeys = new Set([...currentFields.map((field) => field.fieldKey), ...savedFields.map((field) => field.fieldKey)]);
  const skipped = new Set(skippedFieldKeys);
  return allFields.find((field) => field.required && !filledKeys.has(field.key) && !skipped.has(field.key))?.key ?? allFields.find((field) => !filledKeys.has(field.key) && !skipped.has(field.key))?.key ?? null;
}

function mergeFieldEntries(currentFields: Array<{ fieldKey: string }>, savedFields: Array<{ fieldKey: string }>) {
  const entries = new Map<string, { fieldKey: string }>();
  for (const field of currentFields) entries.set(field.fieldKey, field);
  for (const field of savedFields) entries.set(field.fieldKey, field);
  return Array.from(entries.values());
}

function coerceDirectAnswer(value: string, field: FieldDefinition): PrimitiveValue {
  if (field.type !== "number") return value;
  const numeric = Number(value.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : value;
}

function isIncompleteAddress(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (normalized.length < 5) return true;
  if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ーヶ]+(都|道|府|県|市|区|町|村)$/u.test(normalized)) return true;
  const hasStreetNumber = /(\d|[０-９]|丁目|番地|番|号|-|－|ー|の)/.test(normalized);
  const hasLotHint = /(大字|字|地割|地内|無番地)/.test(normalized);
  return !hasStreetNumber && !hasLotHint;
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

function questionForFieldKey(fieldKey: string) {
  const field = allFields.find((item) => item.key === fieldKey);
  return field ? `${field.label}を教えてください。` : "次の項目を教えてください。";
}

function isSameQuestion(text: string, fieldKey: string) {
  const normalizedText = normalizeQuestionText(text);
  return normalizedText === normalizeQuestionText(questionForFieldKey(fieldKey));
}

function normalizeQuestionText(text: string) {
  return text.replace(/\s/g, "").replace(/[?？]/g, "。").replace(/。+$/g, "。");
}

function isUnknownAnswer(value: string) {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  if (["unknown", "idk", "n/a", "na", "-"].includes(normalized)) return true;
  return /不明|わからな|分からな|分かりません|わかりません|わかんない|分かんない|不詳|不確定|未定|知らない|確認中|あとで|後で|空欄/.test(normalized);
}

function formatPrimitive(value: PrimitiveValue | undefined) {
  if (value === undefined || value === null || value === "") return "未入力";
  if (value === "1") return "あり / 申請する";
  if (value === "0") return "なし / 申請しない";
  return String(value);
}
