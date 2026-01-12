"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ObjectiveSelect } from "./objective-select";
import { trpc } from "@/lib/trpc";
import type { ObjectiveWithRelations } from "@/server/services/objectives.service";

const createObjectiveSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  timeframe: z.enum(["yearly", "monthly", "weekly"]),
  parentId: z.string().uuid().optional(),
  cascadeToWeekly: z.boolean(),
});

type CreateObjectiveFormData = z.infer<typeof createObjectiveSchema>;

interface CreateObjectiveModalProps {
  open: boolean;
  onClose: () => void;
  defaultTimeframe?: "yearly" | "monthly" | "weekly";
  editingObjective?: ObjectiveWithRelations | null;
}

const getParentTimeframe = (
  timeframe: "yearly" | "monthly" | "weekly"
): "yearly" | "monthly" | undefined => {
  switch (timeframe) {
    case "weekly":
      return "monthly";
    case "monthly":
      return "yearly";
    default:
      return undefined;
  }
};

export function CreateObjectiveModal({
  open,
  onClose,
  defaultTimeframe = "weekly",
  editingObjective,
}: CreateObjectiveModalProps) {
  const utils = trpc.useUtils();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateObjectiveFormData>({
    resolver: zodResolver(createObjectiveSchema),
    defaultValues: {
      timeframe: defaultTimeframe,
      cascadeToWeekly: false,
    },
  });

  const timeframe = watch("timeframe");
  const parentTimeframe = getParentTimeframe(timeframe);

  // Reset form when modal opens/closes or editing objective changes
  useEffect(() => {
    if (open) {
      if (editingObjective) {
        reset({
          title: editingObjective.title,
          description: editingObjective.description || "",
          timeframe: editingObjective.timeframe as "yearly" | "monthly" | "weekly",
          parentId: editingObjective.parent?.id,
          cascadeToWeekly: false,
        });
      } else {
        reset({
          title: "",
          description: "",
          timeframe: defaultTimeframe,
          parentId: undefined,
          cascadeToWeekly: false,
        });
      }
    }
  }, [open, editingObjective, defaultTimeframe, reset]);

  const createMutation = trpc.objectives.create.useMutation({
    onSuccess: () => {
      utils.objectives.list.invalidate();
      utils.objectives.getCurrentWeek.invalidate();
      onClose();
    },
  });

  const updateMutation = trpc.objectives.update.useMutation({
    onSuccess: () => {
      utils.objectives.list.invalidate();
      utils.objectives.getCurrentWeek.invalidate();
      onClose();
    },
  });

  const onSubmit = async (data: CreateObjectiveFormData) => {
    if (editingObjective) {
      await updateMutation.mutateAsync({
        id: editingObjective.id,
        title: data.title,
        description: data.description,
      });
    } else {
      await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        timeframe: data.timeframe,
        parentId: data.parentId,
        cascadeToWeekly: data.cascadeToWeekly,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingObjective ? "Edit Objective" : "New Objective"}
          </DialogTitle>
          <DialogDescription>
            {editingObjective
              ? "Update your objective details."
              : "Set a goal for the selected time period."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Timeframe */}
          {!editingObjective && (
            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select
                value={timeframe}
                onValueChange={(val) =>
                  setValue("timeframe", val as "yearly" | "monthly" | "weekly")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="What do you want to achieve?"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add more details..."
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Parent Objective */}
          {!editingObjective && parentTimeframe && (
            <div className="space-y-2">
              <Label>Parent Objective (optional)</Label>
              <ObjectiveSelect
                value={watch("parentId")}
                onChange={(val) => setValue("parentId", val)}
                timeframe={parentTimeframe}
              />
            </div>
          )}

          {/* Cascade to Weekly */}
          {!editingObjective && timeframe === "monthly" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cascadeToWeekly"
                checked={watch("cascadeToWeekly")}
                onCheckedChange={(checked) =>
                  setValue("cascadeToWeekly", checked === true)
                }
              />
              <Label htmlFor="cascadeToWeekly" className="text-sm font-normal">
                Create weekly objectives for each week in the month
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingObjective
                  ? "Update Objective"
                  : "Create Objective"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
