import { prisma, Prisma } from "@packages/db";
import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addYears,
  addMonths,
  addWeeks,
  eachWeekOfInterval,
  format,
} from "date-fns";

// Types
export type Timeframe = "yearly" | "monthly" | "weekly";
export type ObjectiveStatus = "active" | "completed" | "deferred" | "archived";

type Objective = Prisma.ObjectiveGetPayload<object>;
type ObjectiveWithChildren = Prisma.ObjectiveGetPayload<{
  include: { children: true };
}>;

export interface ObjectiveWithRelations extends Objective {
  parent?: Objective | null;
  children: Objective[];
  projects: { id: string; name: string; status: string }[];
  _count?: { actions: number };
}

// Timeframe date calculations
export function getTimeframeDates(
  timeframe: Timeframe,
  referenceDate = new Date()
): { startDate: Date; endDate: Date } {
  switch (timeframe) {
    case "yearly":
      return {
        startDate: startOfYear(referenceDate),
        endDate: endOfYear(referenceDate),
      };
    case "monthly":
      return {
        startDate: startOfMonth(referenceDate),
        endDate: endOfMonth(referenceDate),
      };
    case "weekly":
      return {
        startDate: startOfWeek(referenceDate, { weekStartsOn: 1 }), // Monday
        endDate: endOfWeek(referenceDate, { weekStartsOn: 1 }),
      };
  }
}

export function getNextPeriodDates(
  timeframe: Timeframe,
  currentEndDate: Date
): { startDate: Date; endDate: Date } {
  const nextStart = new Date(currentEndDate.getTime() + 1); // Day after current end

  switch (timeframe) {
    case "yearly":
      return {
        startDate: startOfYear(addYears(nextStart, 0)),
        endDate: endOfYear(addYears(nextStart, 0)),
      };
    case "monthly":
      return {
        startDate: startOfMonth(addMonths(nextStart, 0)),
        endDate: endOfMonth(addMonths(nextStart, 0)),
      };
    case "weekly":
      return {
        startDate: startOfWeek(addWeeks(nextStart, 0), { weekStartsOn: 1 }),
        endDate: endOfWeek(addWeeks(nextStart, 0), { weekStartsOn: 1 }),
      };
  }
}

export function getParentTimeframe(
  timeframe: Timeframe
): Timeframe | undefined {
  switch (timeframe) {
    case "weekly":
      return "monthly";
    case "monthly":
      return "yearly";
    case "yearly":
      return undefined;
  }
}

export function formatTimeframePeriod(
  timeframe: Timeframe,
  startDate: Date,
  endDate: Date
): string {
  switch (timeframe) {
    case "yearly":
      return format(startDate, "yyyy");
    case "monthly":
      return format(startDate, "MMMM yyyy");
    case "weekly":
      return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
  }
}

