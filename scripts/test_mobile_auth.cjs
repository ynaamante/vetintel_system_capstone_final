const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../admin/node_modules/typescript');

function load(file, imports, globals = {}) {
  if (file.endsWith('/services/api.ts')) imports = {
    'react-native': { Platform: { OS: 'web' }, NativeModules: {} },
    './apiBaseUrl': load('petwatch-rn/src/services/apiBaseUrl.ts', {}),
    ...imports,
  };
  const source = fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => imports[name], process: { env: {} },
    AbortController, setTimeout, clearTimeout, TypeError, URL, console: { error() {} }, ...globals });
  return exports;
}

async function registrationScenario({ registerError, accepted = true } = {}) {
  const calls = [], loading = [], notices = [], navigation = [];
  const states = ['Test Owner', ' OWNER@example.test ', '', 'test-password-123', 'test-password-123', accepted, false, '', null];
  let index = 0;
  const react = { createElement: (type, props, ...children) => ({ type, props, children }),
    useState: () => { const i = index++; return [states[i], value => { if (i === 6) loading.push(value); if (i === 7) notices.push(value); }]; } };
  const module = load('petwatch-rn/src/screens/RegisterScreen.tsx', {
    react,
    'react-native': { StyleSheet: { create: value => value }, Platform: { OS: 'web' }, TouchableOpacity: 'button' },
    'react-native-safe-area-context': {}, '@expo/vector-icons': {},
    'expo-linear-gradient': {},
    'react-native-toast-message': { show: value => notices.push(value) },
    '../services/api': { authApi: { register: async (...args) => { calls.push(['register', ...args]); if (registerError) throw registerError; return { email: 'owner@example.test', verification_required: true, email_sent: true, retry_after: 60 }; } } },
    '../context/ThemeContext': { useTheme: () => ({ colors: {}, isDark: false }) },
    '../theme/colors': { colors: { dark: {} }, spacing: {}, radius: {} },
  });
  const tree = module.default({ navigation: { navigate: route => navigation.push(route) } });
  const find = node => node && typeof node === 'object' && (node.props?.onPress?.name === 'handleRegister'
    ? node.props.onPress : node.children?.map(find).find(Boolean));
  await find(tree)();
  assert.deepEqual(loading, accepted ? [true, false] : [], 'The spinner always stops.');
  return { calls, notices, navigation };
}

