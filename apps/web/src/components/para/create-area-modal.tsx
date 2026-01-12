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
import { trpc } from "@/lib/trpc";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const ICONS = ["💪", "💰", "📚", "🏠", "👨‍👩‍👧", "🎯", "💼", "🎨", "🌱", "🧘"];

const COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

interface CreateAreaModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAreaModal({ open, onClose }: CreateAreaModalProps) {
  const utils = trpc.useUtils();

  const createArea = trpc.para.createArea.useMutation({
    onSuccess: () => {
      utils.para.listAreas.invalidate();
      form.reset();
      onClose();
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: undefined,
      color: undefined,
    },
  });

  const onSubmit = (data: FormData) => {
    createArea.mutate({
      name: data.name,
      description: data.description || undefined,
      icon: data.icon || undefined,
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
          <DialogTitle>New Area</DialogTitle>
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
                    <Input placeholder="e.g., Health, Finance, Career" {...field} />
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
                      placeholder="What responsibilities does this area cover?"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`w-9 h-9 text-lg rounded-lg border-2 flex items-center justify-center ${
                          field.value === icon
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-muted hover:bg-muted/80"
                        }`}
                        onClick={() => field.onChange(icon)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color (optional)</FormLabel>
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
              <Button type="submit" disabled={createArea.isPending}>
                {createArea.isPending ? "Creating..." : "Create Area"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