// Get current period objectives
export async function getCurrentObjectives(
  userId: string,
  timeframe: Timeframe
): Promise<ObjectiveWithRelations[]> {
  const { startDate, endDate } = getTimeframeDates(timeframe);

  const objectives = await prisma.objective.findMany({
    where: {
      userId,
      timeframe,
      status: { in: ["active", "completed"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      parent: true,
      children: true,
      projects: {
        where: { status: "active" },
        select: { id: true, name: true, status: true },
      },
      _count: { select: { actions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return objectives as ObjectiveWithRelations[];
}

// Get current week's objectives with full hierarchy
export async function getCurrentWeekObjectives(
  userId: string
): Promise<ObjectiveWithRelations[]> {
  const { startDate, endDate } = getTimeframeDates("weekly");

  const objectives = await prisma.objective.findMany({
    where: {
      userId,
      timeframe: "weekly",
      status: "active",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      parent: {
        include: {
          parent: true, // Get monthly and yearly
        },
      },
      children: true,
      projects: {
        where: { status: "active" },
        select: { id: true, name: true, status: true },
      },
      _count: { select: { actions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return objectives as ObjectiveWithRelations[];
}

// List objectives by timeframe
export async function listObjectives(
  userId: string,
  options: {
    timeframe?: Timeframe;
    status?: ObjectiveStatus;
    includeChildren?: boolean;
    parentId?: string | null;
  } = {}
): Promise<ObjectiveWithRelations[]> {
  const { timeframe, status, includeChildren = false, parentId } = options;

  const objectives = await prisma.objective.findMany({
    where: {
      userId,
      timeframe,
      status: status || { not: "archived" },
      parentId: parentId === null ? null : parentId,
    },
    include: includeChildren
      ? {
          parent: true,
          children: {
            where: { status: { not: "archived" } },
            orderBy: { startDate: "asc" },
          },
          projects: {
            where: { status: "active" },
            select: { id: true, name: true, status: true },
          },
          _count: { select: { actions: true } },
        }
      : {
          parent: true,
          children: false,
          projects: {
            where: { status: "active" },
            select: { id: true, name: true, status: true },
          },
          _count: { select: { actions: true } },
        },
    orderBy: { startDate: "desc" },
  });

  return objectives as ObjectiveWithRelations[];
}

// Create objective
export async function createObjective(
  userId: string,
  data: {
    title: string;
    description?: string;
    timeframe: Timeframe;
    parentId?: string;
    cascadeToWeekly?: boolean;
  }
): Promise<Objective> {
  const { startDate, endDate } = getTimeframeDates(data.timeframe);

  const objective = await prisma.objective.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      timeframe: data.timeframe,
      parentId: data.parentId,
      startDate,
      endDate,
      status: "active",
      progress: 0,
    },
  });

  // Cascade monthly to weekly if requested
  if (data.timeframe === "monthly" && data.cascadeToWeekly) {
    await cascadeToWeekly(objective);
  }

  return objective;
}

// Cascade monthly objective to weekly objectives
async function cascadeToWeekly(monthlyObjective: Objective): Promise<void> {
  const weeksInMonth = eachWeekOfInterval(
    { start: monthlyObjective.startDate, end: monthlyObjective.endDate },
    { weekStartsOn: 1 }
  );

  const weeklyObjectives = weeksInMonth.map((weekStart) => ({
    userId: monthlyObjective.userId,
    title: monthlyObjective.title,
    description: `Weekly focus for: ${monthlyObjective.title}`,
    timeframe: "weekly" as const,
    parentId: monthlyObjective.id,
    status: "active" as const,
    progress: 0,
    startDate: weekStart,
    endDate: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }));

  await prisma.objective.createMany({
    data: weeklyObjectives,
  });
}

// Update objective
export async function updateObjective(
  userId: string,
  id: string,
  data: {
    title?: string;
    description?: string;
    status?: ObjectiveStatus;
    progress?: number;
  }
): Promise<Objective> {
  const updateData: Prisma.ObjectiveUpdateInput = {
    ...data,
  };

  // Set completedAt when marking complete
  if (data.status === "completed") {
    updateData.completedAt = new Date();
  } else if (data.status === "active") {
    updateData.completedAt = null;
  }

  const objective = await prisma.objective.update({
    where: { id, userId },
    data: updateData,
  });

  // Recalculate parent progress
  if (objective.parentId) {
    await recalculateParentProgress(objective.parentId);
  }

  return objective;
}

// Recalculate progress based on children
async function recalculateParentProgress(parentId: string): Promise<void> {
  const parent = await prisma.objective.findUnique({
    where: { id: parentId },
    include: {
      children: {
        where: { status: { not: "archived" } },
      },
    },
  });

  if (!parent || parent.children.length === 0) return;

  const children = parent.children as ObjectiveWithChildren["children"];
  const totalProgress = children.reduce((sum, child) => {
    if (child.status === "completed") return sum + 100;
    return sum + (child.progress || 0);
  }, 0);

  const averageProgress = Math.round(totalProgress / children.length);

  await prisma.objective.update({
    where: { id: parentId },
    data: { progress: averageProgress },
  });

  // Recursively update grandparent
  if (parent.parentId) {
    await recalculateParentProgress(parent.parentId);
  }
}

// Carry forward an incomplete objective
export async function carryForward(
  userId: string,
  objectiveId: string
): Promise<Objective> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId, userId },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  if (objective.status === "completed") {
    throw new Error("Cannot carry forward a completed objective");
  }

  // Mark original as deferred
  await prisma.objective.update({
    where: { id: objectiveId },
    data: { status: "deferred" },
  });

  // Create new objective for next period
  const nextDates = getNextPeriodDates(
    objective.timeframe as Timeframe,
    objective.endDate
  );

  const newObjective = await prisma.objective.create({
    data: {
      userId: objective.userId,
      title: objective.title,
      description: objective.description,
      timeframe: objective.timeframe,
      parentId: objective.parentId,
      status: "active",
      progress: objective.progress, // Carry over progress
      startDate: nextDates.startDate,
      endDate: nextDates.endDate,
    },
  });

  return newObjective;
}

// Archive objective
export async function archiveObjective(
  userId: string,
  objectiveId: string
): Promise<Objective> {
  const objective = await prisma.objective.update({
    where: { id: objectiveId, userId },
    data: { status: "archived" },
  });

  // Recalculate parent progress
  if (objective.parentId) {
    await recalculateParentProgress(objective.parentId);
  }

  return objective;
}

// Delete objective
export async function deleteObjective(
  userId: string,
  objectiveId: string
): Promise<void> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId, userId },
    include: { children: true },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  // Don't delete if has children
  if (objective.children.length > 0) {
    throw new Error(
      "Cannot delete objective with children. Archive it instead."
    );
  }

  await prisma.objective.delete({
    where: { id: objectiveId },
  });

  // Recalculate parent progress
  if (objective.parentId) {
    await recalculateParentProgress(objective.parentId);
  }
}

// Get objective by ID
export async function getObjectiveById(
  userId: string,
  objectiveId: string
): Promise<ObjectiveWithRelations | null> {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId, userId },
    include: {
      parent: true,
      children: {
        where: { status: { not: "archived" } },
        orderBy: { startDate: "asc" },
      },
      projects: {
        where: { status: "active" },
        select: { id: true, name: true, status: true },
      },
      _count: { select: { actions: true } },
    },
  });

  return objective as ObjectiveWithRelations | null;
}

// Get objectives available as parents for a given timeframe
export async function getAvailableParents(
  userId: string,
  childTimeframe: Timeframe
): Promise<Objective[]> {
  const parentTimeframe = getParentTimeframe(childTimeframe);

  if (!parentTimeframe) {
    return [];
  }

  return prisma.objective.findMany({
    where: {
      userId,
      timeframe: parentTimeframe,
      status: "active",
    },
    orderBy: { startDate: "desc" },
  });
}
