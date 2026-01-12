"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  areaId: z.string().uuid().optional(),
  objectiveId: z.string().uuid().optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  defaultAreaId?: string;
}

export function CreateProjectModal({
  open,
  onClose,
  defaultAreaId,
}: CreateProjectModalProps) {
  const utils = trpc.useUtils();
  const { data: areas } = trpc.para.listAreas.useQuery();
  const { data: objectives } = trpc.objectives.list.useQuery({
    timeframe: "monthly",
    status: "active",
  });

  const createProject = trpc.para.createProject.useMutation({
    onSuccess: () => {
      utils.para.listProjects.invalidate();
      form.reset();
      onClose();
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      areaId: defaultAreaId,
      color: undefined,
    },
  });

  const onSubmit = (data: FormData) => {
    createProject.mutate({
      name: data.name,
      description: data.description || undefined,
      areaId: data.areaId || undefined,
      objectiveId: data.objectiveId || undefined,
      color: data.color || undefined,
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's this project about?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select area..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {areas?.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.icon} {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="objectiveId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Objective (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Link to objective..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {objectives?.map((obj) => (
                        <SelectItem key={obj.id} value={obj.id}>
                          {obj.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${
                          field.value === color.value
                            ? "border-foreground"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => field.onChange(color.value)}
                        title={color.label}
                      />
                    ))}
                    {field.value && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => field.onChange(undefined)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
