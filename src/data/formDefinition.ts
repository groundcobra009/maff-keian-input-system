import type { FieldGroup } from "../types";

const yesNo = [
  { value: "1", label: "あり / 申請する" },
  { value: "0", label: "なし / 申請しない" },
];

export const fieldGroups: FieldGroup[] = [
  {
    id: "applicant",
    title: "申請者情報",
    summary: "氏名、住所、連絡先、管理コード",
    fields: [
      { key: "application.managementCode", label: "地域協議会等管理コード", type: "text", required: true, placeholder: "13桁" },
      { key: "application.prefectureCode", label: "都道府県コード", type: "text", required: true, placeholder: "01-47" },
      { key: "application.councilCode", label: "地域協議会コード", type: "text", required: true, placeholder: "001-999" },
      { key: "applicant.nameKana", label: "交付申請者名（フリガナ）", type: "text", required: true },
      { key: "applicant.nameKanji", label: "交付申請者名（漢字）", type: "text", required: true },
      { key: "applicant.postalCode", label: "郵便番号", type: "text", required: true, placeholder: "100-0000" },
      { key: "applicant.address", label: "住所", type: "text", required: true },
      { key: "applicant.phone", label: "電話番号", type: "tel", required: true },
      { key: "applicant.email", label: "メールアドレス", type: "email" },
    ],
  },
  {
    id: "programs",
    title: "申請する制度",
    summary: "制度選択に応じて後続項目を整理",
    fields: [
      { key: "application.applyWaterDirectPayment", label: "水田活用の直接支払交付金", type: "select", required: true, options: yesNo },
      { key: "application.applyNewMarketRice", label: "コメ新市場開拓等促進事業", type: "select", required: true, options: yesNo },
      { key: "application.applyFieldCropFormation", label: "畑作物産地形成促進事業", type: "select", required: true, options: yesNo },
      { key: "application.applyFieldConversion", label: "畑地化促進事業", type: "select", required: true, options: yesNo },
      { key: "application.applyGeta", label: "畑作物の直接支払交付金（ゲタ）", type: "select", required: true, options: yesNo },
      { key: "application.applyNarashi", label: "収入減少影響緩和交付金（ナラシ）", type: "select", required: true, options: yesNo },
    ],
  },
  {
    id: "account",
    title: "口座・代理申請",
    summary: "金融機関、ゆうちょ、代理申請",
    fields: [
      {
        key: "account.notificationType",
        label: "口座届出書",
        type: "select",
        required: true,
        options: [
          { value: "0", label: "変更なし" },
          { value: "1", label: "新規加入" },
          { value: "2", label: "口座変更" },
        ],
      },
      { key: "account.bankCode", label: "金融機関コード", type: "text", placeholder: "4桁" },
      { key: "account.branchCode", label: "支店コード", type: "text", placeholder: "3桁" },
      { key: "account.accountType", label: "預金種目コード", type: "text", placeholder: "1=普通" },
      { key: "account.accountNumber", label: "口座番号", type: "text", placeholder: "7桁" },
      { key: "application.proxyType", label: "代理申請区分", type: "select", options: [{ value: "0", label: "なし" }, { value: "1", label: "代理申請" }] },
    ],
  },
  {
    id: "ricePlan",
    title: "営農計画",
    summary: "共済加入、水稲用途別面積・数量",
    fields: [
      { key: "insurance.rice", label: "農作物共済加入（水稲）", type: "select", required: true, options: yesNo },
      { key: "insurance.wheat", label: "農作物共済加入（麦）", type: "select", required: true, options: yesNo },
      { key: "insurance.soy", label: "畑作物共済加入（大豆）", type: "select", required: true, options: yesNo },
      { key: "rice.yieldKgPer10a", label: "水稲単収", type: "number", unit: "kg/10a" },
      { key: "rice.mainFoodAreaM2", label: "主食用米 生産予定面積", type: "number", unit: "㎡" },
      { key: "rice.processingAreaM2", label: "加工用米 生産予定面積", type: "number", unit: "㎡" },
      { key: "rice.feedAreaM2", label: "飼料用米 生産予定面積", type: "number", unit: "㎡" },
      { key: "rice.totalAreaM2", label: "水稲用途別 合計面積", type: "number", unit: "㎡" },
    ],
  },
  {
    id: "narashi",
    title: "ナラシ情報",
    summary: "ナラシ申請者情報と生産予定面積",
    fields: [
      { key: "narashi.prefectureOfficeCode", label: "県拠点コード", type: "text", placeholder: "2桁" },
      { key: "narashi.shipperCode", label: "出荷者コード", type: "text", placeholder: "5桁" },
      { key: "narashi.shipperBranchCode", label: "出荷者支所コード", type: "text", placeholder: "3桁" },
      { key: "narashi.cropCode", label: "対象農産物コード", type: "text", placeholder: "110など" },
      { key: "narashi.regionCode", label: "地域等コード", type: "text", placeholder: "3桁" },
      { key: "narashi.productionAreaM2", label: "生産予定面積", type: "number", unit: "㎡" },
    ],
  },
];

export const modelOptions = [
  { provider: "anthropic", modelId: "claude-sonnet-4-20250514", label: "Claude Sonnet 4（標準）" },
  { provider: "openai", modelId: "gpt-4.1-mini", label: "OpenAI gpt-4.1-mini" },
  { provider: "gemini", modelId: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

export const statusLabels: Record<string, string> = {
  draft: "下書き",
  ocr_draft: "OCR下書き",
  needs_review: "確認待ち",
  returned: "差戻し",
  submitted: "提出済み",
  accepted: "受付済み",
  export_ready: "出力可",
  exported: "出力済み",
  withdrawn: "取下げ",
};
