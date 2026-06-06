import { MessageSquarePlus, Send } from "lucide-react";
import { useState } from "react";
import type { AppIdentity } from "../auth/AuthShell";

type Props = {
  identity: AppIdentity;
  view: string;
  onSubmit: (feedback: { name: string; message: string; view: string }) => Promise<void> | void;
};

export function FeedbackPanel({ identity, view, onSubmit }: Props) {
  const [name, setName] = useState(identity.displayName === "テスト利用者" ? "" : identity.displayName);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || trimmedMessage.length < 3 || status === "saving") return;
    setStatus("saving");
    try {
      await onSubmit({ name: trimmedName, message: trimmedMessage, view });
      setMessage("");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="feedback-panel" aria-label="テスト中の改修要望">
      <div className="feedback-heading">
        <MessageSquarePlus size={18} />
        <div>
          <h2>テスト実行中</h2>
          <p>気づいた不具合や改修要望を送ってください。</p>
        </div>
      </div>
      <div className="feedback-fields">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="名前" />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="修正意見・気づいたこと" rows={2} />
        <button className="primary-button" type="button" onClick={submit} disabled={!name.trim() || message.trim().length < 3 || status === "saving"}>
          <Send size={16} />
          {status === "saving" ? "送信中" : "意見を送信"}
        </button>
      </div>
      {status === "saved" ? <p className="feedback-status ok">送信しました。ありがとうございます。</p> : null}
      {status === "error" ? <p className="feedback-status error">送信に失敗しました。少し時間を置いてもう一度試してください。</p> : null}
    </section>
  );
}
