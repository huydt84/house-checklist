import sources from "../data/seed-source.json" with { type: "json" };
import translated from "../data/seed-translations.json" with { type: "json" };
export const TEMPLATE_VERSION = 1;
const labels = {
  A: ["Initial screening", "初期確認", "Sàng lọc ban đầu"],
  B: ["Travel for each person", "各人の移動", "Đi lại của từng người"],
  C: ["Layout & belongings", "間取りと持ち物", "Bố trí và đồ dùng"],
  D: ["Light, air & noise", "光・換気・音", "Ánh sáng, gió và tiếng ồn"],
  E: ["Kitchen & washing", "キッチン・水回り", "Bếp và giặt giũ"],
  F: [
    "Utilities & internet",
    "設備・インターネット",
    "Điện, điều hòa và internet",
  ],
  G: ["Neighborhood & moving", "周辺環境・引越し", "Khu vực và chuyển nhà"],
  H: ["Costs & payments", "費用と支払い", "Chi phí và thanh toán"],
  I: ["Lease & signing", "契約前の確認", "Hợp đồng và ký kết"],
  J: [
    "Corporate lease & allowance",
    "法人契約・住宅手当",
    "Thuê công ty và trợ cấp",
  ],
  K: ["Additional checks", "追加の確認", "Kiểm tra bổ sung"],
};
export const sectionTemplates = Object.entries(labels).map(
  ([key, [en, ja, vi]], order) => ({
    key,
    labels: { en, ja, vi },
    order,
    enabled: !["J", "K"].includes(key),
  }),
);
const stageDefaults = {
  A: ["L", "A"],
  B: ["L", "V"],
  C: ["V"],
  D: ["V"],
  E: ["V"],
  F: ["A", "S"],
  G: ["L", "V"],
  H: ["A", "S"],
  I: ["A", "S"],
  J: ["A", "S"],
};
const stageOverrides = {
  A03: "LV",
  A04: "V",
  A05: "LAV",
  A06: "LAS",
  A07: "AS",
  A08: "AS",
  A09: "LAVS",
  D01: "LV",
  D09: "AV",
  E01: "LV",
  E09: "AVS",
  F01: "AVS",
  F02: "V",
  F03: "LAS",
  F09: "V",
  F10: "AV",
  G05: "AVS",
  G06: "AVS",
  G07: "V",
  G08: "AS",
  G09: "AS",
  H01: "LAS",
  H02: "LAS",
  H03: "LAS",
  H04: "LAS",
  J06: "LAS",
  K01: "V",
  K02: "AV",
  K03: "AVS",
  K04: "V",
  K05: "LS",
  K06: "AV",
  K07: "AS",
};
const choice = (id, en, ja, vi) => ({ id, labels: { en, ja, vi } });
const options = {
  A03: ["1R", "1K", "1DK", "1LDK", "2K"]
    .map((x) => choice(x, x, x, x))
    .concat(choice("other", "Other", "その他", "Khác")),
  D01: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    .map((x, i) =>
      choice(
        x,
        x,
        ["北", "北東", "東", "南東", "南", "南西", "西", "北西"][i],
        [
          "Bắc",
          "Đông Bắc",
          "Đông",
          "Đông Nam",
          "Nam",
          "Tây Nam",
          "Tây",
          "Tây Bắc",
        ][i],
      ),
    )
    .concat(
      choice("other", "Other", "その他", "Khác"),
      choice("unknown", "Unknown", "不明", "Chưa rõ"),
    ),
  F03: [
    choice("included", "Included", "込み", "Đã bao gồm"),
    choice(
      "separate",
      "Separate contract required",
      "別契約が必要",
      "Cần hợp đồng riêng",
    ),
    choice("unknown", "Unknown", "不明", "Chưa rõ"),
  ],
  E10: [
    choice("toshi", "Toshi (city gas)", "都市ガス", "Toshi (ga đô thị)"),
    choice("propane", "Propane", "プロパン", "Propane"),
    choice("other", "Other", "その他", "Other (khác)"),
  ],
};
const field = (id, unit, en, ja, vi) => ({
  id,
  type: "number",
  unit,
  labels: { en, ja, vi },
});
const support = {
  C01: [
    field("length", "m", "Usable length", "有効な長さ", "Chiều dài sử dụng"),
    field("width", "m", "Usable width", "有効な幅", "Chiều rộng sử dụng"),
  ],
  E04: [
    {
      id: "available",
      type: "boolean",
      labels: { en: "Refrigerator", ja: "冷蔵庫", vi: "Tủ lạnh" },
    },
    field("width", "m", "Width", "幅", "Chiều rộng"),
    field("depth", "m", "Depth", "奥行き", "Chiều sâu"),
    field("height", "m", "Height", "高さ", "Chiều cao"),
  ],
  E07: [
    {
      id: "available",
      type: "boolean",
      labels: { en: "Washing machine", ja: "洗濯機", vi: "Máy giặt" },
    },
    field("width", "m", "Width", "幅", "Chiều rộng"),
    field("depth", "m", "Depth", "奥行き", "Chiều sâu"),
  ],
  F09: [
    field("download", "Mbps", "Download", "下り", "Tải xuống"),
    field("upload", "Mbps", "Upload", "上り", "Tải lên"),
    field("latency", "ms", "Latency", "遅延", "Độ trễ"),
  ],
  G06: [
    field(
      "station",
      "JPY/month",
      "Station bicycle parking",
      "駅の駐輪場",
      "Đỗ xe đạp ở ga",
    ),
  ],
};
export const criterionTemplates = sources.flatMap((source, index) => {
  const base = {
    ...source,
    sourceKey: source.key,
    labels: {
      en: source.label,
      ja: translated[source.key].ja.label,
      vi: translated[source.key].vi.label,
    },
    guidance: {
      en: source.guidance,
      ja: translated[source.key].ja.guidance,
      vi: translated[source.key].vi.guidance,
    },
    sourceLocale: "en",
    order: index * 10,
    importance: "information",
    stages:
      stageOverrides[source.key]?.split("") || stageDefaults[source.section],
    choices: options[source.key] || [],
    supportFields: support[source.key] || [],
    archived: false,
    scope: source.section === "B" ? "journey" : "apartment",
  };
  delete base.label;
  if (source.key === "B02")
    return ["distance", "duration"].map((part, i) => ({
      ...base,
      key: `B02.${part}`,
      unit: i ? "minutes" : "m",
      order: base.order + i,
      labels: {
        en: i ? "Walking duration" : "Walking distance",
        ja: i ? "徒歩の所要時間" : "徒歩の距離",
        vi: i ? "Thời gian đi bộ" : "Khoảng cách đi bộ",
      },
    }));
  if (source.key === "B07")
    return ["one_way", "return"].map((part, i) => ({
      ...base,
      key: `B07.${part}`,
      unit: "JPY",
      order: base.order + i,
      labels: {
        en: i ? "Return fare" : "Outbound fare",
        ja: i ? "復路の運賃" : "往路の運賃",
        vi: i ? "Giá lượt về" : "Giá lượt đi",
      },
    }));
  if (source.key === "B04") base.unit = "transfers";
  if (source.key === "E02") base.unit = "burners";
  return [base];
});
export function instantiateTemplate(uuid) {
  const sections = sectionTemplates.map((s) => ({
    ...s,
    id: uuid(),
    revision: 1,
  }));
  const criteria = criterionTemplates.map((c) => ({
    ...c,
    id: uuid(),
    sectionId: sections.find((s) => s.key === c.section).id,
    revision: 1,
  }));
  return { sections, criteria };
}
export const personalPreset = {
  budget: 140000,
  minArea: 25,
  maxWalkMinutes: 10,
  preferDirect: true,
  workDestination: "Shin-Nihombashi",
  futonWidth: 1.3,
  futonLength: 1.8,
  permanentDesk: true,
  allowanceAmount: 30000,
  allowanceRadius: 5,
  allowanceConfirmed: false,
  moveInDate: "",
};
export const presetScenarios = [
  {
    name: "Work commute",
    person: "Renter",
    purpose: "work",
    origin: "Apartment",
    destination: "Shin-Nihombashi",
    returnDestination: "Apartment",
    frequency: null,
    frequencyUnit: "week",
  },
  {
    name: "Visit from home",
    person: "Partner",
    purpose: "partner_home",
    origin: "Higashi-Nakayama",
    destination: "Apartment",
    returnDestination: "Higashi-Nakayama",
    frequency: 1,
    frequencyUnit: "week",
  },
  {
    name: "Visit from work",
    person: "Partner",
    purpose: "partner_work",
    origin: "Toyosu",
    destination: "Apartment",
    returnDestination: "Higashi-Nakayama",
    frequency: 1,
    frequencyUnit: "week",
  },
];
