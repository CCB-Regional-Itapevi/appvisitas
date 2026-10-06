const fs = require('node:fs');
const path = require('node:path');

function loadEnvironment(rootDir) {
  // Deployment variables win; .env.local wins over .env on the local computer.
  for (const name of ['.env.local', '.env']) {
    const file = path.join(rootDir, name);
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

function validateKey(key, expectedRole, url) {
  if (expectedRole === 'anon' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  if (expectedRole === 'service_role' && /^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return;
  let payload;
  try {
    if (key.split('.').length !== 3) throw new Error();
    payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Tipo de chave Supabase invalido. Confira os campos publico e secreto.');
  }
  if (payload.role !== expectedRole) throw new Error('A chave Supabase foi colocada no campo incorreto.');
  if (payload.ref && url.hostname.endsWith('.supabase.co') && payload.ref !== url.hostname.split('.')[0]) {
    throw new Error('A chave Supabase pertence a outro projeto.');
  }
}

function getSupabaseConfig(env = process.env) {
  const rawUrl = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  const secretKey = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!rawUrl || !publishableKey || !secretKey) {
    throw new Error('Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY no ambiente do servidor.');
  }
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('SUPABASE_URL deve ser a URL HTTPS do projeto.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_URL deve ser a URL HTTPS do projeto, sem credenciais ou caminhos.');
  }
  validateKey(publishableKey, 'anon', url);
  validateKey(secretKey, 'service_role', url);
  return Object.freeze({ url: url.origin, publishableKey, secretKey });
}

function supabaseHeaders(key) {
  // New API keys are not JWTs. User access tokens still use Authorization: Bearer.
  if (key.startsWith('sb_secret_') || key.startsWith('sb_publishable_')) return { apikey: key };
  return { apikey: key, Authorization: `Bearer ${key}` };
}

module.exports = { loadEnvironment, getSupabaseConfig, supabaseHeaders };