(async () => {
  const { resolveApiUrl } = load('petwatch-rn/src/services/apiBaseUrl.ts', {} , { URL });
  assert.equal(resolveApiUrl({ platform: 'android', scriptUrl: 'http://192.168.1.13:8081/index.bundle' }), 'http://192.168.1.13:3000/api');
  assert.equal(resolveApiUrl({ platform: 'android', scriptUrl: 'http://localhost:8081/index.bundle' }), 'http://10.0.2.2:3000/api');
  assert.equal(resolveApiUrl({ platform: 'web', webHostname: 'localhost' }), 'http://localhost:3000/api');
  assert.equal(resolveApiUrl({ platform: 'android', configuredUrl: 'http://localhost:3000/api', scriptUrl: 'http://192.168.1.13:8081/index.bundle' }), 'http://192.168.1.13:3000/api');
  assert.equal(resolveApiUrl({ platform: 'android', configuredUrl: 'https://backend.example.test/api/' }), 'https://backend.example.test/api');
  assert.throws(() => resolveApiUrl({ platform: 'android', scriptUrl: 'https://metro.exp.direct/index.bundle' }), /EXPO_PUBLIC_API_URL/);
  let phoneAddress;
  const phoneApi = load('petwatch-rn/src/services/api.ts', {
    'react-native': { Platform: { OS: 'android' }, NativeModules: { SourceCode: { scriptURL: 'http://192.168.1.13:8081/index.bundle' } } },
  }, { fetch: async url => { phoneAddress = url; return Response.json({}); } });
  await phoneApi.authApi.register('Owner', 'owner@example.test', 'password123', { accepted_terms: true });
  assert.equal(phoneAddress, 'http://192.168.1.13:3000/api/register', 'Android registration reaches the computer, not the phone’s localhost.');
  const requests = [];
  let response = { token: 'session', id: 7, name: 'Test Owner', email: 'owner@example.test', role: 'user' };
  const api = load('petwatch-rn/src/services/api.ts', {}, { fetch: async (url, options) => {
    requests.push({ url, options }); return Response.json(response);
  } });
  const signedIn = await api.authApi.login(' OWNER@example.test ', 'test-password-123');
  assert.equal(signedIn.user.id, 7, 'Flat backend responses are accepted.');
  assert.equal(signedIn.token, 'session');
  assert.equal(JSON.parse(requests[0].options.body).email, 'owner@example.test');
  await api.authApi.register(' Test Owner ', ' OWNER@example.test ', 'test-password-123');
  assert.ok(requests[1].url.endsWith('/api/register'));
  assert.equal(JSON.parse(requests[1].options.body).password, 'test-password-123');
  response = { token: 'session', user: { id: 7, email: 'owner@example.test' } };
  assert.equal((await api.authApi.login('owner@example.test', 'password')).user.id, 7);
  response = {};
  await assert.rejects(api.authApi.login('owner@example.test', 'password'), /Invalid login response/);
  const slow = load('petwatch-rn/src/services/api.ts', {}, { fetch: (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }) });
  await assert.rejects(slow.apiCall('/login', { timeoutMs: 5 }), /too long/);
  const offline = load('petwatch-rn/src/services/api.ts', {}, { fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(offline.authApi.login('owner@example.test', 'password'), /Cannot connect/);
  const duplicate = load('petwatch-rn/src/services/api.ts', {}, { fetch: async () => Response.json({ error: 'email already exists' }, { status: 409 }) });
  await assert.rejects(duplicate.authApi.register('Owner', 'owner@example.test', 'password'), /email already exists/);
  const invalidSession = load('petwatch-rn/src/services/api.ts', {}, { fetch: async () => Response.json({ error: 'Please sign in again.', code: 'SESSION_INVALID' }, { status: 401 }) });
  const invalidTokens = [];
  const unsubscribe = invalidSession.onInvalidSession(token => invalidTokens.push(token));
  await assert.rejects(invalidSession.apiCall('/owner/pets', { token: 'expired-test-session' }), /sign in again/);
  assert.deepEqual(invalidTokens, ['expired-test-session']);
  unsubscribe();
  const permissionDenied = load('petwatch-rn/src/services/api.ts', {}, { fetch: async () => Response.json({ error: 'Pet-owner account required.' }, { status: 403 }) });
  permissionDenied.onInvalidSession(() => { throw new Error('Role permissions must not invalidate a session.'); });
  await assert.rejects(permissionDenied.apiCall('/owner/pets', { token: 'valid-test-session' }), /Pet-owner account required/);
  const legacyForbidden = load('petwatch-rn/src/services/api.ts', {}, { fetch: async () => Response.json({ error: 'Forbidden' }, { status: 403 }) });
  let legacyInvalidated = false;
  legacyForbidden.onInvalidSession(() => { legacyInvalidated = true; });
  await assert.rejects(legacyForbidden.apiCall('/owner/pets', { token: 'legacy-test-session' }), /Forbidden/);
  assert.equal(legacyInvalidated, true, 'Old backend Forbidden responses trigger sign-in recovery for owner endpoints.');
  const success = await registrationScenario();
  assert.deepEqual(success.calls.map(call => call[0]), ['register']);
  assert.equal(success.calls[0][3], 'test-password-123');
  assert.equal(success.calls[0][4].accepted_terms, true);
  assert.deepEqual(success.navigation, ['VerifyEmail'], 'Registration goes to verification without signing in.');
  const failed = await registrationScenario({ registerError: new Error('email already exists') });
  assert.equal(failed.calls.length, 1, 'Failed registration does not attempt sign-in.');
  assert.ok(failed.notices.includes('email already exists'));
  assert.equal((await registrationScenario({ accepted: false })).calls.length, 0, 'Consent is required.');
  console.log('PASS: pending registration, optional phone, consent, verification navigation, sign-in responses, duplicate emails, network errors, timeout, and spinner cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
