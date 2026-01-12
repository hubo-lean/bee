import { prisma, Prisma } from "@packages/db";
import { TRPCError } from "@trpc/server";

// Types
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type ResourceType = "note" | "link" | "file" | "collection";

export interface CreateProjectInput {
  name: string;
  description?: string;
  areaId?: string;
  objectiveId?: string;
  dueDate?: Date;
  color?: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  areaId?: string | null;
  objectiveId?: string | null;
  dueDate?: Date | null;
  color?: string | null;
}

export interface CreateAreaInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateAreaInput {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

export interface CreateResourceInput {
  name: string;
  description?: string;
  type: ResourceType;
  content?: string;
  url?: string;
  areaId?: string;
}

export interface UpdateResourceInput {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  url?: string;
  areaId?: string | null;
  isArchived?: boolean;
}

export interface FileItemInput {
  inboxItemId: string;
  destination: {
    type: "project" | "area" | "resource" | "archive";
    id?: string;
  };
  createNote?: boolean;
}

// Project functions
export async function listProjects(
  userId: string,
  options?: { status?: ProjectStatus; areaId?: string }
) {
  return prisma.project.findMany({
    where: {
      userId,
      status: options?.status || { not: "archived" },
      areaId: options?.areaId,
    },
    include: {
      area: true,
      objective: true,
      _count: {
        select: {
          actions: { where: { status: "pending" } },
          notes: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(userId: string, id: string) {
  const project = await prisma.project.findUnique({
    where: { id, userId },
    include: {
      area: true,
      objective: true,
      _count: {
        select: {
          actions: true,
          notes: true,
        },
      },
    },
  });

  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }

  return project;
}

export async function createProject(userId: string, input: CreateProjectInput) {
  return prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      areaId: input.areaId,
      objectiveId: input.objectiveId,
      dueDate: input.dueDate,
      color: input.color,
      status: "active",
    },
    include: {
      area: true,
      objective: true,
    },
  });
}

export async function updateProject(userId: string, input: UpdateProjectInput) {
  const { id, ...data } = input;

  // Build update data
  const updateData: Prisma.ProjectUpdateInput = {
    name: data.name,
    description: data.description,
    status: data.status,
    dueDate: data.dueDate,
    color: data.color,
  };

  if (data.status === "completed") {
    updateData.completedAt = new Date();
  } else if (data.status === "archived") {
    updateData.archivedAt = new Date();
  }

  // Handle area relation
  if (data.areaId === null) {
    updateData.area = { disconnect: true };
  } else if (data.areaId !== undefined) {
    updateData.area = { connect: { id: data.areaId } };
  }

  // Handle objective relation
  if (data.objectiveId === null) {
    updateData.objective = { disconnect: true };
  } else if (data.objectiveId !== undefined) {
    updateData.objective = { connect: { id: data.objectiveId } };
  }

  return prisma.project.update({
    where: { id, userId },
    data: updateData,
    include: {
      area: true,
      objective: true,
    },
  });
}

export async function deleteProject(userId: string, id: string) {
  return prisma.project.delete({
    where: { id, userId },
  });
}

// Area functions
export async function listAreas(userId: string) {
  return prisma.area.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          projects: { where: { status: "active" } },
          actions: { where: { status: "pending" } },
          notes: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getArea(userId: string, id: string) {
  const area = await prisma.area.findUnique({
    where: { id, userId },
    include: {
      projects: {
        where: { status: { not: "archived" } },
        orderBy: { updatedAt: "desc" },
      },
      _count: {
        select: {
          actions: true,
          notes: true,
          resources: true,
        },
      },
    },
  });

  if (!area) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Area not found" });
  }

  return area;
}

export async function createArea(userId: string, input: CreateAreaInput) {
  // Get max sortOrder
  const maxOrder = await prisma.area.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  return prisma.area.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
    },
  });
}

export async function updateArea(userId: string, input: UpdateAreaInput) {
  const { id, ...data } = input;

  return prisma.area.update({
    where: { id, userId },
    data,
  });
}

