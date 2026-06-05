export function downloadText(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type LocalCouncilSettings = {
  prefectureCode?: string;
  councilCode?: string;
  managementCode?: string;
};

export function buildLocalCsv(values: Map<string, string | number | boolean | null>, year: string, councilSettings?: LocalCouncilSettings | null) {
  const headers = [
    "ファイル識別コード",
    "都道府県コード",
    "地域協議会コード",
    "地域協議会等管理コード",
    "申請年産",
    "交付申請者名（フリガナ）",
    "交付申請者名（漢字）",
    "郵便番号",
    "住所",
    "電話番号",
    "ナラシ申請",
  ];
  const row = [
    "1",
    councilSettings?.prefectureCode ?? values.get("application.prefectureCode") ?? "",
    councilSettings?.councilCode ?? values.get("application.councilCode") ?? "",
    councilSettings?.managementCode ?? values.get("application.managementCode") ?? "",
    year,
    values.get("applicant.nameKana") ?? "",
    values.get("applicant.nameKanji") ?? "",
    values.get("applicant.postalCode") ?? "",
    values.get("applicant.address") ?? "",
    values.get("applicant.phone") ?? "",
    values.get("application.applyNarashi") ?? "",
  ];
  return [headers, row].map((items) => items.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
