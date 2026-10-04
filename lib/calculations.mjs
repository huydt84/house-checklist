import Decimal from "decimal.js";
import { DateTime } from "luxon";
import { fieldValue, fieldAnswer } from "./domain.mjs";
const D = (x) => new Decimal(x ?? 0);
const date = (x) =>
  x ? DateTime.fromISO(x, { zone: "Asia/Tokyo" }).startOf("day") : null;
const valid = (x) =>
  x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x));
const yen = (x) => Number(D(x).toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
export function resolveAmount(item, bases = {}) {
  let amount;
  if (item.formula?.type === "rent_multiple") {
    if (!valid(bases.rent) || !valid(item.formula.factor)) return null;
    amount = D(bases.rent).mul(item.formula.factor);
  } else if (item.formula?.type === "percentage") {
    if (
      !item.formula.bases?.length ||
      !valid(item.formula.percent) ||
      item.formula.bases.some((key) => !valid(bases[key]))
    )
      return null;
    amount = item.formula.bases
      .reduce((sum, key) => sum.add(bases[key]), D(0))
      .mul(item.formula.percent)
      .div(100);
  } else {
    if (item.formula?.type && item.formula.type !== "fixed") return null;
    if (!valid(item.amount)) return null;
    amount = D(item.amount);
  }
  if (item.taxTreatment === "exclusive") {
    if (!valid(item.taxRate)) return null;
    amount = amount.mul(D(1).add(D(item.taxRate).div(100)));
  }
  return amount;
}
export function calculateCosts({
  items = [],
  adjustments = [],
  benefits = [],
  payments = [],
  startDate,
  months = 24,
  handoverDate,
  moveOutDate,
  reviewed = false,
  bases = {},
}) {
  const start = date(startDate),
    end = start?.isValid ? start.plus({ months }) : null;
  const result = {
    expense: null,
    net: null,
    upfront: null,
    monthly: 0,
    deposits: 0,
    holds: 0,
    confirmedBenefits: 0,
    missing: [],
    disputed: [],
    dueAfter: [],
    assumptions: [],
    lines: [],
    complete: false,
  };
  if (!start?.isValid) {
    result.missing.push("startDate");
    let knownMonthly = D(0);
    for (const item of items.filter(
      (i) =>
        !i.archived &&
        i.state !== "not_applicable" &&
        i.frequencyUnit === "monthly",
    )) {
      const amount = resolveAmount(item, bases);
      if (item.duplicateGroup && !item.duplicateResolved)
        result.disputed.push(item);
      else if (amount === null) result.missing.push(item.id);
      else if (!item.treatment || item.treatment === "expense")
        knownMonthly = knownMonthly.add(amount);
    }
    result.monthly = yen(knownMonthly);
    return result;
  }
  if (!reviewed) result.missing.push("unreviewedCharges");
  let expense = D(0),
    monthly = D(0),
    upfront = D(0),
    deposits = D(0),
    holds = D(0),
    confirmedBenefits = D(0);
  const handover = date(handoverDate) || start;
  const active = items.filter(
    (i) => !i.archived && i.state !== "not_applicable",
  );
  for (const item of active) {
    if (item.duplicateGroup && !item.duplicateResolved) {
      result.disputed.push(item);
      continue;
    }
    const amount = resolveAmount(item, bases);
    if (amount === null) {
      result.missing.push(item.id);
      continue;
    }
    const anchor = date(item.startDate) || start;
    if (!anchor?.isValid) {
      result.missing.push(item.id);
      continue;
    }
    if (item.taxTreatment === "unknown") result.missing.push(`${item.id}:tax`);
    let dates = [];
    if (item.phase === "move_out") {
      if (!moveOutDate) {
        result.assumptions.push(`${item.id}:moveOutNotAssumed`);
        continue;
      }
      dates = [date(moveOutDate)];
    } else if (
      item.frequencyUnit === "monthly" ||
      item.frequencyUnit === "annual"
    ) {
      const step = item.frequencyUnit === "annual" ? 12 : 1;
      for (let n = 0; n < 1200; n++) {
        const at = anchor.plus({ months: n * step });
        if (at > end) break;
        dates.push(at);
      }
    } else if (item.frequencyUnit === "renewal")
      dates = [
        date(item.dueDate) || anchor.plus({ months: item.renewalMonths || 24 }),
      ];
    else dates = [date(item.dueDate) || anchor];
    if (item.endDate) dates = dates.filter((at) => at < date(item.endDate));
    const events = dates.filter(
      (at) =>
        (at >= start ||
          (item.phase === "upfront" &&
            !["monthly", "annual"].includes(item.frequencyUnit))) &&
        (at < end || (item.phase === "move_out" && +at === +end)),
    );
    for (const at of dates.filter(
      (at) => +at === +end && item.phase !== "move_out",
    ))
      result.dueAfter.push({
        id: item.id,
        name: item.name,
        amount: yen(amount),
        date: at.toISODate(),
      });
    let line = D(0);
    for (const at of events) {
      let due = amount;
      for (const adj of adjustments.filter(
        (a) =>
          !a.archived &&
          a.confirmed &&
          (a.costId === item.id || a.costId === item.amountSource),
      )) {
        const from = date(adj.startDate) || start,
          to = date(adj.endDate) || end;
        if (at >= from && at < to) {
          const resolved = resolveAmount(adj, bases);
          if (!adj.full && resolved === null) {
            if (!result.missing.includes(adj.id)) result.missing.push(adj.id);
            continue;
          }
          const discount = adj.full ? due : resolved;
          due = Decimal.max(0, due.minus(discount));
        }
      }
      if (item.treatment === "deposit") {
        deposits = deposits.add(due);
      } else if (item.treatment === "hold") {
        holds = holds.add(due);
      } else line = line.add(due);
      const coveredPayments = payments.filter(
        (p) =>
          !p.archived &&
          (p.costId === item.id || p.costId === item.amountSource) &&
          p.coverageDate === at.toISODate() &&
          p.paymentType !== "refund",
      );
      // A payment settles the obligation; it never creates a second expense.
      if (coveredPayments.length) {
        const paid = coveredPayments
          .filter(
            (p) => (date(p.paidAt) || at) <= handover && p.payer !== "employer",
          )
          .reduce((sum, p) => sum.add(valid(p.amount) ? p.amount : 0), D(0));
        upfront = upfront.add(paid);
        const totalPaid = coveredPayments.reduce(
          (sum, p) => sum.add(valid(p.amount) ? p.amount : 0),
          D(0),
        );
        if (at <= handover && item.payer !== "employer")
          upfront = upfront.add(Decimal.max(0, due.minus(totalPaid)));
      } else if (
        (item.phase === "upfront" || at <= handover) &&
        item.payer !== "employer"
      )
        upfront = upfront.add(due);
    }
    expense = expense.add(line);
    if (
      item.frequencyUnit === "monthly" &&
      (!item.treatment || item.treatment === "expense")
    )
      monthly = monthly.add(amount);
    result.lines.push({
      id: item.id,
      name: item.name,
      amount: yen(line),
      occurrences: events.length,
      treatment: item.treatment || "expense",
    });
  }
  for (const refund of payments.filter(
    (p) => !p.archived && p.paymentType === "refund" && p.payer !== "employer",
  )) {
    if ((date(refund.paidAt) || end) <= handover && valid(refund.amount))
      upfront = upfront.minus(refund.amount);
  }
  for (const benefit of benefits.filter((b) => !b.archived)) {
    if (
      !benefit.confirmed ||
      benefit.compatible === false ||
      benefit.compatible == null
    ) {
      result.assumptions.push(`${benefit.id}:unconfirmedBenefit`);
      continue;
    }
    const amount = resolveAmount(benefit, bases);
    if (amount === null) {
      result.missing.push(benefit.id);
      continue;
    }
    const from = date(benefit.startDate) || start,
      to = date(benefit.endDate) || end;
    const monthsCount = Array.from({ length: months }, (_, n) =>
      start.plus({ months: n }),
    ).filter((at) => at >= from && at < to).length;
    const occurrences =
      benefit.frequencyUnit === "monthly"
        ? monthsCount
        : benefit.frequencyUnit === "annual"
          ? Array.from({ length: Math.ceil(months / 12) }, (_, n) =>
              start.plus({ years: n }),
            ).filter((at) => at >= from && at < to).length
          : from < end && to > start
            ? 1
            : 0;
    confirmedBenefits = confirmedBenefits.add(amount.mul(occurrences));
  }
  return {
    ...result,
    expense: yen(expense),
    net: yen(expense.minus(confirmedBenefits)),
    upfront: yen(upfront),
    monthly: yen(monthly),
    deposits: yen(deposits),
    holds: yen(holds),
    confirmedBenefits: yen(confirmedBenefits),
    complete: result.missing.length === 0 && result.disputed.length === 0,
    startDate: start.toISODate(),
    endDate: end.toISODate(),
  };
}
const automaticCosts = [
  ["H01", "rent", "monthly", "expense"],
  ["H02", "management", "monthly", "expense"],
  ["H03", "deposit", "once", "deposit"],
  ["H04", "keyMoney", "once", "expense"],
  ["H10", "lock", "once", "expense"],
  ["F05", "internet", "monthly", "expense"],
  ["F06", "internetSetup", "once", "expense"],
  ["G06", "bicycleParking", "monthly", "expense"],
];
export function apartmentCosts(snapshot, apartmentId) {
  const apartment = snapshot.apartments.find((a) => a.id === apartmentId);
  if (!apartment) return null;
  // Automatic totals use canonical checklist amounts only. The optional
  // cost-record section is a reference ledger, regardless of record names.
  const items = automaticCosts.map(([key, name, frequencyUnit, treatment]) => ({
    id: key,
    name,
    amount: fieldValue(snapshot, apartmentId, key),
    state: fieldAnswer(snapshot, apartmentId, key)?.state,
    frequencyUnit,
    treatment,
    phase: frequencyUnit === "once" ? "upfront" : "recurring",
    payer: "personal",
  }));
  const station = fieldAnswer(snapshot, apartmentId, "G06")?.support?.station;
  if (valid(station))
    items.push({
      id: "G06.station",
      name: "stationParking",
      amount: station,
      frequencyUnit: "monthly",
      treatment: "expense",
    });
  const startDate =
    apartment.rentStart || snapshot.collection.settings.moveInDate;
  const result = calculateCosts({
    items,
    months: 1,
    startDate,
    handoverDate: apartment.handoverDate,
    moveOutDate: apartment.moveOutDate,
    reviewed: apartment.costsReviewed,
  });
  if (!apartment.rentStart && startDate)
    result.assumptions.push("collectionMoveInDate");
  const housing = ["H01", "H02"].map((key) => {
    const answer = fieldAnswer(snapshot, apartmentId, key);
    if (answer?.state === "not_applicable") return 0;
    return fieldValue(snapshot, apartmentId, key);
  });
  result.monthly = housing.every(valid)
    ? yen(D(housing[0]).add(housing[1]))
    : null;
  // The two-year estimate is explicitly entered by the user, independent of
  // dates, checklist charges, and optional reference records.
  result.expense = valid(apartment.expense24) ? yen(apartment.expense24) : null;
  result.net = result.expense;
  return result;
}
export function calculateTravel({ scenario, journey, startDate, months = 24 }) {
  const start = date(startDate),
    end = start?.isValid ? start.plus({ months }) : null;
  if (!start?.isValid || !valid(scenario.frequency))
    return { total: null, monthly: null, missing: ["frequencyOrDate"] };
  const missing = [];
  for (const k of ["outboundFare", "returnFare"])
    if (!valid(journey[k])) missing.push(k);
  if (journey.includeTaxi && !valid(journey.taxiFare)) missing.push("taxiFare");
  const occurrences =
    scenario.frequencyUnit === "month"
      ? D(scenario.frequency).mul(months)
      : D(end.diff(start, "days").days).div(7).mul(scenario.frequency);
  const gross = D(journey.outboundFare)
    .add(D(journey.returnFare))
    .add(D(journey.taxiFare))
    .add(D(journey.bookingSurcharge));
  const reimbursement = journey.reimbursementConfirmed
    ? Decimal.min(gross, D(journey.reimbursed))
    : D(0);
  return {
    total: yen(gross.mul(occurrences)),
    net: yen(gross.minus(reimbursement).mul(occurrences)),
    monthly: yen(gross.mul(occurrences).div(months)),
    occurrences: occurrences.toNumber(),
    missing,
    days: end.diff(start, "days").days,
  };
}
