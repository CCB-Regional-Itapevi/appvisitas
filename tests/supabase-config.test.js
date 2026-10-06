const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getSupabaseConfig, supabaseHeaders } = require('../src/supabase-config');

const env = {
  SUPABASE_URL: 'https://new-test-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
  SUPABASE_SECRET_KEY: 'sb_secret_server_test_only'
};

test('server credentials require the correct public and secret key types', () => {
  assert.equal(getSupabaseConfig(env).url, env.SUPABASE_URL);
  assert.throws(() => getSupabaseConfig({}), /Configure SUPABASE_URL/);
  assert.throws(() => getSupabaseConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_SECRET_KEY }), /invalido|incorreto/);
  assert.throws(() => getSupabaseConfig({ ...env, SUPABASE_SECRET_KEY: env.SUPABASE_PUBLISHABLE_KEY }), /invalido|incorreto/);
  assert.throws(() => getSupabaseConfig({ ...env, SUPABASE_URL: 'http://example.com' }), /HTTPS/);
});

test('new keys use apikey without an invalid JWT Authorization header', () => {
  const headers = supabaseHeaders(env.SUPABASE_SECRET_KEY);
  assert.equal(headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(headers.Authorization, undefined);
  assert.equal(supabaseHeaders('legacy.jwt.key').Authorization, 'Bearer legacy.jwt.key');
});

function createHandler(emptyWrite = false) {
  const calls = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  const config = getSupabaseConfig(env);
  const context = {
    __dirname: path.join(__dirname, '../src'),
    require(id) {
      if (id === './supabase-config') return {
        loadEnvironment() {}, getSupabaseConfig: () => config, supabaseHeaders
      };
      return require(id);
    },
    process: { env: { VERCEL: '1', AUTH_REQUIRED: 'true', ENABLE_LOCAL_PERSISTENCE: 'false' } },
    module: { exports: {} },
    console: { log() {}, warn() {}, error() {} },
    Buffer,
    fetch: async (url, options = {}) => {
      const target = new URL(String(url));
      calls.push({ url: target, options });
      if (target.pathname === '/auth/v1/user') return {
        ok: true, status: 200, json: async () => ({ id: 'test-user', email: 'user@example.test' })
      };
      if (target.pathname === '/rest/v1/profiles') return {
        ok: true, status: 200, json: async () => [{ id: 'test-user', role_id: 1, comum: 'TEST COMMON' }]
      };
      if (options.method === 'POST' && target.pathname === '/rest/v1/visitas_lancamentos') {
        const rows = emptyWrite ? [] : [{ ...JSON.parse(options.body) }];
        return { ok: true, status: 201, json: async () => rows, text: async () => JSON.stringify(rows) };
      }
      return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
    }
  };
  vm.runInNewContext(source, context);
  return { handler: context.module.exports, calls };
}

async function request(handler, method, url, payload) {
  let status;
  let body;
  const req = {
    method, url, headers: { host: 'localhost', authorization: 'Bearer test-user-jwt' },
    async *[Symbol.asyncIterator]() { if (payload) yield Buffer.from(JSON.stringify(payload)); }
  };
  await handler(req, { writeHead(code) { status = code; }, end(value) { body = value; } });
  return { status, body: JSON.parse(body) };
}

test('public config endpoint exposes only the public connection and keeps the secret on the server', async () => {
  const { handler, calls } = createHandler();
  const result = await request(handler, 'GET', '/api/config');
  assert.equal(result.status, 200);
  assert.equal(result.body.url, env.SUPABASE_URL);
  assert.equal(result.body.anonKey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(JSON.stringify(result.body).includes(env.SUPABASE_SECRET_KEY), false);
  assert.equal(calls.length, 0);
});

test('activity or visits submission targets the matrix tables on the new project', async () => {
  const { handler, calls } = createHandler();
  const isEbi = path.basename(path.resolve(__dirname, '..')) === 'APP_EBI';
  const payload = isEbi
    ? { data_reuniao: '2026-10-01', localidade: 'TEST COMMON' }
    : { comum: 'TEST COMMON', referencia_mes: 10, referencia_ano: 2026, categorias: ['gvi'], gvi: 1 };
  const result = await request(handler, 'POST', isEbi ? '/api/atividades' : '/api/visitas', payload);
  assert.equal(result.status, 201);
  const writes = calls.filter(call => call.options.method === 'POST');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url.origin, env.SUPABASE_URL);
  assert.equal(writes[0].url.pathname, isEbi ? '/rest/v1/ebi_atividades' : '/rest/v1/visitas_lancamentos');
  assert.equal(writes[0].options.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(writes[0].options.headers.Authorization, undefined);
  assert.equal(calls.every(call => call.url.origin === env.SUPABASE_URL), true);
  const auth = calls.find(call => call.url.pathname === '/auth/v1/user');
  assert.equal(auth.options.headers.Authorization, 'Bearer test-user-jwt');
  assert.equal(auth.options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
});

test('server source contains no old-project fallback or embedded legacy JWT', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  assert.equal(source.includes('sqamxlhfazulrisiptud'), false);
  assert.equal(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(source), false);
  new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(path.join(__dirname, '../src/server.js')));
  assert.equal(/[\u00c3\u00c2\ufffd]/.test(source), false);
});


test('obsolete child and monitor registration routes do not call Supabase or webhooks', async () => {
  const { handler, calls } = createHandler();
  for (const route of ['/api/cadastros/crianca', '/api/cadastros/monitor']) {
    const result = await request(handler, 'POST', route, { nome_crianca: 'TEST', nome_completo: 'TEST' });
    assert.equal(result.status, 404);
  }
  assert.equal(calls.length, 0);
  const source = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  assert.equal(/forwardToWebhook|WEBHOOK_(?:CRIANCA|MONITOR|CADASTRO)/.test(source), false);
});

test('visits rejects empty successful database responses', async () => {
  const {handler}=createHandler(true);
  const result=await request(handler,'POST','/api/visitas',{comum:'TEST COMMON',referencia_mes:10,referencia_ano:2026,gvi:1,categorias:['gvi']});
  assert.equal(result.status,502);
  assert.equal(result.body.code,'write_not_confirmed');
});
test('first visits submission has persisted ID and calculated totals',async()=>{
 const {handler}=createHandler();
 const result=await request(handler,'POST','/api/visitas',{comum:'TEST COMMON',referencia_mes:10,referencia_ano:2026,gvi:2,gvm:3,categorias:['gvi','gvm']});
 assert.equal(result.status,201);assert.ok(result.body.id);assert.equal(result.body.data.total_visitas,5);assert.equal(result.body.data.total,5);
});
