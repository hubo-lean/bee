"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wrench,
  Calendar,
  CheckSquare,
  FileText,
  Bookmark,
  CalendarDays,
  HelpCircle,
  Plus,
  Mic,
  Archive,
} from "lucide-react";
import type { InboxItem } from "@packages/db";

export interface ActionCorrection {
  originalId?: string;
  description: string;
  keep: boolean;
  isNew: boolean;
}

interface CorrectionModalProps {
  open: boolean;
  item: InboxItem | null;
  sessionId: string;
  onClose: () => void;
  onSubmit: (correction: {
    inboxItemId: string;
    sessionId: string;
    correctionType: "fix_now" | "weekly_review";
    correctedCategory?: string;
    correctedActions?: ActionCorrection[];
    userReason?: string;
  }) => void;
}

const CATEGORIES = [
  { value: "action", label: "Action", icon: CheckSquare },
  { value: "note", label: "Note", icon: FileText },
  { value: "reference", label: "Reference", icon: Bookmark },
  { value: "meeting", label: "Meeting", icon: CalendarDays },
  { value: "unknown", label: "Unsure", icon: HelpCircle },
  { value: "archive", label: "Archive", icon: Archive },
];

export function CorrectionModal({
  open,
  item,
  sessionId,
  onClose,
  onSubmit,
}: CorrectionModalProps) {
  const [step, setStep] = useState<"choice" | "fix">("choice");
  const [category, setCategory] = useState<string>("");
  const [actions, setActions] = useState<ActionCorrection[]>([]);
  const [reason, setReason] = useState("");

  // Get classification data from item
  const aiClassification = item?.aiClassification as Record<string, unknown> | null;
  const originalCategory = (aiClassification?.category as string) || "unknown";
  const confidence = (aiClassification?.confidence as number) || 0;

  // Initialize from item
  useEffect(() => {
    if (item) {
      setCategory(originalCategory);
      const extractedActions = (item.extractedActions as Array<{
        id: string;
        description: string;
      }>) || [];
      setActions(
        extractedActions.map((a) => ({
          originalId: a.id,
          description: a.description,
          keep: true,
          isNew: false,
        }))
      );
    }
  }, [item, originalCategory]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep("choice");
      setReason("");
    }
  }, [open]);

  const handleSendToWeekly = () => {
    if (!item) return;

    onSubmit({
      inboxItemId: item.id,
      sessionId,
      correctionType: "weekly_review",
    });
    onClose();
  };

  const handleFixNow = () => {
    if (!item) return;

    onSubmit({
      inboxItemId: item.id,
      sessionId,
      correctionType: "fix_now",
      correctedCategory: category,
      correctedActions: actions,
      userReason: reason || undefined,
    });
    onClose();
  };

  const addNewAction = () => {
    setActions([...actions, { description: "", keep: true, isNew: true }]);
  };

  const updateAction = (index: number, updates: Partial<ActionCorrection>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  if (!item) return null;

  if (step === "choice") {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[50vh] rounded-t-xl">
          <SheetHeader>
            <SheetTitle>What&apos;s wrong?</SheetTitle>
          </SheetHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              AI classified this as:{" "}
              <strong className="capitalize">{originalCategory}</strong>
              <br />
              Confidence: {Math.round(confidence * 100)}%
            </p>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => setStep("fix")}
              >
                <Wrench className="h-5 w-5 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Fix now</div>
                  <div className="text-sm text-muted-foreground">
                    Correct the classification
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={handleSendToWeekly}
              >
                <Calendar className="h-5 w-5 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Send to weekly review</div>
                  <div className="text-sm text-muted-foreground">
                    Deal with it later
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle>Fix Classification</SheetTitle>
        </SheetHeader>

        <div className="flex-1 py-4 space-y-6 overflow-y-auto">
          {/* Category Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              What type is this really?
            </Label>
            <RadioGroup value={category} onValueChange={setCategory}>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={cat.value} id={cat.value} />
                    <Label
                      htmlFor={cat.value}
                      className="flex items-center cursor-pointer"
                    >
                      <cat.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Action Editing */}
          {actions.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Edit extracted actions:
              </Label>
              <div className="space-y-2">
                {actions.map((action, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Checkbox
                      checked={action.keep}
                      onCheckedChange={(checked) => {
                        updateAction(idx, { keep: checked === true });
                      }}
                    />
                    <Input
                      value={action.description}
                      onChange={(e) => {
                        updateAction(idx, { description: e.target.value });
                      }}
                      className="flex-1"
                      placeholder="Action description..."
                    />
                    {action.isNew && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAction(idx)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={addNewAction}>
            <Plus className="h-4 w-4 mr-1" /> Add action
          </Button>

          {/* Reason */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Why is this wrong? (optional)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Help the AI understand..."
              rows={2}
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-muted-foreground"
              disabled
            >
              <Mic className="h-4 w-4 mr-1" /> Voice note (coming soon)
            </Button>
          </div>
        </div>

        <SheetFooter className="shrink-0 pt-4 border-t gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setStep("choice")}>
            Back
          </Button>
          <Button onClick={handleFixNow}>Save Fix</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
