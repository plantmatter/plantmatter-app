// Supabase Edge Function: delete-account
// Deletes the signed-in user's photos and then the account itself. Plants, finds, categories and the
// profile are removed by the database (ON DELETE CASCADE). Required by the App Store and Google Play.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → Via editor
//         name it "delete-account", paste this file, Deploy. Keep "Verify JWT" ON.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'user-photos';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return json({ error: 'Not signed in' }, 401);

  // 1) Photos: every file under "<user id>/" in the private bucket.
  const files: string[] = [];
  const walk = async (prefix: string): Promise<void> => {
    for (let offset = 0; ; offset += 1000) {
      const { data: items, error: listError } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (listError) throw listError;
      for (const item of items ?? []) {
        const path = `${prefix}/${item.name}`;
        // Folders have no id in the listing.
        if (item.id === null || item.id === undefined) await walk(path);
        else files.push(path);
      }
      if (!items || items.length < 1000) break;
    }
  };
  try {
    await walk(user.id);
    for (let i = 0; i < files.length; i += 100) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
      if (removeError) throw removeError;
    }
  } catch (e) {
    return json({ error: `Could not delete photos: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }

  // 2) The account. Rows that belong to it are removed by ON DELETE CASCADE.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);
  return json({ deleted: true, photos: files.length });
});
