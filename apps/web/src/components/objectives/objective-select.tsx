"use client";

import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

interface ObjectiveSelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  timeframe: "yearly" | "monthly";
  placeholder?: string;
  disabled?: boolean;
}

export function ObjectiveSelect({
  value,
  onChange,
  timeframe,
  placeholder = "Select parent objective",
  disabled = false,
}: ObjectiveSelectProps) {
  const { data: objectives, isLoading } = trpc.objectives.getAvailableParents.useQuery(
    { timeframe },
    { enabled: !disabled }
  );

  const handleChange = (val: string) => {
    onChange(val === "none" ? undefined : val);
  };

  return (
    <Select value={value || "none"} onValueChange={handleChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No parent</SelectItem>
        {objectives?.map((objective) => (
          <SelectItem key={objective.id} value={objective.id}>
            <div className="flex flex-col">
              <span>{objective.title}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(objective.startDate), "MMM d")} -{" "}
                {format(new Date(objective.endDate), "MMM d, yyyy")}
              </span>
            </div>
          </SelectItem>
        ))}
        {!isLoading && objectives?.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No {timeframe} objectives available
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
