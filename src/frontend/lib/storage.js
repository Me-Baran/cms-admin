/**
 * Supabase Storage upload support.
 *
 * Provides image upload to Supabase Storage as an alternative to GitHub API.
 * Requires a Supabase Storage bucket named 'images' (or configurable).
 */

import { supabase } from './supabase.js';

const DEFAULT_BUCKET = 'images';

/**
 * Upload a file to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadToStorage(file, folder = 'uploads', bucket = DEFAULT_BUCKET) {
  const ext = file.name.split('.').pop().toLowerCase();
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
  const uniqueId = Date.now().toString(36);
  const path = `${folder}/${safeName}-${uniqueId}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    bucket,
  };
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFromStorage(path, bucket = DEFAULT_BUCKET) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
  return { deleted: true };
}

/**
 * List files in a folder.
 */
export async function listStorageFiles(folder = '', bucket = DEFAULT_BUCKET) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder);

  if (error) throw new Error(`List failed: ${error.message}`);
  return data;
}
