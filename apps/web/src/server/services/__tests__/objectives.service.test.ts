import { describe, it, expect, vi } from "vitest";
import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

// Mock prisma
vi.mock("@packages/db", () => ({
  prisma: {
    objective: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  Prisma: {
    JsonNull: "JsonNull",
  },
}));

import {
  getTimeframeDates,
  getNextPeriodDates,
  getParentTimeframe,
  formatTimeframePeriod,
} from "../objectives.service";

describe("Objectives Service - Date Calculations", () => {
  describe("getTimeframeDates", () => {
    const testDate = new Date("2026-06-15T12:00:00Z");

    it("should return correct yearly dates", () => {
      const result = getTimeframeDates("yearly", testDate);

      expect(result.startDate).toEqual(startOfYear(testDate));
      expect(result.endDate).toEqual(endOfYear(testDate));
    });

    it("should return correct monthly dates", () => {
      const result = getTimeframeDates("monthly", testDate);

      expect(result.startDate).toEqual(startOfMonth(testDate));
      expect(result.endDate).toEqual(endOfMonth(testDate));
    });

    it("should return correct weekly dates (week starting Monday)", () => {
      const result = getTimeframeDates("weekly", testDate);

      expect(result.startDate).toEqual(startOfWeek(testDate, { weekStartsOn: 1 }));
      expect(result.endDate).toEqual(endOfWeek(testDate, { weekStartsOn: 1 }));
    });

    it("should use current date if no reference date provided", () => {
      const now = new Date();
      const result = getTimeframeDates("yearly");

      expect(result.startDate).toEqual(startOfYear(now));
      expect(result.endDate.getFullYear()).toEqual(now.getFullYear());
    });
  });

  describe("getNextPeriodDates", () => {
    it("should return next year dates from yearly end date", () => {
      const currentEndDate = new Date("2026-12-31T23:59:59Z");
      const result = getNextPeriodDates("yearly", currentEndDate);

      expect(result.startDate.getFullYear()).toBe(2027);
      expect(result.endDate.getFullYear()).toBe(2027);
    });

    it("should return next month dates from monthly end date", () => {
      const currentEndDate = new Date("2026-06-30T23:59:59Z");
      const result = getNextPeriodDates("monthly", currentEndDate);

      expect(result.startDate.getMonth()).toBe(6); // July (0-indexed)
      expect(result.endDate.getMonth()).toBe(6);
    });

    it("should return next week dates from weekly end date", () => {
      // End of week (Sunday)
      const currentEndDate = new Date("2026-06-21T23:59:59Z"); // Sunday
      const result = getNextPeriodDates("weekly", currentEndDate);

      // Next week should start on Monday (22nd) and end on Sunday (28th)
      expect(result.startDate.getDay()).toBe(1); // Monday
      expect(result.endDate.getDay()).toBe(0); // Sunday
    });
  });

  describe("getParentTimeframe", () => {
    it("should return monthly for weekly timeframe", () => {
      expect(getParentTimeframe("weekly")).toBe("monthly");
    });

    it("should return yearly for monthly timeframe", () => {
      expect(getParentTimeframe("monthly")).toBe("yearly");
    });

    it("should return undefined for yearly timeframe", () => {
      expect(getParentTimeframe("yearly")).toBeUndefined();
    });
  });

  describe("formatTimeframePeriod", () => {
    it("should format yearly as just the year", () => {
      const start = new Date("2026-01-01");
      const end = new Date("2026-12-31");

      expect(formatTimeframePeriod("yearly", start, end)).toBe("2026");
    });

    it("should format monthly as Month Year", () => {
      const start = new Date("2026-06-01");
      const end = new Date("2026-06-30");

      expect(formatTimeframePeriod("monthly", start, end)).toBe("June 2026");
    });

    it("should format weekly as date range", () => {
      const start = new Date("2026-06-15");
      const end = new Date("2026-06-21");

      const result = formatTimeframePeriod("weekly", start, end);
      expect(result).toContain("Jun 15");
      expect(result).toContain("Jun 21, 2026");
    });
  });
});

describe("Objectives Service - Timeframe Edge Cases", () => {
  it("should handle year boundary correctly", () => {
    const newYearsEve = new Date("2026-12-31T23:59:59Z");
    const nextPeriod = getNextPeriodDates("yearly", newYearsEve);

    expect(nextPeriod.startDate.getFullYear()).toBe(2027);
  });

  it("should handle month boundary correctly", () => {
    const lastDayOfMonth = new Date("2026-02-28T23:59:59Z");
    const nextPeriod = getNextPeriodDates("monthly", lastDayOfMonth);

    expect(nextPeriod.startDate.getMonth()).toBe(2); // March
  });

  it("should handle leap year correctly", () => {
    // 2028 is a leap year
    const leapYearFeb = new Date("2028-02-29T12:00:00Z");
    const monthly = getTimeframeDates("monthly", leapYearFeb);

    expect(monthly.endDate.getDate()).toBe(29);
  });
});

describe("Objectives Service - Week Start (Monday)", () => {
  it("should start week on Monday", () => {
    // Wednesday June 17, 2026
    const wednesday = new Date("2026-06-17T12:00:00Z");
    const result = getTimeframeDates("weekly", wednesday);

    // Monday should be June 15
    expect(result.startDate.getDay()).toBe(1); // Monday
    expect(result.startDate.getDate()).toBe(15);
  });

  it("should end week on Sunday", () => {
    const wednesday = new Date("2026-06-17T12:00:00Z");
    const result = getTimeframeDates("weekly", wednesday);

    // Sunday should be June 21
    expect(result.endDate.getDay()).toBe(0); // Sunday
    expect(result.endDate.getDate()).toBe(21);
  });

  it("should handle Monday correctly", () => {
    const monday = new Date("2026-06-15T12:00:00Z");
    const result = getTimeframeDates("weekly", monday);

    expect(result.startDate.getDate()).toBe(15);
  });

  it("should handle Sunday correctly", () => {
    const sunday = new Date("2026-06-21T12:00:00Z");
    const result = getTimeframeDates("weekly", sunday);

    // Should still be in the same week (June 15-21)
    expect(result.startDate.getDate()).toBe(15);
    expect(result.endDate.getDate()).toBe(21);
  });
});
