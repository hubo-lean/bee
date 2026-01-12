"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectiveCard } from "@/components/objectives/objective-card";
import { CreateObjectiveModal } from "@/components/objectives/create-objective-modal";
import { trpc } from "@/lib/trpc";
import type { ObjectiveWithRelations } from "@/server/services/objectives.service";

type Timeframe = "yearly" | "monthly" | "weekly";

export default function ObjectivesPage() {
  const [activeTab, setActiveTab] = useState<Timeframe>("weekly");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<ObjectiveWithRelations | null>(null);

  const { data: objectives, isLoading } = trpc.objectives.list.useQuery({
    timeframe: activeTab,
    includeChildren: true,
  });

  const handleEdit = (objective: ObjectiveWithRelations) => {
    setEditingObjective(objective);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingObjective(null);
  };

  const handleOpenCreate = () => {
    setEditingObjective(null);
    setIsModalOpen(true);
  };

  // Filter to only show root objectives (no parent in same timeframe)
  const rootObjectives = objectives?.filter((obj) => {
    // Show objectives that either have no parent, or their parent is a different timeframe
    if (!obj.parent) return true;
    return obj.parent.timeframe !== obj.timeframe;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objectives</h1>
          <p className="text-muted-foreground">
            Set and track your goals across different timeframes
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Objective
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as Timeframe)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
        </TabsList>

        <TabsContent value="yearly" className="mt-6">
          <ObjectivesList
            objectives={rootObjectives}
            isLoading={isLoading}
            onEdit={handleEdit}
            emptyMessage="No yearly objectives yet. Set a big goal for the year!"
          />
        </TabsContent>

        <TabsContent value="monthly" className="mt-6">
          <ObjectivesList
            objectives={rootObjectives}
            isLoading={isLoading}
            onEdit={handleEdit}
            emptyMessage="No monthly objectives yet. Break down your yearly goals!"
          />
        </TabsContent>

        <TabsContent value="weekly" className="mt-6">
          <ObjectivesList
            objectives={rootObjectives}
            isLoading={isLoading}
            onEdit={handleEdit}
            emptyMessage="No weekly objectives yet. What will you focus on this week?"
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <CreateObjectiveModal
        open={isModalOpen}
        onClose={handleCloseModal}
        defaultTimeframe={activeTab}
        editingObjective={editingObjective}
      />
    </div>
  );
}

interface ObjectivesListProps {
  objectives?: ObjectiveWithRelations[];
  isLoading: boolean;
  onEdit: (objective: ObjectiveWithRelations) => void;
  emptyMessage: string;
}

function ObjectivesList({ objectives, isLoading, onEdit, emptyMessage }: ObjectivesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!objectives || objectives.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {objectives.map((objective) => (
        <ObjectiveCard
          key={objective.id}
          objective={objective}
          onEdit={onEdit}
          showChildren={true}
        />
      ))}
    </div>
  );
}
