import { z } from "zod";

// Upper limits for request values (AUDIT.md F-15). MAX_AMOUNT is the owner's
// ceiling for any single amount, agreed 2026-09-12; it fits a large receiver
// payment recorded in kyat. The others are sanity limits that keep values inside
// their column types and far from float overflow in the dashboard sums.
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_RATE = 1_000_000;
export const MAX_WEIGHT_KG = 100_000;
export const MAX_QUANTITY = 1_000_000;
export const MAX_PERCENT = 100;
export const MAX_LIST = 500;
// A nanoid (21 characters) or a legacy UUID (36).
export const MAX_ID = 36;

const atMost = (max: number) => `Must be ${max.toLocaleString("en-US")} or less`;
export const AMOUNT_LIMIT = atMost(MAX_AMOUNT);
export const RATE_LIMIT = atMost(MAX_RATE);
export const WEIGHT_LIMIT = atMost(MAX_WEIGHT_KG);
export const QUANTITY_LIMIT = atMost(MAX_QUANTITY);
export const LIST_LIMIT = `At most ${MAX_LIST} entries`;

/** True for a real calendar date written YYYY-MM-DD, which is what a Postgres date column accepts. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  // setUTCFullYear, unlike Date.UTC, doesn't turn years 0-99 into 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const isoDate = z.string().refine(isCalendarDate, "Date must be a real date, YYYY-MM-DD");

/** An optional date. Date inputs send "" when left empty, which means no date. */
export const optionalIsoDate = z.preprocess((v) => (v === "" ? null : v), isoDate.nullable().optional());
