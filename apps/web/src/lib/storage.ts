"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UploadResult {
  url: string;
  path: string;
}

export interface UploadError {
  message: string;
  code?: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function validateImageFile(file: File): UploadError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      message: "Please select a JPEG, PNG, WebP, or GIF image",
      code: "INVALID_TYPE",
    };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return {
      message: `Image too large. Maximum size is ${MAX_SIZE_MB}MB`,
      code: "FILE_TOO_LARGE",
    };
  }

  return null;
}

export async function uploadImage(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const timestamp = Date.now();
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);
  const path = `inbox/${userId}/${timestamp}-${sanitizedName}`;

  // Note: Supabase doesn't support progress tracking directly
  // We simulate progress for UX purposes
  onProgress?.(10);

  const { data, error } = await supabase.storage
    .from("media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.(90);

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(path);

  onProgress?.(100);

  return {
    url: publicUrl,
    path: data.path,
  };
}

export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from("media").remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

export async function uploadAudio(
  blob: Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  onProgress?.(10);

  const { data, error } = await supabase.storage.from("media").upload(path, blob, {
    contentType: "audio/webm",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  onProgress?.(90);

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(path);

  onProgress?.(100);

  return {
    url: publicUrl,
    path: data.path,
  };
}

export { ACCEPTED_TYPES, MAX_SIZE_MB, MAX_SIZE_BYTES };
