"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  validateImageFile,
  ACCEPTED_TYPES,
  MAX_SIZE_MB,
} from "@/lib/storage";
import { toast } from "sonner";

interface ImageCaptureProps {
  onImageSelect: (file: File) => void;
  onImageClear: () => void;
  selectedImage: File | null;
  previewUrl: string | null;
  isUploading: boolean;
  uploadProgress: number;
}

export function ImageCapture({
  onImageSelect,
  onImageClear,
  selectedImage,
  previewUrl,
  isUploading,
  uploadProgress,
}: ImageCaptureProps) {
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError.message);
        return;
      }

      onImageSelect(file);
    },
    [onImageSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
    // Reset input value so same file can be selected again
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndSelect(file);
      }
    },
    [validateAndSelect]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            validateAndSelect(file);
            toast.success("Image pasted from clipboard");
            break;
          }
        }
      }
    },
    [validateAndSelect]
  );

  // Listen for paste events when component is mounted
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Load image dimensions when preview URL changes
  useEffect(() => {
    if (previewUrl) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = previewUrl;
    } else {
      setImageDimensions(null);
    }
  }, [previewUrl]);

  // Show preview if image selected
  if (previewUrl) {
    return (
      <div className="relative">
        <div className="relative overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-48 w-full object-contain bg-muted/50"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <div className="mb-2 h-2 w-32 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-sm">Uploading... {uploadProgress}%</span>
              </div>
            </div>
          )}
        </div>

        {selectedImage && (
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex flex-col">
              <span className="truncate max-w-[200px]">
                {selectedImage.name}
              </span>
              <span className="text-xs">
                {(selectedImage.size / 1024).toFixed(0)} KB
                {imageDimensions &&
                  ` • ${imageDimensions.width}×${imageDimensions.height}`}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onImageClear}
              disabled={isUploading}
            >
              <X className="mr-1 h-4 w-4" />
              Remove
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Show capture/upload options
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        error && "border-destructive/50"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {/* Camera (mobile only) */}
        {isMobile && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* File upload */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {isMobile
          ? "Take a photo or upload an image"
          : "Drop an image, paste from clipboard (Ctrl+V), or click to upload"}
      </p>

      <p className="mt-1 text-xs text-muted-foreground/70">
        JPEG, PNG, WebP, GIF • Max {MAX_SIZE_MB}MB
      </p>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
