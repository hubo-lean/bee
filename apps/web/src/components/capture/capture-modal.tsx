"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, Send, Loader2, Type, Image as ImageIcon, Mic } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/use-media-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { uploadImage, uploadAudio } from "@/lib/storage";
import { ImageCapture } from "./image-capture";
import { VoiceCapture } from "./voice-capture";

const captureSchema = z.object({
  content: z
    .string()
    .max(10000, "Content must be 10,000 characters or less")
    .optional(),
});

type CaptureFormData = z.infer<typeof captureSchema>;

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaptureModal({ isOpen, onClose }: CaptureModalProps) {
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragControls = useDragControls();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"text" | "image" | "voice">("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CaptureFormData>({
    resolver: zodResolver(captureSchema),
    defaultValues: { content: "" },
  });

  const content = watch("content");
  const charCount = content?.length || 0;

  const createInboxItem = trpc.inbox.create.useMutation({
    onSuccess: () => {
      toast.success("Captured!", { duration: 2000 });
      resetForm();
      utils.inbox.count.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to capture", {
        description: error.message,
        action: {
          label: "Retry",
          onClick: () => handleSubmit(onSubmit)(),
        },
      });
    },
  });

  const resetForm = useCallback(() => {
    reset();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImage(null);
    setPreviewUrl(null);
    setActiveTab("text");
    setUploadProgress(0);
  }, [reset, previewUrl]);

  const handleImageSelect = useCallback((file: File) => {
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleImageClear = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImage(null);
    setPreviewUrl(null);
  }, [previewUrl]);

  const handleVoiceRecordingComplete = useCallback(
    async (audioBlob: Blob, transcription: string) => {
      try {
        setIsUploading(true);

        // TODO: Replace with actual user ID from session
        const userId = "temp-user";

        // Upload audio to Supabase Storage
        const timestamp = Date.now();
        const path = `inbox/${userId}/voice/${timestamp}.webm`;
        const { url } = await uploadAudio(audioBlob, path, setUploadProgress);

        // Create inbox item
        createInboxItem.mutate({
          type: "voice",
          content: transcription,
          mediaUrl: url,
          source: "capture",
        });
      } catch (error) {
        toast.error("Failed to upload audio", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [createInboxItem]
  );

  const onSubmit = useCallback(
    async (data: CaptureFormData) => {
      // Text capture
      if (activeTab === "text") {
        if (!data.content?.trim()) {
          toast.error("Please enter something to capture");
          return;
        }
        createInboxItem.mutate({
          type: "manual",
          content: data.content,
          source: "capture",
        });
        return;
      }

      // Image capture
      if (!selectedImage) {
        toast.error("Please select an image");
        return;
      }

      try {
        setIsUploading(true);

        // TODO: Replace with actual user ID from session
        const userId = "temp-user";

        // Upload image to Supabase Storage
        const { url } = await uploadImage(
          selectedImage,
          userId,
          setUploadProgress
        );

        // Create inbox item with image URL
        createInboxItem.mutate({
          type: "image",
          content: data.content || `Image captured at ${new Date().toLocaleString()}`,
          mediaUrl: url,
          source: "capture",
        });
      } catch (error) {
        toast.error("Failed to upload image", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [activeTab, selectedImage, createInboxItem]
  );

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current && activeTab === "text") {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle Cmd/Ctrl + Enter to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    },
    [handleSubmit, onSubmit]
  );

  // Auto-resize textarea
  const handleTextareaChange = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);

  const { ref: formRef, ...rest } = register("content", {
    onChange: handleTextareaChange,
  });

  const isPending = createInboxItem.isPending || isUploading;

  const canSubmit =
    activeTab === "text"
      ? !!content?.trim()
      : !!selectedImage;

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/50"
            />

            {/* Bottom drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragControls={dragControls}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  onClose();
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background pb-safe"
            >
              {/* Drag handle */}
              <div
                className="flex justify-center py-3"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="px-4 pb-4"
              >
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as "text" | "image" | "voice")}
                >
                  <TabsList className="mb-4 w-full">
                    <TabsTrigger value="text" className="flex-1">
                      <Type className="mr-2 h-4 w-4" />
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex-1">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="voice" className="flex-1">
                      <Mic className="mr-2 h-4 w-4" />
                      Voice
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text">
                    <div className="relative">
                      <Textarea
                        {...rest}
                        ref={(e) => {
                          formRef(e);
                          (
                            textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
                          ).current = e;
                        }}
                        placeholder="What's on your mind?"
                        onKeyDown={handleKeyDown}
                        className="min-h-[100px] resize-none pr-12"
                        disabled={isPending}
                      />

                      <Button
                        type="submit"
                        size="icon"
                        disabled={!canSubmit || isPending}
                        className="absolute bottom-2 right-2"
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {errors.content?.message || (
                          <span className="text-muted-foreground/60">
                            Press Cmd+Enter to submit
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          charCount > 9500 && "text-yellow-500",
                          charCount > 10000 && "text-destructive"
                        )}
                      >
                        {charCount}/10,000
                      </span>
                    </div>
                  </TabsContent>

                  <TabsContent value="image">
                    <ImageCapture
                      onImageSelect={handleImageSelect}
                      onImageClear={handleImageClear}
                      selectedImage={selectedImage}
                      previewUrl={previewUrl}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                    />

                    <Textarea
                      {...rest}
                      placeholder="Add a note (optional)"
                      className="mt-3 min-h-[60px] resize-none"
                      disabled={isPending}
                    />

                    <div className="mt-4 flex justify-end">
                      <Button
                        type="submit"
                        disabled={!canSubmit || isPending}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isUploading ? "Uploading..." : "Capturing..."}
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Capture
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="voice">
                    <VoiceCapture
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onCancel={() => setActiveTab("text")}
                      isUploading={isUploading}
                    />
                  </TabsContent>
                </Tabs>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop modal
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />

          {/* Centered modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quick Capture</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "text" | "image" | "voice")}
              >
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="text" className="flex-1">
                    <Type className="mr-2 h-4 w-4" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="image" className="flex-1">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Image
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text">
                  <Textarea
                    {...rest}
                    ref={(e) => {
                      formRef(e);
                      (
                        textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
                      ).current = e;
                    }}
                    placeholder="What's on your mind?"
                    onKeyDown={handleKeyDown}
                    className="min-h-[120px] resize-none"
                    disabled={isPending}
                  />

                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {errors.content?.message || (
                        <span className="text-muted-foreground/60">
                          Press{" "}
                          {typeof navigator !== "undefined" &&
                          navigator.platform?.includes("Mac")
                            ? "Cmd"
                            : "Ctrl"}
                          +Enter to submit
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        charCount > 9500 && "text-yellow-500",
                        charCount > 10000 && "text-destructive"
                      )}
                    >
                      {charCount}/10,000
                    </span>
                  </div>
                </TabsContent>

                <TabsContent value="image">
                  <ImageCapture
                    onImageSelect={handleImageSelect}
                    onImageClear={handleImageClear}
                    selectedImage={selectedImage}
                    previewUrl={previewUrl}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                  />

                  <Textarea
                    {...rest}
                    placeholder="Add a note (optional)"
                    className="mt-3 min-h-[60px] resize-none"
                    disabled={isPending}
                  />
                </TabsContent>

                <TabsContent value="voice">
                  <VoiceCapture
                    onRecordingComplete={handleVoiceRecordingComplete}
                    onCancel={() => setActiveTab("text")}
                    isUploading={isUploading}
                  />
                </TabsContent>
              </Tabs>

              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit || isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isUploading ? "Uploading..." : "Capturing..."}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Capture
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
