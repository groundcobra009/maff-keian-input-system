const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const FIELD_CATALOG = [
  { key: "application.managementCode", label: "地域協議会等管理コード", type: "text", required: true },
  { key: "application.prefectureCode", label: "都道府県コード", type: "text", required: true },
  { key: "application.councilCode", label: "地域協議会コード", type: "text", required: true },
  { key: "applicant.nameKana", label: "交付申請者名（フリガナ）", type: "text", required: true },
  { key: "applicant.nameKanji", label: "交付申請者名（漢字）", type: "text", required: true },
  { key: "applicant.postalCode", label: "郵便番号", type: "text", required: true },
  { key: "applicant.address", label: "住所", type: "text", required: true },
  { key: "applicant.phone", label: "電話番号", type: "tel", required: true },
  { key: "applicant.email", label: "メールアドレス", type: "email" },
  { key: "application.applyWaterDirectPayment", label: "水田活用の直接支払交付金", type: "select", required: true, options: ["1", "0"] },
  { key: "application.applyNewMarketRice", label: "コメ新市場開拓等促進事業", type: "select", required: true, options: ["1", "0"] },
  { key: "application.applyFieldCropFormation", label: "畑作物産地形成促進事業", type: "select", required: true, options: ["1", "0"] },
  { key: "application.applyFieldConversion", label: "畑地化促進事業", type: "select", required: true, options: ["1", "0"] },
  { key: "application.applyGeta", label: "畑作物の直接支払交付金（ゲタ）", type: "select", required: true, options: ["1", "0"] },
  { key: "application.applyNarashi", label: "収入減少影響緩和交付金（ナラシ）", type: "select", required: true, options: ["1", "0"] },
  { key: "account.notificationType", label: "口座届出書", type: "select", required: true, options: ["0", "1", "2"] },
  { key: "account.bankCode", label: "金融機関コード", type: "text" },
  { key: "account.branchCode", label: "支店コード", type: "text" },
  { key: "account.accountType", label: "預金種目コード", type: "text" },
  { key: "account.accountNumber", label: "口座番号", type: "text" },
  { key: "application.proxyType", label: "代理申請区分", type: "select", options: ["0", "1"] },
  { key: "insurance.rice", label: "農作物共済加入（水稲）", type: "select", required: true, options: ["1", "0"] },
  { key: "insurance.wheat", label: "農作物共済加入（麦）", type: "select", required: true, options: ["1", "0"] },
  { key: "insurance.soy", label: "農作物共済加入（大豆）", type: "select", required: true, options: ["1", "0"] },
  { key: "rice.yieldKgPer10a", label: "水稲単収", type: "number", unit: "kg/10a" },
  { key: "rice.mainFoodAreaM2", label: "主食用米 生産予定面積", type: "number", unit: "m2" },
  { key: "rice.processingAreaM2", label: "加工用米 生産予定面積", type: "number", unit: "m2" },
  { key: "rice.feedAreaM2", label: "飼料用米 生産予定面積", type: "number", unit: "m2" },
  { key: "rice.totalAreaM2", label: "水稲用途別 合計面積", type: "number", unit: "m2" },
  { key: "narashi.prefectureOfficeCode", label: "県拠点コード", type: "text" },
  { key: "narashi.shipperCode", label: "出荷者コード", type: "text" },
  { key: "narashi.shipperBranchCode", label: "出荷者支所コード", type: "text" },
  { key: "narashi.cropCode", label: "対象農産物コード", type: "text" },
  { key: "narashi.regionCode", label: "地域等コード", type: "text" },
  { key: "narashi.productionAreaM2", label: "生産予定面積", type: "number", unit: "m2" },
];

const FIELD_KEYS = new Set(FIELD_CATALOG.map((field) => field.key));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const currentFields = Array.isArray(body.currentFields) ? body.currentFields : [];
  const fallback = buildFallback(currentFields);

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({
      ...fallback,
      source: "fallback",
      warning: "ANTHROPIC_API_KEY is not configured.",
    });
  }

  const userPrompt = [
    "以下のチャット履歴と既存の下書き値をもとに、申請フォームの下書きを更新してください。",
    "チャット履歴:",
    JSON.stringify(messages, null, 2),
    "既存の下書き値:",
    JSON.stringify(currentFields, null, 2),
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1200,
        temperature: 0.2,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic application-chat failed", response.status, detail.slice(0, 600));
      return res.status(200).json({ ...fallback, source: "fallback", warning: "Anthropic request failed." });
    }

    const result = await response.json();
    const text = result?.content?.map((part) => part?.text || "").join("\n") || "";
    const parsed = parseJsonObject(text);
    const fields = normalizeFields(parsed.fields);
    return res.status(200).json({
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : fallback.reply,
      fields,
      nextFieldKey: FIELD_KEYS.has(parsed.nextFieldKey) ? parsed.nextFieldKey : fallback.nextFieldKey,
      source: "anthropic",
    });
  } catch (error) {
    console.error("application-chat error", error);
    return res.status(200).json({ ...fallback, source: "fallback", warning: "Application chat failed." });
  }
}

function buildSystemPrompt() {
  return [
    "あなたは経営所得安定対策等の申請書下書き作成アシスタントです。",
    "目的は、農業者に一問ずつ短く質問し、得られた回答を申請フォームの下書き項目へ反映することです。",
    "これは正式提出ではなく、必ず後で担当者または申請者が確認する下書きです。",
    "select項目は、申請する/あり/加入済み/該当するなら文字列 \"1\"、申請しない/なし/未加入なら文字列 \"0\" を使ってください。口座届出書は 0=変更なし, 1=新規加入, 2=口座変更です。",
    "数値項目は半角数字のnumberにしてください。不明な値は保存せず、次の質問で確認してください。",
    "質問は1回につき1つだけにしてください。長い説明は避けてください。",
    "次のJSONだけを返してください。Markdownやコードブロックは禁止です。",
    "{\"reply\":\"ユーザーへの次の質問または確認メッセージ\",\"fields\":[{\"fieldKey\":\"applicant.nameKanji\",\"label\":\"交付申請者名（漢字）\",\"value\":\"農林太郎\",\"confidence\":0.9}],\"nextFieldKey\":\"applicant.nameKana\"}",
    "利用できる項目カタログ:",
    JSON.stringify(FIELD_CATALOG),
  ].join("\n");
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("No JSON object in model response");
  }
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field) => field && FIELD_KEYS.has(field.fieldKey))
    .map((field) => {
      const definition = FIELD_CATALOG.find((item) => item.key === field.fieldKey);
      return {
        fieldKey: field.fieldKey,
        label: typeof field.label === "string" ? field.label : definition.label,
        value: normalizeValue(field.value, definition.type),
        confidence: typeof field.confidence === "number" ? Math.max(0, Math.min(1, field.confidence)) : 0.7,
      };
    })
    .filter((field) => field.value !== undefined);
}

function normalizeValue(value, type) {
  if (value === null || value === undefined || value === "") return undefined;
  if (type === "number") {
    const numeric = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value).trim();
}

function buildFallback(currentFields) {
  const filled = new Set(currentFields.map((field) => field.fieldKey));
  const next =
    FIELD_CATALOG.find((field) => field.required && !filled.has(field.key)) ||
    FIELD_CATALOG.find((field) => !filled.has(field.key)) ||
    FIELD_CATALOG[0];
  return {
    reply: `${next.label}を教えてください。`,
    fields: [],
    nextFieldKey: next.key,
  };
}
