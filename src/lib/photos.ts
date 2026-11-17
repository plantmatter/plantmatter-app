import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { MEDIA_BUCKET, supabase, USER_BUCKET } from './supabase';

/** A photo in a form: either already stored (path) or just picked on this device (uri). */
export type FormPhoto = { key: string; path?: string; uri?: string; width?: number; height?: number };

export const isLocalUri = (s: string) => /^(file|content|ph|assets-library|blob|data):/i.test(s);

/**
 * Pick photos and re-encode them as JPEG (long side ≤ maxSide). Re-encoding also drops EXIF data such
 * as GPS, so no location ever leaves the phone. Returns [] when cancelled; throws 'permission' when
 * camera access was refused.
 */
export async function pickPhotos(source: 'library' | 'camera', max: number, maxSide = 1600): Promise<FormPhoto[]> {
  if (max <= 0) return [];
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('permission');
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
      allowsMultipleSelection: max > 1,
      selectionLimit: max,
      orderedSelection: true,
    });
  }
  if (result.canceled) return [];
  const out: FormPhoto[] = [];
  for (const asset of result.assets.slice(0, max)) out.push(await shrink(asset.uri, asset.width, asset.height, maxSide));
  return out;
}

async function shrink(uri: string, width: number, height: number, maxSide: number): Promise<FormPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  const long = Math.max(width || 0, height || 0);
  if (long > maxSide) ctx.resize(width >= height ? { width: maxSide } : { height: maxSide });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { key: randomUUID(), uri: saved.uri, width: saved.width, height: saved.height };
}

async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web' || /^(blob|data|https?):/i.test(uri)) return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return await new File(uri).bytes();
}

export async function uploadPhoto(bucket: string, path: string, uri: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const body = await readBytes(uri);
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function removePhotos(bucket: string, paths: string[]) {
  if (!supabase || !paths.length) return;
  await supabase.storage.from(bucket).remove(paths).catch(() => {});
}

/** Upload new photos of a form and return the final ordered path list. */
export async function storeFormPhotos(bucket: string, folder: string, photos: FormPhoto[]) {
  const paths: string[] = [];
  const uploaded: string[] = [];
  try {
    for (const p of photos) {
      if (p.path) {
        paths.push(p.path);
        continue;
      }
      if (!p.uri) continue;
      const path = `${folder}/${p.key}.jpg`;
      await uploadPhoto(bucket, path, p.uri);
      uploaded.push(path);
      paths.push(path);
    }
  } catch (e) {
    await removePhotos(bucket, uploaded);
    throw e;
  }
  return paths;
}

export const userFolder = (uid: string, kind: 'plants' | 'finds', id: string) => `${uid}/${kind}/${id}`;
export const publicMediaUrl = (path: string) => (supabase && path ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl : '');

/** Signed URLs for private photos, cached for 50 minutes (they are valid for an hour). */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p && !isLocalUri(p)))].sort();
  const q = useQuery({
    queryKey: ['signed', list],
    enabled: !!supabase && list.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase!.storage.from(USER_BUCKET).createSignedUrls(list, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      return map;
    },
  });
  return (path: string | null | undefined) => (!path ? '' : isLocalUri(path) ? path : q.data?.[path] ?? '');
}
