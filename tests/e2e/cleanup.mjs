import { randomUUID } from "node:crypto";
export default async function cleanup() {
  process.env.LOCAL_AUTH = "true";
  const { localUser, listCollections, snapshot, mutate } =
    await import("../../lib/repository.mjs");
  const { closeDb, pool } = await import("../../lib/db.mjs");
  const owner = await localUser("owner");
  for (const collection of await listCollections(owner)) {
    const s = await snapshot(collection.id, owner);
    for (const apt of s.apartments.filter(
      (a) => /^(Browser|Offline) \d+$/.test(a.name) && !a.archived,
    ))
      await mutate(collection.id, owner, {
        id: randomUUID(),
        type: "apartment.put",
        targetId: apt.id,
        expectedRevision: apt.revision,
        payload: { archived: true },
      });
    for (const r of s.records.filter(
      (r) =>
        r.kind === "attachment" &&
        r.name === "floor-plan.png" &&
        r.size < 100 &&
        !r.archived,
    ))
      await mutate(collection.id, owner, {
        id: randomUUID(),
        type: "record.put",
        targetId: r.id,
        expectedRevision: r.revision,
        apartmentId: r.apartmentId,
        payload: { archived: true },
      });
  }
  await pool().query("UPDATE users SET locale='en' WHERE id=$1", [owner.id]);
  await closeDb();
}
