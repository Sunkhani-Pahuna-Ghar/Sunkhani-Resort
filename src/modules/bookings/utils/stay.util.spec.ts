import {
  listNights,
  nightsBetween,
  parseDateOnly,
  rangesOverlap,
  todayInNepal,
  validateStay,
} from "./stay.util";

describe("parseDateOnly", () => {
  it("accepts real dates", () => {
    expect(parseDateOnly("2026-12-31")).not.toBeNull();
    expect(parseDateOnly("2028-02-29")).not.toBeNull(); // leap year
  });
  it("rejects impossible or badly formatted dates", () => {
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-1", "26-01-01", "", "2026-01-01T00:00:00Z", "abc"]) {
      expect(parseDateOnly(bad)).toBeNull();
    }
  });
  it("rejects non-strings", () => {
    expect(parseDateOnly(20260101 as any)).toBeNull();
    expect(parseDateOnly({} as any)).toBeNull();
  });
});

describe("nights", () => {
  it("counts and lists nights, excluding the check-out day", () => {
    expect(nightsBetween("2026-12-01", "2026-12-04")).toBe(3);
    expect(listNights("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
  it("returns nothing for empty or reversed ranges", () => {
    expect(listNights("2026-12-01", "2026-12-01")).toEqual([]);
    expect(listNights("2026-12-05", "2026-12-01")).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("allows back-to-back stays", () => {
    expect(rangesOverlap("2026-12-01", "2026-12-05", "2026-12-05", "2026-12-08")).toBe(false);
    expect(rangesOverlap("2026-12-05", "2026-12-08", "2026-12-01", "2026-12-05")).toBe(false);
  });
  it("detects overlaps", () => {
    expect(rangesOverlap("2026-12-01", "2026-12-05", "2026-12-04", "2026-12-08")).toBe(true);
    expect(rangesOverlap("2026-12-01", "2026-12-10", "2026-12-03", "2026-12-04")).toBe(true); // contained
    expect(rangesOverlap("2026-12-03", "2026-12-04", "2026-12-01", "2026-12-10")).toBe(true);
    expect(rangesOverlap("2026-12-01", "2026-12-05", "2026-12-01", "2026-12-05")).toBe(true); // identical
  });
});

describe("validateStay", () => {
  const today = "2026-10-15";
  it("accepts a normal stay, and one starting today", () => {
    expect(validateStay("2026-11-01", "2026-11-04", today)).toBeNull();
    expect(validateStay("2026-10-15", "2026-10-16", today)).toBeNull();
  });
  it("rejects the past", () => {
    expect(validateStay("2026-10-14", "2026-10-16", today)).toMatch(/past/);
  });
  it("rejects check-out on or before check-in", () => {
    expect(validateStay("2026-11-05", "2026-11-05", today)).toMatch(/after/);
    expect(validateStay("2026-11-05", "2026-11-01", today)).toMatch(/after/);
  });
  it("allows exactly 60 nights but not 61", () => {
    expect(validateStay("2026-11-01", "2026-12-31", today)).toBeNull(); // 60 nights
    expect(validateStay("2026-11-01", "2027-01-01", today)).toMatch(/at most 60/);
  });
  it("rejects stays too far ahead", () => {
    expect(validateStay("2029-01-01", "2029-01-03", today)).toMatch(/far/);
  });
  it("rejects impossible dates", () => {
    expect(validateStay("2026-02-30", "2026-03-02", today)).toMatch(/real date/);
    expect(validateStay("2026-11-01", "nope", today)).toMatch(/real date/);
  });
});

describe("todayInNepal", () => {
  it("returns a YYYY-MM-DD string and uses Nepal time (UTC+5:45)", () => {
    expect(todayInNepal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 19:00 UTC on the 14th is already 00:45 on the 15th in Nepal
    expect(todayInNepal(new Date("2026-10-14T19:00:00Z"))).toBe("2026-10-15");
    expect(todayInNepal(new Date("2026-10-14T18:00:00Z"))).toBe("2026-10-14");
  });
});
