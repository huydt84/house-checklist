import { randomUUID } from "node:crypto";
import { localMode } from "../lib/config.mjs";
import {
  localUser,
  listCollections,
  createCollection,
  snapshot,
  mutate,
  applyPreset,
} from "../lib/repository.mjs";
import { pool, closeDb } from "../lib/db.mjs";
if (!localMode()) throw new Error("Sample data is local only");
const owner = await localUser("owner");
await localUser("editor");
await localUser("viewer");
await localUser("outsider");
if ((await listCollections(owner)).length) {
  console.log("Local collection already exists; sample data unchanged.");
  await closeDb();
  process.exit(0);
}
const collection = await createCollection(owner, "Tokyo apartment search");
const cid = collection.id;
await pool().query(
  "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,'10000000-0000-4000-8000-000000000002','editor'),($1,'10000000-0000-4000-8000-000000000003','viewer')",
  [cid],
);
await applyPreset(cid, owner);
let s = await snapshot(cid, owner);
await mutate(cid, owner, {
  id: randomUUID(),
  targetId: cid,
  type: "collection.put",
  expectedRevision: s.collection.revision,
  payload: { settings: { moveInDate: "2026-11-01" } },
});
s = await snapshot(cid, owner);
const examples = [
  {
    name: "Kiyosumi Garden · 402",
    address: "Kiyosumi, Koto-ku · sample apartment",
    status: "shortlisted",
    area: 27.4,
    rent: 130000,
    fee: 10000,
    layout: "1K",
    viewingAt: "2026-10-04T14:00:00+09:00",
  },
  {
    name: "Morishita Residence · 601",
    address: "Morishita, Koto-ku · sample apartment",
    status: "considering",
    area: 30.2,
    rent: 122000,
    fee: 8000,
    layout: "1DK",
    viewingAt: "2026-10-05T11:00:00+09:00",
  },
  {
    name: "Ningyocho Court · 305",
    address: "Nihombashi, Chuo-ku · sample apartment",
    status: "considering",
    area: 24.8,
    rent: 136000,
    fee: 9000,
    layout: "1K",
  },
];
for (const [index, e] of examples.entries()) {
  const apartmentId = randomUUID();
  await mutate(cid, owner, {
    id: randomUUID(),
    targetId: apartmentId,
    type: "apartment.put",
    expectedRevision: 0,
    payload: {
      name: e.name,
      address: e.address,
      status: e.status,
      viewingAt: e.viewingAt,
      rentStart: "2026-11-01",
      handoverDate: "2026-11-01",
      agentName: "Sample agent",
      advantages:
        index === 0 ? "Separate kitchen; room for a permanent desk." : "",
      disadvantages:
        index === 0 ? "Confirm the sound level with windows open." : "",
      costsReviewed: index === 0,
    },
  });
  const values = {
    A02: e.area,
    A03: e.layout,
    H01: e.rent,
    H02: e.fee,
  };
  if (index === 0)
    Object.assign(values, {
      A04: 3.4,
      A05: 2010,
      H03: 130000,
      H04: null,
      H10: null,
      F05: null,
      F06: null,
      G06: null,
      D02: "Bright in the afternoon; weather not recorded.",
      D03: "Confirm distance to the facing building.",
      C02: true,
    });
  for (const [key, value] of Object.entries(values)) {
    const c = s.criteria.find((c) => c.key === key);
    await mutate(cid, owner, {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "answer.put",
      expectedRevision: 0,
      checklistRevision: s.collection.checklistRevision,
      apartmentId,
      criterionId: c.id,
      payload: {
        state: value === null ? "not_applicable" : "answered",
        value,
        source: "estimate",
        notes: "Synthetic sample for local development.",
      },
    });
  }
  if (index === 0) {
    for (const r of [
      {
        kind: "cost",
        name: "Nonrefundable upfront fee",
        amount: 100000,
        frequencyUnit: "once",
        phase: "upfront",
        treatment: "expense",
        confirmed: true,
      },
      {
        kind: "adjustment",
        name: "Second month rent free",
        costId: "H01",
        full: true,
        startDate: "2026-12-01",
        endDate: "2027-01-01",
        confirmed: true,
      },
      {
        kind: "payment",
        name: "First month prepaid",
        costId: "H01",
        amount: 130000,
        coverageDate: "2026-11-01",
        paidAt: "2026-10-25",
        payer: "personal",
      },
    ])
      await mutate(cid, owner, {
        id: randomUUID(),
        targetId: randomUUID(),
        type: "record.put",
        expectedRevision: 0,
        apartmentId,
        payload: r,
      });
  }
  if (index < 2)
    await mutate(cid, owner, {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "record.put",
      expectedRevision: 0,
      apartmentId,
      payload: {
        kind: "question",
        text:
          index === 0
            ? "Is the internet connection shared with other apartments?"
            : "Can the viewing include the bicycle parking area?",
        responsible: "Sample agent",
        status: "open",
      },
    });
}
console.log("Created isolated local sample collection with three apartments.");
await closeDb();
