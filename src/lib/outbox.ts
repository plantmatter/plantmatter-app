// Observations are often recorded without signal. One that cannot be uploaded is kept on the phone
// (row + photo copies in the app's documents folder) and uploaded later, automatically.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { upsertFind, type FindInput } from './data';
import { removePhotos, uploadPhoto, userFolder, type FormPhoto } from './photos';
import { errorText, isNetworkError, USER_BUCKET } from './supabase';
import type { Find } from './types';

export type QueuedPhoto = { path: string; uri: string; uploaded: boolean };
export type QueuedFind = { row: FindInput; photos: QueuedPhoto[]; removed: string[]; queuedAt: string; error?: string };

const key = (uid: string) => `pm-outbox-${uid}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const outboxSupported = Platform.OS !== 'web';

export async function readOutbox(uid: string): Promise<QueuedFind[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    const list = raw ? (JSON.parse(raw) as QueuedFind[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function writeOutbox(uid: string, list: QueuedFind[]) {
  await AsyncStorage.setItem(key(uid), JSON.stringify(list));
  emit();
}

function keepCopy(findId: string, photoKey: string, uri: string) {
  const dir = new Directory(Paths.document, 'outbox', findId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${photoKey}.jpg`);
  if (!dest.exists) new File(uri).copySync(dest);
  return dest.uri;
}
function dropCopies(findId: string) {
  try {
    const dir = new Directory(Paths.document, 'outbox', findId);
    if (dir.exists) dir.delete();
  } catch {
    // nothing to clean
  }
}

/** Shape of a queued find as shown in lists (photo_paths point at the local copies). */
export const queuedAsFind = (uid: string, q: QueuedFind): Find & { pending: true; pendingError?: string } => ({
  ...q.row,
  owner_id: uid,
  photo_paths: q.photos.map((p) => p.uri),
  pending: true,
  pendingError: q.error,
});

export type SaveResult = 'saved' | 'queued';

/**
 * Save a find: upload photos and the row; when there is no connection (and this is a phone), queue it.
 * `photos` is the final ordered list from the form; stored ones keep their path.
 */
export async function saveFind(uid: string, row: Omit<FindInput, 'photo_paths'>, photos: FormPhoto[], previousPaths: string[]): Promise<SaveResult> {
  const folder = userFolder(uid, 'finds', row.id);
  const planned: QueuedPhoto[] = photos.map((p) => (p.path ? { path: p.path, uri: p.path, uploaded: true } : { path: `${folder}/${p.key}.jpg`, uri: p.uri ?? '', uploaded: false }));
  const finalPaths = planned.map((p) => p.path);
  const removed = previousPaths.filter((p) => !finalPaths.includes(p));
  try {
    for (const p of planned) if (!p.uploaded) await uploadPhoto(USER_BUCKET, p.path, p.uri);
    await upsertFind(uid, { ...row, photo_paths: finalPaths });
    await removePhotos(USER_BUCKET, removed);
    // A newer online save replaces anything still waiting for this find.
    const list = await readOutbox(uid);
    if (list.some((q) => q.row.id === row.id)) {
      dropCopies(row.id);
      await writeOutbox(uid, list.filter((q) => q.row.id !== row.id));
    }
    return 'saved';
  } catch (e) {
    if (!outboxSupported || !isNetworkError(e)) throw e;
    const kept = planned.map((p) => (p.uploaded ? p : { ...p, uri: keepCopy(row.id, p.path.split('/').pop()!.replace(/\.jpg$/, ''), p.uri) }));
    const list = (await readOutbox(uid)).filter((q) => q.row.id !== row.id);
    list.push({ row: { ...row, photo_paths: finalPaths }, photos: kept, removed, queuedAt: new Date().toISOString() });
    await writeOutbox(uid, list);
    return 'queued';
  }
}

export async function discardQueued(uid: string, findId: string) {
  dropCopies(findId);
  await writeOutbox(uid, (await readOutbox(uid)).filter((q) => q.row.id !== findId));
}

let flushing: Promise<number> | null = null;
/** Try to upload everything waiting. Returns how many finds went up. */
export function flushOutbox(uid: string): Promise<number> {
  if (!outboxSupported) return Promise.resolve(0);
  if (flushing) return flushing;
  flushing = (async () => {
    let done = 0;
    const list = await readOutbox(uid);
    const left: QueuedFind[] = [];
    for (const q of list) {
      try {
        for (const p of q.photos) {
          if (p.uploaded) continue;
          await uploadPhoto(USER_BUCKET, p.path, p.uri);
          p.uploaded = true;
        }
        await upsertFind(uid, q.row);
        await removePhotos(USER_BUCKET, q.removed);
        dropCopies(q.row.id);
        done++;
      } catch (e) {
        left.push({ ...q, error: isNetworkError(e) ? undefined : errorText(e) });
        if (isNetworkError(e)) {
          // Still offline: keep the rest as they are and stop trying for now.
          left.push(...list.slice(list.indexOf(q) + 1));
          break;
        }
      }
    }
    await writeOutbox(uid, left);
    return done;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function useOutbox(uid: string | undefined) {
  const [state, setState] = useState<{ uid?: string; list: QueuedFind[] }>({ list: [] });
  useEffect(() => {
    if (!uid || !outboxSupported) return;
    let alive = true;
    const load = () =>
      readOutbox(uid).then((list) => {
        if (alive) setState({ uid, list });
      });
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [uid]);
  return state.uid === uid ? state.list : [];
}
