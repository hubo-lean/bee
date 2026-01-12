// Swipe gesture configuration constants

export const SWIPE_THRESHOLD = 50; // Minimum px to trigger swipe
export const VELOCITY_THRESHOLD = 0.5; // Minimum velocity for swipe
export const ROTATION_FACTOR = 0.1; // Card rotation during drag (degrees per px)

// Animation configuration for framer-motion
export const SPRING_CONFIG = {
  type: "spring" as const,
  damping: 25,
  stiffness: 300,
};

// Exit animations for each swipe direction
export const EXIT_ANIMATIONS = {
  right: { x: 500, y: 0, rotate: 20, opacity: 0 },
  left: { x: -500, y: 0, rotate: -20, opacity: 0 },
  up: { x: 0, y: -500, rotate: 0, opacity: 0 },
  down: { x: 0, y: 500, rotate: 0, opacity: 0 },
} as const;

// Visual feedback colors and icons for each swipe direction
export const SWIPE_FEEDBACK = {
  right: {
    bg: "bg-green-500/20",
    border: "border-green-500",
    color: "text-green-500",
    label: "Agree",
  },
  left: {
    bg: "bg-red-500/20",
    border: "border-red-500",
    color: "text-red-500",
    label: "Disagree",
  },
  up: {
    bg: "bg-orange-500/20",
    border: "border-orange-500",
    color: "text-orange-500",
    label: "Urgent",
  },
  down: {
    bg: "bg-gray-500/20",
    border: "border-gray-500",
    color: "text-gray-500",
    label: "Hide",
  },
} as const;

// Category configuration with icons and colors
export const CATEGORY_CONFIG = {
  action: { color: "text-blue-600", bg: "bg-blue-100", label: "Action" },
  note: { color: "text-purple-600", bg: "bg-purple-100", label: "Note" },
  reference: { color: "text-green-600", bg: "bg-green-100", label: "Reference" },
  meeting: { color: "text-orange-600", bg: "bg-orange-100", label: "Meeting" },
  unknown: { color: "text-gray-600", bg: "bg-gray-100", label: "Unknown" },
} as const;

// Confidence level thresholds
export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.6,
} as const;

export type SwipeDirection = "right" | "left" | "up" | "down";
export type Category = keyof typeof CATEGORY_CONFIG;
