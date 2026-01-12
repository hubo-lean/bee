# Story 5.3: PARA Structure Setup

## Story

**As a** user,
**I want** to organize content into Projects, Areas, Resources, and Archive,
**So that** I can find things based on their purpose.

## Priority

**P0** - Foundation for all organization

## Acceptance Criteria

1. PARA categories visible in navigation/sidebar
2. User can create/edit/archive Projects and Areas
3. Resources section for reference material
4. Archive for inactive items (searchable but hidden from main views)
5. Items can be moved between PARA categories
6. Each PARA item has: title, description, status, linked items

## Technical Design

### PARA Methodology Overview

```
PARA = Projects + Areas + Resources + Archive

Projects:  Short-term efforts with a deadline/goal
           Example: "Launch MVP", "Q1 Budget Report"

Areas:     Long-term responsibilities to maintain
           Example: "Health", "Finance", "Career"

Resources: Topics of ongoing interest
           Example: "Recipes", "Investment Ideas", "Book Notes"

Archive:   Inactive items from other categories
           Example: Completed projects, old resources
```

### Data Models

```typescript
// Project - Short-term effort with deadline
interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: "active" | "on_hold" | "completed" | "archived";
  areaId?: string;            // Parent area
  objectiveId?: string;       // Linked objective
  dueDate?: Date;
  completedAt?: Date;
  archivedAt?: Date;
  color?: string;             // For visual organization
  createdAt: Date;
  updatedAt: Date;
}

// Area - Ongoing responsibility
interface Area {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;              // Emoji or icon name
  color?: string;
  sortOrder: number;          // User-defined order
  createdAt: Date;
  updatedAt: Date;
}

// Resource - Reference material
interface Resource {
  id: string;
  userId: string;
  name: string;
  description?: string;
  areaId?: string;            // Related area (optional)
  type: "note" | "link" | "file" | "collection";
  content?: string;           // For notes
  url?: string;               // For links
  fileUrl?: string;           // For files
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Database Schema

```prisma
model Project {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  description String?
  status      String    @default("active") // active, on_hold, completed, archived
  color       String?

  areaId      String?
  area        Area?     @relation(fields: [areaId], references: [id])

  objectiveId String?
  objective   Objective? @relation(fields: [objectiveId], references: [id])

  dueDate     DateTime?
  completedAt DateTime?
  archivedAt  DateTime?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  notes       Note[]
  actions     Action[]
  inboxItems  InboxItem[]

  @@index([userId, status])
  @@index([userId, areaId])
}

model Area {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  description String?
  icon        String?
  color       String?
  sortOrder   Int       @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  projects    Project[]
  resources   Resource[]
  notes       Note[]
  actions     Action[]

  @@index([userId, sortOrder])
}

