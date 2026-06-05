type ExtractedField = {
  fieldKey: string;
  label: string;
  value: string | number | boolean | null;
  confidence: number;
  page?: number;
  rawText?: string;
};

type ExtractArgs = {
  provider: "openai" | "anthropic" | "gemini";
  modelId: string;
  filename: string;
  contentType: string;
  fileBase64: string;
};

const extractionPrompt = `
経営所得安定対策等の申請書PDFまたは画像から、申請フォームの下書き候補を抽出してください。
必ずJSONのみを返してください。
JSON形式:
{
  "fields": [
    {
      "fieldKey": "applicant.nameKanji",
      "label": "交付申請者名（漢字）",
      "value": "値",
      "confidence": 0.0から1.0,
      "page": 1,
      "rawText": "読み取った原文"
    }
  ]
}
主なfieldKey:
applicant.nameKanji, applicant.nameKana, applicant.postalCode, applicant.address,
applicant.phone, applicant.email,
application.applyWaterDirectPayment, application.applyGeta, application.applyNarashi,
account.bankCode, account.branchCode, account.accountNumber
`;

export async function extractFields(args: ExtractArgs): Promise<ExtractedField[]> {
  if (args.provider === "openai" && process.env.OPENAI_API_KEY) {
    return await extractWithOpenAI(args);
  }
  if (args.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return await extractWithAnthropic(args);
  }
  if (args.provider === "gemini" && process.env.GEMINI_API_KEY) {
    return await extractWithGemini(args);
  }
  return demoExtraction(args.filename);
}

async function extractWithOpenAI(args: ExtractArgs): Promise<ExtractedField[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.modelId,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: extractionPrompt,
            },
            {
              type: "input_file",
              filename: args.filename,
              file_data: `data:${args.contentType};base64,${args.fileBase64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "application_ocr_fields",
          schema: extractionSchema,
          strict: true,
        },
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message ?? "OpenAI OCR failed");
  return normalizeFields(JSON.parse(json.output_text ?? "{}"));
}

async function extractWithAnthropic(args: ExtractArgs): Promise<ExtractedField[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.modelId,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: args.contentType,
                data: args.fileBase64,
              },
            },
            { type: "text", text: extractionPrompt },
          ],
        },
      ],
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message ?? "Anthropic OCR failed");
  const text = json.content?.find((item: { type: string }) => item.type === "text")?.text ?? "{}";
  return normalizeFields(JSON.parse(stripCodeFence(text)));
}

async function extractWithGemini(args: ExtractArgs): Promise<ExtractedField[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${args.modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: extractionPrompt },
              {
                inline_data: {
                  mime_type: args.contentType,
                  data: args.fileBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema,
        },
      }),
    },
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message ?? "Gemini OCR failed");
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return normalizeFields(JSON.parse(text));
}

function normalizeFields(payload: unknown): ExtractedField[] {
  if (!payload || typeof payload !== "object" || !("fields" in payload)) return [];
  const fields = (payload as { fields: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field) => field && typeof field === "object")
    .map((field) => {
      const item = field as Record<string, unknown>;
      return {
        fieldKey: String(item.fieldKey ?? ""),
        label: String(item.label ?? item.fieldKey ?? ""),
        value: normalizeValue(item.value),
        confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
        page: typeof item.page === "number" ? item.page : undefined,
        rawText: typeof item.rawText === "string" ? item.rawText : undefined,
      };
    })
    .filter((field) => field.fieldKey && field.label);
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === undefined) return null;
  return String(value);
}

function stripCodeFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function demoExtraction(filename: string): ExtractedField[] {
  return [
    {
      fieldKey: "applicant.nameKanji",
      label: "交付申請者名（漢字）",
      value: "農林 太郎",
      confidence: 0.86,
      page: 1,
      rawText: `${filename}: 農林 太郎`,
    },
    {
      fieldKey: "applicant.nameKana",
      label: "交付申請者名（フリガナ）",
      value: "ﾉｳﾘﾝ ﾀﾛｳ",
      confidence: 0.74,
      page: 1,
    },
    {
      fieldKey: "applicant.postalCode",
      label: "郵便番号",
      value: "100-8950",
      confidence: 0.68,
      page: 1,
    },
    {
      fieldKey: "application.applyNarashi",
      label: "収入減少影響緩和交付金（ナラシ）の申請",
      value: "1",
      confidence: 0.61,
      page: 2,
    },
  ];
}

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldKey: { type: "string" },
          label: { type: "string" },
          value: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }],
          },
          confidence: { type: "number" },
          page: { type: "number" },
          rawText: { type: "string" },
        },
        required: ["fieldKey", "label", "value", "confidence"],
      },
    },
  },
  required: ["fields"],
};