export async function deleteArea(userId: string, id: string) {
  // Check if area has any linked items
  const area = await prisma.area.findUnique({
    where: { id, userId },
    include: {
      _count: {
        select: {
          projects: true,
          actions: true,
          notes: true,
        },
      },
    },
  });

  if (!area) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Area not found" });
  }

  const totalLinked =
    area._count.projects + area._count.actions + area._count.notes;
  if (totalLinked > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Cannot delete area with linked items. Unlink or move items first.",
    });
  }

  return prisma.area.delete({
    where: { id, userId },
  });
}

export async function reorderAreas(userId: string, areaIds: string[]) {
  const updates = areaIds.map((id, index) =>
    prisma.area.update({
      where: { id, userId },
      data: { sortOrder: index },
    })
  );

  await prisma.$transaction(updates);
}

// Resource functions
export async function listResources(
  userId: string,
  options?: { type?: ResourceType; areaId?: string; includeArchived?: boolean }
) {
  return prisma.resource.findMany({
    where: {
      userId,
      type: options?.type,
      areaId: options?.areaId,
      isArchived: options?.includeArchived ? undefined : false,
    },
    include: {
      area: true,
      _count: {
        select: { notes: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getResource(userId: string, id: string) {
  const resource = await prisma.resource.findUnique({
    where: { id, userId },
    include: {
      area: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!resource) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
  }

  return resource;
}

export async function createResource(userId: string, input: CreateResourceInput) {
  return prisma.resource.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      type: input.type,
      content: input.content,
      url: input.url,
      areaId: input.areaId,
    },
    include: {
      area: true,
    },
  });
}

export async function updateResource(userId: string, input: UpdateResourceInput) {
  const { id, ...data } = input;

  const updateData: Prisma.ResourceUpdateInput = {
    name: data.name,
    description: data.description,
    content: data.content,
    url: data.url,
    isArchived: data.isArchived,
  };

  // Handle area relation
  if (data.areaId === null) {
    updateData.area = { disconnect: true };
  } else if (data.areaId !== undefined) {
    updateData.area = { connect: { id: data.areaId } };
  }

  return prisma.resource.update({
    where: { id, userId },
    data: updateData,
    include: {
      area: true,
    },
  });
}

export async function deleteResource(userId: string, id: string) {
  return prisma.resource.delete({
    where: { id, userId },
  });
}

// Filing functions
export async function fileItem(userId: string, input: FileItemInput) {
  const item = await prisma.inboxItem.findUnique({
    where: { id: input.inboxItemId, userId },
  });

  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Inbox item not found" });
  }

  // Create note if requested and not archiving
  if (input.createNote && input.destination.type !== "archive") {
    const title = item.content.slice(0, 100);

    await prisma.note.create({
      data: {
        userId,
        title,
        content: item.content,
        projectId: input.destination.type === "project" ? input.destination.id : undefined,
        areaId: input.destination.type === "area" ? input.destination.id : undefined,
        resourceId: input.destination.type === "resource" ? input.destination.id : undefined,
        sourceInboxItemId: item.id,
      },
    });
  }

  // Update inbox item status
  return prisma.inboxItem.update({
    where: { id: input.inboxItemId },
    data: {
      status: input.destination.type === "archive" ? "archived" : "reviewed",
      archivedAt: input.destination.type === "archive" ? new Date() : undefined,
      reviewedAt: new Date(),
    },
  });
}

// Archive functions
export async function listArchivedItems(userId: string, limit: number = 50) {
  const [projects, inboxItems] = await Promise.all([
    prisma.project.findMany({
      where: { userId, status: "archived" },
      orderBy: { archivedAt: "desc" },
      take: limit,
    }),
    prisma.inboxItem.findMany({
      where: { userId, status: "archived" },
      orderBy: { archivedAt: "desc" },
      take: limit,
    }),
  ]);

  return { projects, inboxItems };
}

export async function restoreFromArchive(
  userId: string,
  type: "project" | "inbox",
  id: string
) {
  if (type === "project") {
    return prisma.project.update({
      where: { id, userId },
      data: {
        status: "active",
        archivedAt: null,
      },
    });
  } else {
    return prisma.inboxItem.update({
      where: { id, userId },
      data: {
        status: "reviewed",
        archivedAt: null,
      },
    });
  }
}
