"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, RefreshCw, Mail } from "lucide-react";

export function EmailForwardSetup() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = trpc.user.getForwardAddress.useQuery();
  const generateMutation = trpc.user.generateForwardToken.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const regenerateMutation = trpc.user.regenerateForwardToken.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCopy = async () => {
    if (data?.address) {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleRegenerate = () => {
    if (
      confirm(
        "Are you sure? Regenerating will invalidate your current forwarding address."
      )
    ) {
      regenerateMutation.mutate();
    }
  };

  const isGenerating = generateMutation.isPending || regenerateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Forwarding
        </CardTitle>
        <CardDescription>
          Forward emails to your Bee inbox by sending them to your personal
          forwarding address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : data?.hasAddress ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Your Forwarding Address
              </label>
              <div className="flex gap-2">
                <Input
                  value={data.address || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-medium">How to use:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Copy your forwarding address above</li>
                <li>Forward any email to this address</li>
                <li>The email will appear in your Bee inbox</li>
              </ol>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="mt-2"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`}
              />
              Regenerate Address
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t set up email forwarding yet. Generate a
              forwarding address to start capturing emails.
            </p>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Generate Forwarding Address
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
