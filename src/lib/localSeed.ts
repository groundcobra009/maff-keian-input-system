import type { ApplicationDetail, AppRecord } from "../types";

const now = Date.now();

export const initialApplications: AppRecord[] = [
  {
    id: "local-1",
    title: "令和9年産 交付申請 / 農林 太郎",
    year: "2027",
    status: "draft",
    updatedAt: now,
  },
];

export const initialDetail: ApplicationDetail = {
  application: initialApplications[0],
  values: [
    { fieldKey: "application.managementCode", value: "0000000000001", source: "manual", status: "draft" },
    { fieldKey: "application.prefectureCode", value: "13", source: "manual", status: "draft" },
    { fieldKey: "application.councilCode", value: "001", source: "manual", status: "draft" },
    { fieldKey: "applicant.nameKanji", value: "農林 太郎", source: "manual", status: "draft" },
    { fieldKey: "applicant.nameKana", value: "ﾉｳﾘﾝ ﾀﾛｳ", source: "manual", status: "draft" },
    { fieldKey: "applicant.postalCode", value: "100-8950", source: "manual", status: "draft" },
    { fieldKey: "applicant.address", value: "東京都千代田区霞が関", source: "manual", status: "draft" },
    { fieldKey: "applicant.phone", value: "03-0000-0000", source: "manual", status: "draft" },
    { fieldKey: "application.applyWaterDirectPayment", value: "1", source: "manual", status: "draft" },
    { fieldKey: "application.applyGeta", value: "0", source: "manual", status: "draft" },
    { fieldKey: "application.applyNarashi", value: "1", source: "manual", status: "draft" },
  ],
  parcels: [
    {
      id: "parcel-1",
      fieldNo: "0001",
      splitNo: "001",
      cropSeason: "1",
      location: "霞が関1番地",
      landCategory: "1",
      mainAreaM2: 1200,
      cropAreaM2: 1150,
      cropName: "加工用米",
      cropType: "水稲",
      paymentExcluded: false,
      continuationExcluded: false,
    },
  ],
  ocrResults: [],
  issues: [],
};
