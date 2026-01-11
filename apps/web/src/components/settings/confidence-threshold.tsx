"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";

interface ConfidenceThresholdProps {
  className?: string;
}

/**
 * Settings component for configuring the confidence threshold
 * Controls when items are auto-filed vs. sent to review queue
 */
export function ConfidenceThreshold({ className }: ConfidenceThresholdProps) {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.user.getSettings.useQuery();
  const [localValue, setLocalValue] = useState<number | null>(null);

  const { mutate: updateThreshold, isPending } = trpc.user.updateConfidenceThreshold.useMutation({
    onSuccess: () => {
      utils.user.getSettings.invalidate();
      setLocalValue(null);
    },
  });

  if (isLoading || !settings) {
    return (
      <div className={`animate-pulse bg-gray-100 rounded-lg h-24 ${className ?? ""}`} />
    );
  }

  const currentValue = localValue ?? settings.confidenceThreshold;
  const displayPercent = Math.round(currentValue * 100);

  const getThresholdDescription = (value: number) => {
    if (value >= 0.8) return "Very strict - most items will need review";
    if (value >= 0.6) return "Balanced - moderate auto-filing";
    if (value >= 0.4) return "Relaxed - more items auto-filed";
    return "Very relaxed - most items auto-filed";
  };

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <div>
        <h3 className="text-sm font-medium text-gray-900">
          Confidence Threshold
        </h3>
        <p className="text-sm text-gray-500">
          Items with confidence below this threshold will be sent to the review queue
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold text-gray-900">
            {displayPercent}%
          </span>
          {localValue !== null && localValue !== settings.confidenceThreshold && (
            <button
              onClick={() => updateThreshold({ threshold: localValue })}
              disabled={isPending}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        <Slider
          value={[currentValue]}
          min={0.1}
          max={0.95}
          step={0.05}
          onValueChange={([value]) => setLocalValue(value)}
          disabled={isPending}
          className="w-full"
        />

        <div className="flex justify-between text-xs text-gray-400">
          <span>10% (auto-file most)</span>
          <span>95% (review most)</span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          {getThresholdDescription(currentValue)}
        </p>
      </div>
    </div>
  );
}
