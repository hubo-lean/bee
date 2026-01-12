import { prisma, Prisma } from "@packages/db";
import { startOfWeek, format } from "date-fns";

// Types
export type ReviewStep = "objectives" | "priorities" | "actions" | "inbox";

export interface ObjectivesStepData {
  confirmed: string[];
  added: string[];
  deferred: string[];
}

export interface PrioritiesStepData {
  selectedProjects: string[];
  selectedAreas: string[];
}

export interface ActionsStepData {
  reviewed: string[];
  scheduled: string[];
  completed: string[];
}

export interface InboxStepData {
  needsReview: {
    processed: number;
    remaining: number;
  };
  disagreements: {
    processed: number;
    remaining: number;
  };
}

export interface ReviewSessionData {
  objectives: ObjectivesStepData | null;
  priorities: PrioritiesStepData | null;
  actions: ActionsStepData | null;
  inbox: InboxStepData | null;
}

type WeeklyReviewSession = Prisma.WeeklyReviewSessionGetPayload<object>;

export interface WeeklyReviewSessionWithData extends Omit<WeeklyReviewSession, "data"> {
  data: ReviewSessionData;
}

const REVIEW_STEPS: ReviewStep[] = ["objectives", "priorities", "actions", "inbox"];

function parseSessionData(data: unknown): ReviewSessionData {
  const defaultData: ReviewSessionData = {
    objectives: null,
    priorities: null,
    actions: null,
    inbox: null,
  };

  if (!data || typeof data !== "object") {
    return defaultData;
  }

  return data as ReviewSessionData;
}

/**
 * Get the current week's start date (Monday)
 */
export function getCurrentWeekStart(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

/**
 * Format week for display
 */
export function formatWeekDisplay(weekStart: Date): string {
  return `Week of ${format(weekStart, "MMM d, yyyy")}`;
}

/**
 * Get existing or create new weekly review session
 */
export async function getOrCreateSession(
  userId: string
): Promise<WeeklyReviewSessionWithData> {
  const weekStart = getCurrentWeekStart();

  // Try to find existing session
  const existing = await prisma.weeklyReviewSession.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
  });

  if (existing) {
    return {
      ...existing,
      data: parseSessionData(existing.data),
    };
  }

  // Create new session
  const newSession = await prisma.weeklyReviewSession.create({
    data: {
      userId,
      weekStart,
      currentStep: "objectives",
      stepsCompleted: [],
      data: {
        objectives: null,
        priorities: null,
        actions: null,
        inbox: null,
      },
    },
  });

  return {
    ...newSession,
    data: parseSessionData(newSession.data),
  };
}

/**
 * Get current session for the week (if exists)
 */
export async function getCurrentSession(
  userId: string
): Promise<WeeklyReviewSessionWithData | null> {
  const weekStart = getCurrentWeekStart();

  const session = await prisma.weeklyReviewSession.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
  });

  if (!session) return null;

  return {
    ...session,
    data: parseSessionData(session.data),
  };
}

/**
 * Start a new session for the current week
 */
export async function startSession(
  userId: string
): Promise<WeeklyReviewSessionWithData> {
  const weekStart = getCurrentWeekStart();

  // Upsert to handle race conditions
  const session = await prisma.weeklyReviewSession.upsert({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
    update: {}, // Don't update if exists
    create: {
      userId,
      weekStart,
      currentStep: "objectives",
      stepsCompleted: [],
      data: {
        objectives: null,
        priorities: null,
        actions: null,
        inbox: null,
      },
    },
  });

  return {
    ...session,
    data: parseSessionData(session.data),
  };
}

/**
 * Complete a step and optionally advance to the next
 */
