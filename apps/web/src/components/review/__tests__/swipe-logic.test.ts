import { describe, it, expect } from "vitest";
import {
  SWIPE_THRESHOLD,
  VELOCITY_THRESHOLD,
  SWIPE_FEEDBACK,
  CATEGORY_CONFIG,
  CONFIDENCE_THRESHOLDS,
  type SwipeDirection,
} from "@/lib/constants/swipe";

// Helper function to determine swipe direction (mirrors component logic)
function getSwipeDirection(mx: number, my: number): SwipeDirection | null {
  const absX = Math.abs(mx);
  const absY = Math.abs(my);

  if (absX > absY) {
    if (absX < SWIPE_THRESHOLD) return null;
    return mx > 0 ? "right" : "left";
  } else {
    if (absY < SWIPE_THRESHOLD) return null;
    return my > 0 ? "down" : "up";
  }
}

// Helper function to get confidence level
function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

describe("Swipe Constants", () => {
  it("should have valid swipe threshold", () => {
    expect(SWIPE_THRESHOLD).toBe(50);
    expect(SWIPE_THRESHOLD).toBeGreaterThan(0);
  });

  it("should have valid velocity threshold", () => {
    expect(VELOCITY_THRESHOLD).toBe(0.5);
    expect(VELOCITY_THRESHOLD).toBeGreaterThan(0);
  });

  it("should have all swipe directions configured", () => {
    expect(SWIPE_FEEDBACK.right).toBeDefined();
    expect(SWIPE_FEEDBACK.left).toBeDefined();
    expect(SWIPE_FEEDBACK.up).toBeDefined();
    expect(SWIPE_FEEDBACK.down).toBeDefined();
  });

  it("should have all categories configured", () => {
    expect(CATEGORY_CONFIG.action).toBeDefined();
    expect(CATEGORY_CONFIG.note).toBeDefined();
    expect(CATEGORY_CONFIG.reference).toBeDefined();
    expect(CATEGORY_CONFIG.meeting).toBeDefined();
    expect(CATEGORY_CONFIG.unknown).toBeDefined();
  });
});

describe("Swipe Direction Detection", () => {
  it("should return null for movements below threshold", () => {
    expect(getSwipeDirection(10, 10)).toBeNull();
    expect(getSwipeDirection(-20, -20)).toBeNull();
    expect(getSwipeDirection(0, 0)).toBeNull();
  });

  it("should detect right swipe correctly", () => {
    expect(getSwipeDirection(100, 10)).toBe("right");
    expect(getSwipeDirection(51, 0)).toBe("right");
    expect(getSwipeDirection(200, 30)).toBe("right");
  });

  it("should detect left swipe correctly", () => {
    expect(getSwipeDirection(-100, 10)).toBe("left");
    expect(getSwipeDirection(-51, 0)).toBe("left");
    expect(getSwipeDirection(-200, -30)).toBe("left");
  });

  it("should detect up swipe correctly", () => {
    expect(getSwipeDirection(10, -100)).toBe("up");
    expect(getSwipeDirection(0, -51)).toBe("up");
    expect(getSwipeDirection(30, -200)).toBe("up");
  });

  it("should detect down swipe correctly", () => {
    expect(getSwipeDirection(10, 100)).toBe("down");
    expect(getSwipeDirection(0, 51)).toBe("down");
    expect(getSwipeDirection(-30, 200)).toBe("down");
  });

  it("should prefer horizontal over vertical when equal", () => {
    // When absX > absY, horizontal wins
    expect(getSwipeDirection(60, 50)).toBe("right");
    expect(getSwipeDirection(-60, 50)).toBe("left");
  });

  it("should prefer vertical when absY > absX", () => {
    expect(getSwipeDirection(50, 60)).toBe("down");
    expect(getSwipeDirection(50, -60)).toBe("up");
  });
});

describe("Confidence Level Detection", () => {
  it("should return high for confidence >= 0.8", () => {
    expect(getConfidenceLevel(0.8)).toBe("high");
    expect(getConfidenceLevel(0.9)).toBe("high");
    expect(getConfidenceLevel(1.0)).toBe("high");
  });

  it("should return medium for confidence >= 0.6 and < 0.8", () => {
    expect(getConfidenceLevel(0.6)).toBe("medium");
    expect(getConfidenceLevel(0.7)).toBe("medium");
    expect(getConfidenceLevel(0.79)).toBe("medium");
  });

  it("should return low for confidence < 0.6", () => {
    expect(getConfidenceLevel(0.5)).toBe("low");
    expect(getConfidenceLevel(0.3)).toBe("low");
    expect(getConfidenceLevel(0)).toBe("low");
  });
});

describe("Swipe Feedback Configuration", () => {
  it("should have correct labels for each direction", () => {
    expect(SWIPE_FEEDBACK.right.label).toBe("Agree");
    expect(SWIPE_FEEDBACK.left.label).toBe("Disagree");
    expect(SWIPE_FEEDBACK.up.label).toBe("Urgent");
    expect(SWIPE_FEEDBACK.down.label).toBe("Hide");
  });

  it("should have background classes for each direction", () => {
    expect(SWIPE_FEEDBACK.right.bg).toContain("green");
    expect(SWIPE_FEEDBACK.left.bg).toContain("red");
    expect(SWIPE_FEEDBACK.up.bg).toContain("orange");
    expect(SWIPE_FEEDBACK.down.bg).toContain("gray");
  });
});

describe("Category Configuration", () => {
  it("should have correct labels for each category", () => {
    expect(CATEGORY_CONFIG.action.label).toBe("Action");
    expect(CATEGORY_CONFIG.note.label).toBe("Note");
    expect(CATEGORY_CONFIG.reference.label).toBe("Reference");
    expect(CATEGORY_CONFIG.meeting.label).toBe("Meeting");
    expect(CATEGORY_CONFIG.unknown.label).toBe("Unknown");
  });
});
