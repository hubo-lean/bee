import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listAreas,
  getArea,
  createArea,
  updateArea,
  deleteArea,
  reorderAreas,
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  fileItem,
  listArchivedItems,
  restoreFromArchive,
} from "../services/para.service";

const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);
const resourceTypeSchema = z.enum(["note", "link", "file", "collection"]);

export const paraRouter = router({
  // Projects
  listProjects: protectedProcedure
    .input(
      z
        .object({
          status: projectStatusSchema.optional(),
          areaId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return listProjects(ctx.session.user.id, input);
    }),

  getProject: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getProject(ctx.session.user.id, input.id);
    }),

  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        areaId: z.string().uuid().optional(),
        objectiveId: z.string().uuid().optional(),
        dueDate: z.coerce.date().optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createProject(ctx.session.user.id, input);
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        status: projectStatusSchema.optional(),
        areaId: z.string().uuid().nullable().optional(),
        objectiveId: z.string().uuid().nullable().optional(),
        dueDate: z.coerce.date().nullable().optional(),
        color: z.string().max(20).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateProject(ctx.session.user.id, input);
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return deleteProject(ctx.session.user.id, input.id);
    }),

  // Areas
  listAreas: protectedProcedure.query(async ({ ctx }) => {
    return listAreas(ctx.session.user.id);
  }),

  getArea: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getArea(ctx.session.user.id, input.id);
    }),

  createArea: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).optional(),
        icon: z.string().max(10).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createArea(ctx.session.user.id, input);
    }),

  updateArea: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).optional(),
        icon: z.string().max(10).optional(),
        color: z.string().max(20).optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateArea(ctx.session.user.id, input);
    }),

  deleteArea: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return deleteArea(ctx.session.user.id, input.id);
    }),

  reorderAreas: protectedProcedure
    .input(z.object({ areaIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await reorderAreas(ctx.session.user.id, input.areaIds);
      return { success: true };
    }),

  // Resources
  listResources: protectedProcedure
    .input(
      z
        .object({
          type: resourceTypeSchema.optional(),
          areaId: z.string().uuid().optional(),
          includeArchived: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return listResources(ctx.session.user.id, input);
    }),

  getResource: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getResource(ctx.session.user.id, input.id);
    }),

  createResource: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        type: resourceTypeSchema,
        content: z.string().optional(),
        url: z.string().url().optional(),
        areaId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createResource(ctx.session.user.id, input);
    }),

  updateResource: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        content: z.string().optional(),
        url: z.string().url().optional(),
        areaId: z.string().uuid().nullable().optional(),
        isArchived: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateResource(ctx.session.user.id, input);
    }),

  deleteResource: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return deleteResource(ctx.session.user.id, input.id);
    }),

  // Filing
  fileItem: protectedProcedure
    .input(
      z.object({
        inboxItemId: z.string().uuid(),
        destination: z.object({
          type: z.enum(["project", "area", "resource", "archive"]),
          id: z.string().uuid().optional(),
        }),
        createNote: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fileItem(ctx.session.user.id, input);
    }),

  // Archive
  listArchived: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return listArchivedItems(ctx.session.user.id, input?.limit);
    }),

  restoreFromArchive: protectedProcedure
    .input(
      z.object({
        type: z.enum(["project", "inbox"]),
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return restoreFromArchive(ctx.session.user.id, input.type, input.id);
    }),
});
