/**
 * deploy-edge-mobile-config.mjs — one-shot deployer for the
 * `admin-mobile-config` edge function. Uses the Supabase Management API
 * directly so no Supabase CLI install is needed.
 *
 * Usage:
 *   1. Get your personal access token at
 *      https://supabase.com/dashboard/account/tokens
 *   2. Set SUPABASE_ACCESS_TOKEN env var
 *   3. node deploy-edge-mobile-config.mjs
 *
 * Why this exists alongside `.ps1`:
 *   The PowerShell version requires `npm i -g supabase`; this one needs
 *   only Node which is already installed for `vite`. Pick whichever is
 *   easier — both produce an identical deployment.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'qvbskdjvnpjjmtufvnly';
const FUNCTION_NAME = 'admin-mobile-config';
const SRC_DIR = resolve(__dirname, 'supabase/functions', FUNCTION_NAME);

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error('❌ Set SUPABASE_ACCESS_TOKEN — see https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const files = ['index.ts', 'handlers.ts', 'validators.ts'].map((name) => ({
  name,
  content: readFileSync(resolve(SRC_DIR, name), 'utf8'),
}));

console.log(`📦 Bundling ${files.length} files (${files.reduce((s, f) => s + f.content.length, 0)} chars total)…`);

// Supabase Edge Function Management API — multipart upload via JSON body.
// docs: https://api.supabase.com/api/v1#tag/edge-functions
const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`;

const body = new FormData();
body.append('metadata', JSON.stringify({
  name: FUNCTION_NAME,
  verify_jwt: false, // X-Admin-Token auth, matches v12 contract
  entrypoint_path: 'index.ts',
}));
for (const f of files) {
  body.append('file', new Blob([f.content], { type: 'application/typescript' }), f.name);
}

console.log(`🚀 Deploying to ${url}…`);

const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  body,
});

const text = await res.text();
if (!res.ok) {
  console.error(`❌ Deploy failed (HTTP ${res.status}):\n${text}`);
  process.exit(1);
}

console.log(`✅ Deploy OK\n${text}`);