export async function completeStep(
  userId: string,
  sessionId: string,
  step: ReviewStep,
  stepData: ObjectivesStepData | PrioritiesStepData | ActionsStepData | InboxStepData | null,
  goBack: boolean = false
): Promise<WeeklyReviewSessionWithData> {
  const session = await prisma.weeklyReviewSession.findUnique({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const currentIndex = REVIEW_STEPS.indexOf(step);

  if (goBack) {
    // Navigate back to previous step
    const prevStep = REVIEW_STEPS[currentIndex - 1] || "objectives";
    const updated = await prisma.weeklyReviewSession.update({
      where: { id: sessionId },
      data: {
        currentStep: prevStep,
        // Remove current step from completed if going back
        stepsCompleted: session.stepsCompleted.filter((s) => s !== step),
      },
    });

    return {
      ...updated,
      data: parseSessionData(updated.data),
    };
  }

  // Complete step and advance
  const nextStep = REVIEW_STEPS[currentIndex + 1];
  const isComplete = !nextStep;
  const existingData = parseSessionData(session.data);

  const updatedData: ReviewSessionData = {
    ...existingData,
    [step]: stepData,
  };

  // Deduplicate stepsCompleted
  const newStepsCompleted = Array.from(new Set([...session.stepsCompleted, step]));

  const updated = await prisma.weeklyReviewSession.update({
    where: { id: sessionId },
    data: {
      currentStep: nextStep || "inbox",
      stepsCompleted: newStepsCompleted,
      data: updatedData as unknown as Prisma.InputJsonValue,
      completedAt: isComplete ? new Date() : null,
    },
  });

  return {
    ...updated,
    data: parseSessionData(updated.data),
  };
}

/**
 * Update step data without advancing
 */
export async function updateStepData(
  userId: string,
  sessionId: string,
  step: ReviewStep,
  stepData: Partial<ObjectivesStepData | PrioritiesStepData | ActionsStepData | InboxStepData>
): Promise<WeeklyReviewSessionWithData> {
  const session = await prisma.weeklyReviewSession.findUnique({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const existingData = parseSessionData(session.data);
  const existingStepData = existingData[step] || {};

  const updatedData: ReviewSessionData = {
    ...existingData,
    [step]: { ...existingStepData, ...stepData },
  };

  const updated = await prisma.weeklyReviewSession.update({
    where: { id: sessionId },
    data: {
      data: updatedData as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    ...updated,
    data: parseSessionData(updated.data),
  };
}

/**
 * Get session history
 */
export async function getSessionHistory(
  userId: string,
  limit: number = 10
): Promise<WeeklyReviewSessionWithData[]> {
  const sessions = await prisma.weeklyReviewSession.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
  });

  return sessions.map((session) => ({
    ...session,
    data: parseSessionData(session.data),
  }));
}

/**
 * Calculate session progress
 */
export function calculateProgress(session: WeeklyReviewSessionWithData): {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
} {
  const completedSteps = session.stepsCompleted.length;
  const totalSteps = REVIEW_STEPS.length;
  const percentage = Math.round((completedSteps / totalSteps) * 100);

  return { completedSteps, totalSteps, percentage };
}

/**
 * Check if session is complete
 */
export function isSessionComplete(session: WeeklyReviewSessionWithData): boolean {
  return session.completedAt !== null;
}

/**
 * Get step info
 */
export function getStepInfo(step: ReviewStep): { label: string; description: string } {
  const stepInfo: Record<ReviewStep, { label: string; description: string }> = {
    objectives: {
      label: "Objectives",
      description: "Review and confirm your objectives for the week",
    },
    priorities: {
      label: "Priorities",
      description: "Select projects and areas to focus on",
    },
    actions: {
      label: "Actions",
      description: "Review and organize your action items",
    },
    inbox: {
      label: "Inbox",
      description: "Process remaining inbox items",
    },
  };

  return stepInfo[step];
}

/**
 * Get all steps with their status
 */
export function getStepsWithStatus(session: WeeklyReviewSessionWithData): Array<{
  key: ReviewStep;
  label: string;
  description: string;
  isComplete: boolean;
  isCurrent: boolean;
}> {
  return REVIEW_STEPS.map((step) => {
    const info = getStepInfo(step);
    return {
      key: step,
      label: info.label,
      description: info.description,
      isComplete: session.stepsCompleted.includes(step),
      isCurrent: session.currentStep === step,
    };
  });
}
