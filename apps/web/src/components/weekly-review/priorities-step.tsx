"use client";

import { useState } from "react";
import { startOfWeek } from "date-fns";
import { FolderOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarSummaryCard } from "@/components/calendar/calendar-summary-card";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type {
  WeeklyReviewSessionWithData,
  PrioritiesStepData,
} from "@/server/services/weekly-review.service";

interface PrioritiesStepProps {
  session: WeeklyReviewSessionWithData;
  onComplete: (data: PrioritiesStepData) => void;
  onBack: () => void;
}

export function PrioritiesStep({ session, onComplete, onBack }: PrioritiesStepProps) {
  // Query for projects and areas
  // Note: These procedures need to exist in the codebase
  // For now, we'll use placeholder data structure
  const { data: projects, isLoading: projectsLoading } = trpc.objectives.list.useQuery({
    timeframe: undefined,
    status: "active",
    includeChildren: false,
  });

  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    session.data.priorities?.selectedProjects || []
  );
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    session.data.priorities?.selectedAreas || []
  );

  // Placeholder areas until PARA is implemented
  const areas = [
    { id: "health", name: "Health", icon: "💪" },
    { id: "work", name: "Work", icon: "💼" },
    { id: "finance", name: "Finance", icon: "💰" },
    { id: "learning", name: "Learning", icon: "📚" },
    { id: "relationships", name: "Relationships", icon: "❤️" },
    { id: "home", name: "Home", icon: "🏠" },
  ];

  const handleToggleProject = (id: string) => {
    if (selectedProjects.includes(id)) {
      setSelectedProjects(selectedProjects.filter((p) => p !== id));
    } else {
      setSelectedProjects([...selectedProjects, id]);
    }
  };

  const handleToggleArea = (id: string) => {
    if (selectedAreas.includes(id)) {
      setSelectedAreas(selectedAreas.filter((a) => a !== id));
    } else {
      setSelectedAreas([...selectedAreas, id]);
    }
  };

  const handleNext = () => {
    onComplete({ selectedProjects, selectedAreas });
  };

  const isLoading = projectsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const weekStart = startOfWeek(new Date(session.weekStart), { weekStartsOn: 1 });

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Select Your Priorities</h2>
          <p className="text-muted-foreground">
            Which projects and areas need your attention this week?
            Select 3-5 for focused work.
          </p>
        </div>

        {/* Projects Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" />
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects && projects.length > 0 ? (
              <div className="space-y-2">
                {projects.slice(0, 10).map((project) => (
                  <label
                    key={project.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      "hover:bg-muted/50 border",
                      selectedProjects.includes(project.id) &&
                        "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => handleToggleProject(project.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{project.title}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active projects. Projects linked to objectives will appear here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Areas Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Areas of Responsibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {areas.map((area) => (
                <label
                  key={area.id}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                    "hover:bg-muted/50 border",
                    selectedAreas.includes(area.id) &&
                      "border-primary bg-primary/5"
                  )}
                >
                  <Checkbox
                    checked={selectedAreas.includes(area.id)}
                    onCheckedChange={() => handleToggleArea(area.id)}
                  />
                  <span className="text-lg">{area.icon}</span>
                  <span className="font-medium">{area.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selection Summary */}
        {(selectedProjects.length > 0 || selectedAreas.length > 0) && (
          <div className="text-sm text-muted-foreground">
            Selected: {selectedProjects.length} project(s), {selectedAreas.length} area(s)
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button onClick={handleNext}>
            Next: Actions →
          </Button>
        </div>
      </div>

      {/* Sidebar with calendar summary */}
      <div className="w-80 shrink-0 hidden lg:block">
        <CalendarSummaryCard weekStart={weekStart} />
      </div>
    </div>
  );
}