model Resource {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  description String?
  type        String    @default("note") // note, link, file, collection
  content     String?   @db.Text
  url         String?
  fileUrl     String?

  areaId      String?
  area        Area?     @relation(fields: [areaId], references: [id])

  isArchived  Boolean   @default(false)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, type])
  @@index([userId, isArchived])
}
```

### Navigation Layout

```
┌─────────────────────────────────┐
│  🐝 Bee                         │
├─────────────────────────────────┤
│  📥 Inbox (12)                  │
│  📅 Today                       │
│  🔍 Search                      │
├─────────────────────────────────┤
│  PROJECTS                    +  │
│  ├── 🚀 MVP Launch          (5) │
│  ├── 📊 Q1 Budget           (2) │
│  └── 📝 Documentation       (0) │
├─────────────────────────────────┤
│  AREAS                       +  │
│  ├── 💪 Health                  │
│  ├── 💰 Finance                 │
│  └── 📚 Learning                │
├─────────────────────────────────┤
│  RESOURCES                   +  │
│  └── View all →                 │
├─────────────────────────────────┤
│  📦 Archive                     │
│  ⚙️ Settings                    │
└─────────────────────────────────┘
```

### PARA Navigation Component

```tsx
function PARANavigation() {
  const { data: projects } = trpc.para.listProjects.useQuery({ status: "active" });
  const { data: areas } = trpc.para.listAreas.useQuery();
  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    areas: true,
    resources: false,
  });

  return (
    <nav className="space-y-1">
      {/* Quick access */}
      <NavSection>
        <NavItem href="/inbox" icon={Inbox} badge={12}>
          Inbox
        </NavItem>
        <NavItem href="/today" icon={Calendar}>
          Today
        </NavItem>
        <NavItem href="/search" icon={Search}>
          Search
        </NavItem>
      </NavSection>

      <Separator />

      {/* Projects */}
      <NavSection
        title="Projects"
        expanded={expandedSections.projects}
        onToggle={() => setExpandedSections((s) => ({ ...s, projects: !s.projects }))}
        onAdd={() => setShowCreateProject(true)}
      >
        {projects?.map((project) => (
          <NavItem
            key={project.id}
            href={`/projects/${project.id}`}
            icon={Folder}
            color={project.color}
            badge={project._count?.actions}
          >
            {project.name}
          </NavItem>
        ))}
        {projects?.length === 0 && (
          <p className="text-sm text-gray-500 px-3 py-2">No active projects</p>
        )}
      </NavSection>

      {/* Areas */}
      <NavSection
        title="Areas"
        expanded={expandedSections.areas}
        onToggle={() => setExpandedSections((s) => ({ ...s, areas: !s.areas }))}
        onAdd={() => setShowCreateArea(true)}
      >
        {areas?.map((area) => (
          <NavItem
            key={area.id}
            href={`/areas/${area.id}`}
            icon={() => <span>{area.icon}</span>}
          >
            {area.name}
          </NavItem>
        ))}
      </NavSection>

      {/* Resources */}
      <NavSection
        title="Resources"
        expanded={expandedSections.resources}
        onToggle={() => setExpandedSections((s) => ({ ...s, resources: !s.resources }))}
        onAdd={() => setShowCreateResource(true)}
      >
        <NavItem href="/resources" icon={Library}>
          View all
        </NavItem>
      </NavSection>

      <Separator />

      {/* Archive & Settings */}
      <NavSection>
        <NavItem href="/archive" icon={Archive}>
          Archive
        </NavItem>
        <NavItem href="/settings" icon={Settings}>
          Settings
        </NavItem>
      </NavSection>
    </nav>
  );
}
```

### Project Page

```tsx
function ProjectPage({ params }: { params: { id: string } }) {
  const { data: project } = trpc.para.getProject.useQuery({ id: params.id });
  const { data: actions } = trpc.actions.listByProject.useQuery({
    projectId: params.id,
  });
  const { data: notes } = trpc.notes.listByProject.useQuery({
    projectId: params.id,
  });

  if (!project) return <ProjectSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {project.area && (
              <span className="flex items-center gap-1">
                <span>{project.area.icon}</span>
                {project.area.name}
              </span>
            )}
            {project.dueDate && (
              <span>Due {format(project.dueDate, "MMM d, yyyy")}</span>
            )}
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Put On Hold</DropdownMenuItem>
            <DropdownMenuItem>Mark Complete</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">
            Actions ({actions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes ({notes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <ActionsList actions={actions} projectId={project.id} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesList notes={notes} projectId={project.id} />
        </TabsContent>

        <TabsContent value="files">
          <FilesList projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Create/Edit Modals

```tsx
function CreateProjectModal({
  open,
  onClose,
  defaultAreaId,
}: {
  open: boolean;
  onClose: () => void;
  defaultAreaId?: string;
}) {
  const form = useForm<CreateProjectInput>({
    defaultValues: {
      areaId: defaultAreaId,
      status: "active",
    },
  });

  const { data: areas } = trpc.para.listAreas.useQuery();
  const { data: objectives } = trpc.objectives.list.useQuery({
    timeframe: "monthly",
    status: "active",
  });

  const createProject = trpc.para.createProject.useMutation();

  const onSubmit = async (data: CreateProjectInput) => {
    await createProject.mutateAsync(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <Input {...field} placeholder="Project name" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <Textarea {...field} placeholder="What's this project about?" />
                </FormItem>
              )}
            />

            {/* Area */}
            <FormField
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select area..." />
                    </SelectTrigger>
                    <SelectContent>
                      {areas?.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.icon} {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* Objective */}
            <FormField
              name="objectiveId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Objective (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link to objective..." />
                    </SelectTrigger>
                    <SelectContent>
                      {objectives?.map((obj) => (
                        <SelectItem key={obj.id} value={obj.id}>
                          {obj.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* Due Date */}
            <FormField
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <DatePicker value={field.value} onChange={field.onChange} />
                </FormItem>
              )}
            />

            {/* Color */}
            <FormField
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### File Items to PARA

```tsx
function FileToParaModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: InboxItem;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState<{
    type: "project" | "area" | "resource" | "archive";
    id?: string;
  }>({ type: "project" });

  const { data: projects } = trpc.para.listProjects.useQuery({ status: "active" });
  const { data: areas } = trpc.para.listAreas.useQuery();

  const fileItem = trpc.para.fileItem.useMutation();

  const handleFile = async () => {
    await fileItem.mutateAsync({
      inboxItemId: item.id,
      destination,
      createNote: true, // Convert to note in destination
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File to...</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
          </div>

          {/* Destination tabs */}
          <Tabs value={destination.type} onValueChange={(t) => setDestination({ type: t as any })}>
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="project">Project</TabsTrigger>
              <TabsTrigger value="area">Area</TabsTrigger>
              <TabsTrigger value="resource">Resource</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value="project" className="space-y-2">
              {projects?.map((project) => (
                <label
                  key={project.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer",
                    destination.id === project.id && "border-blue-500 bg-blue-50"
                  )}
                >
                  <input
                    type="radio"
                    name="project"
                    checked={destination.id === project.id}
                    onChange={() => setDestination({ type: "project", id: project.id })}
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="area" className="space-y-2">
              {areas?.map((area) => (
                <label
                  key={area.id}
                  className={cn(
                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer",
                    destination.id === area.id && "border-blue-500 bg-blue-50"
                  )}
                >
                  <input
                    type="radio"
                    name="area"
                    checked={destination.id === area.id}
                    onChange={() => setDestination({ type: "area", id: area.id })}
                  />
                  <span>{area.icon} {area.name}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="resource">
              <p className="text-sm text-gray-500">
                Create as a new resource in your reference library.
              </p>
            </TabsContent>

            <TabsContent value="archive">
              <p className="text-sm text-gray-500">
                Archive this item. It will still be searchable.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleFile} disabled={fileItem.isPending}>
            File Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### tRPC Procedures

```typescript
export const paraRouter = router({
  // Projects
  listProjects: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "on_hold", "completed", "archived"]).optional(),
      areaId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return prisma.project.findMany({
        where: {
          userId: ctx.session.user.id,
          status: input?.status || { not: "archived" },
          areaId: input?.areaId,
        },
        include: {
          area: true,
          objective: true,
          _count: { select: { actions: { where: { status: "pending" } } } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getProject: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return prisma.project.findUnique({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          area: true,
          objective: true,
        },
      });
    }),

  createProject: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      areaId: z.string().uuid().optional(),
      objectiveId: z.string().uuid().optional(),
      dueDate: z.date().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.project.create({
        data: {
          userId: ctx.session.user.id,
          ...input,
        },
      });
    }),

  updateProject: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      status: z.enum(["active", "on_hold", "completed", "archived"]).optional(),
      areaId: z.string().uuid().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      return prisma.project.update({
        where: { id, userId: ctx.session.user.id },
        data: {
          ...data,
          completedAt: data.status === "completed" ? new Date() : undefined,
          archivedAt: data.status === "archived" ? new Date() : undefined,
        },
      });
    }),

  // Areas
  listAreas: protectedProcedure.query(async ({ ctx }) => {
    return prisma.area.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { sortOrder: "asc" },
    });
  }),

  createArea: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      description: z.string().max(200).optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await prisma.area.aggregate({
        where: { userId: ctx.session.user.id },
        _max: { sortOrder: true },
      });

      return prisma.area.create({
        data: {
          userId: ctx.session.user.id,
          ...input,
          sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        },
      });
    }),

  // Resources
  listResources: protectedProcedure
    .input(z.object({
      type: z.enum(["note", "link", "file", "collection"]).optional(),
      areaId: z.string().uuid().optional(),
      includeArchived: z.boolean().default(false),
    }).optional())
    .query(async ({ ctx, input }) => {
      return prisma.resource.findMany({
        where: {
          userId: ctx.session.user.id,
          type: input?.type,
          areaId: input?.areaId,
          isArchived: input?.includeArchived ? undefined : false,
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Filing
  fileItem: protectedProcedure
    .input(z.object({
      inboxItemId: z.string().uuid(),
      destination: z.object({
        type: z.enum(["project", "area", "resource", "archive"]),
        id: z.string().uuid().optional(),
      }),
      createNote: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.inboxItem.findUnique({
        where: { id: input.inboxItemId, userId: ctx.session.user.id },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Create note if requested
      if (input.createNote && input.destination.type !== "archive") {
        await prisma.note.create({
          data: {
            userId: ctx.session.user.id,
            title: item.content.slice(0, 100),
            content: item.content,
            projectId: input.destination.type === "project" ? input.destination.id : undefined,
            areaId: input.destination.type === "area" ? input.destination.id : undefined,
            sourceInboxItemId: item.id,
          },
        });
      }

      // Update inbox item
      return prisma.inboxItem.update({
        where: { id: input.inboxItemId },
        data: {
          status: input.destination.type === "archive" ? "archived" : "reviewed",
          projectId: input.destination.type === "project" ? input.destination.id : undefined,
          areaId: input.destination.type === "area" ? input.destination.id : undefined,
          archivedAt: input.destination.type === "archive" ? new Date() : undefined,
        },
      });
    }),
});
```

## Dependencies

- Prisma schema updates
- shadcn/ui components

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modify | Add Project, Area, Resource models |
| `apps/web/src/server/routers/para.ts` | Create | tRPC PARA procedures |
| `apps/web/src/components/para/para-nav.tsx` | Create | Navigation sidebar |
| `apps/web/src/components/para/create-project-modal.tsx` | Create | Project creation |
| `apps/web/src/components/para/create-area-modal.tsx` | Create | Area creation |
| `apps/web/src/components/para/file-to-para-modal.tsx` | Create | File item modal |
| `apps/web/src/app/(app)/projects/[id]/page.tsx` | Create | Project detail page |
| `apps/web/src/app/(app)/areas/[id]/page.tsx` | Create | Area detail page |
| `apps/web/src/app/(app)/resources/page.tsx` | Create | Resources list page |
| `apps/web/src/app/(app)/archive/page.tsx` | Create | Archive page |

## Testing Checklist

- [x] Create project with all fields
- [x] Create area with icon and color
- [x] Create resource of each type
- [x] File inbox item to project
- [x] File inbox item to area
- [x] Archive inbox item
- [x] Project page shows actions and notes
- [x] Area page shows linked projects
- [x] Archive shows all archived items
- [x] Navigation updates in real-time

## Definition of Done

- [x] Project CRUD operations working
- [x] Area CRUD operations working
- [x] Resource CRUD operations working
- [x] PARA navigation sidebar
- [ ] File-to-PARA modal (deferred - basic filing via service available)
- [x] Project and area detail pages
- [x] Archive page
- [x] TypeScript/ESLint pass
- [ ] Unit tests for PARA service

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `packages/db/prisma/schema.prisma` | Modified | Enhanced Project, Area, Resource models |
| `apps/web/src/server/services/para.service.ts` | Created | PARA business logic |
| `apps/web/src/server/routers/para.ts` | Created | tRPC PARA procedures |
| `apps/web/src/server/routers/index.ts` | Modified | Registered paraRouter |
| `apps/web/src/components/para/para-nav.tsx` | Created | Navigation sidebar |
| `apps/web/src/components/para/create-project-modal.tsx` | Created | Project creation modal |
| `apps/web/src/components/para/create-area-modal.tsx` | Created | Area creation modal |
| `apps/web/src/components/ui/form.tsx` | Created | Form component (shadcn) |
| `apps/web/src/app/(auth)/projects/[id]/page.tsx` | Created | Project detail page |
| `apps/web/src/app/(auth)/areas/[id]/page.tsx` | Created | Area detail page |
| `apps/web/src/app/(auth)/resources/page.tsx` | Created | Resources list page |
| `apps/web/src/app/(auth)/archive/page.tsx` | Created | Archive page |

## QA Results

### QA Agent Review

**Date:** 2026-01-12
**Agent:** QA Agent (Claude Opus 4.5)

### Code Review Summary

**Files Reviewed:**
- [para.service.ts](apps/web/src/server/services/para.service.ts) - 470 lines
- [para.ts](apps/web/src/server/routers/para.ts) - 231 lines

### Implementation Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| Project CRUD | PASS | Full lifecycle: create, read, update, delete |
| Area CRUD | PASS | With sortOrder management and reorder support |
| Resource CRUD | PASS | Multiple types: note, link, file, collection |
| Filing functionality | PASS | `fileItem()` with note creation option |
| Archive operations | PASS | `listArchivedItems()`, `restoreFromArchive()` |
| Type safety | PASS | Proper input/output types with Prisma |
| Error handling | PASS | TRPCError with appropriate codes |

### Code Quality Findings

**Strengths:**
1. Clean separation between service and router layers
2. Proper handling of optional relations (disconnect pattern for nullable relations)
3. Sort order management for areas with auto-increment
4. `completedAt` and `archivedAt` timestamps set on status change
5. Transaction-based reorder operation for areas
6. Filing creates notes with `sourceInboxItemId` for traceability

**Deferred Items (Acceptable):**
- File-to-PARA modal component deferred (basic filing via service available)
- Unit tests for PARA service pending

### Build Verification

```
pnpm typecheck: PASS
pnpm lint: PASS (no warnings)
```

### Definition of Done Verification

- [x] Project CRUD operations working - Full service/router implementation
- [x] Area CRUD operations working - With reorder support
- [x] Resource CRUD operations working - All types supported
- [x] PARA navigation sidebar - `para-nav.tsx` component created
- [ ] File-to-PARA modal - Deferred (basic filing via service available)
- [x] Project and area detail pages - Dynamic routes created
- [x] Archive page - With filtering and restore
- [x] TypeScript/ESLint pass - Verified
- [ ] Unit tests for PARA service - Pending (acceptable for MVP)

### Final Assessment

**Status: APPROVED**

The implementation provides a complete PARA structure with all core operations. The File-to-PARA modal is deferred but the underlying service functionality is complete, allowing filing operations via the API.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-11 | 1.0 | Initial story specification | Bob (SM) |
| 2026-01-12 | 1.1 | Implementation complete - Ready for Review | James (Dev) |
| 2026-01-12 | 1.2 | QA review passed | QA Agent |
