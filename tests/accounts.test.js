const test = require('node:test');
const assert = require('node:assert/strict');
process.env.STUDENT_PIN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const createAccountHandler = require('../api/accounts/create').createHandler;
const createStudentLoginHandler = require('../api/auth/student').createHandler;
const { hashPin, verifyPin, encryptPin, decryptPin, generatePin, documentKey } = require('../api/_lib/studentPin');
function pathGet(root, path) { return path.split('/').filter(Boolean).reduce((v, k) => v == null ? undefined : v[k], root); }
function pathSet(root, path, value) { const parts = path.split('/').filter(Boolean); let node = root; for (const key of parts.slice(0, -1)) node = node[key] ||= {}; if (parts.length) node[parts.at(-1)] = value; }
function makeDb(data) {
  let seq = 0;
  return { ref(path = '') { return {
    once: async () => ({ val: () => pathGet(data, path) ?? null }),
    push: () => ({ key: `push${++seq}` }),
    set: async value => { pathSet(data, path, value); },
    update: async updates => { for (const [p, v] of Object.entries(updates)) pathSet(data, p, v); },
    remove: async () => { const parts = path.split('/'); const key = parts.pop(); const parent = pathGet(data, parts.join('/')); if (parent) delete parent[key]; },
    transaction: async fn => { const current = pathGet(data, path) ?? null; const next = fn(current); if (next === undefined) return { committed: false, snapshot: { val: () => current } }; pathSet(data, path, next); return { committed: true, snapshot: { val: () => next } }; }
  }; } };
}
function response() { let status = 200, payload; return { res: { status(n) { status = n; return this; }, json(x) { payload = x; return this; } }, result: () => ({ status, payload }) }; }
function setup() {
  const data = { institutions: { school: { profile: { name: 'Colegio', status: 'active', activeAcademicYearId: '2027', academicYear: '2027' } } }, academicYears: { school: { 2027: { profile: { status: 'active' }, groups: { '6A': { profile: { name: 'Sexto A', status: 'active' }, teacher: { uid: 'teacher1', status: 'active' } } } } } } };
  const db = makeDb(data), users = new Map(); let n = 0;
  const auth = {
    async getUserByEmail(email) { const u = [...users.values()].find(x => x.email === email); if (!u) { const e = new Error('not found'); e.code = 'auth/user-not-found'; throw e; } return u; },
    async createUser(input) { const user = { uid: `uid${++n}`, ...input }; users.set(user.uid, user); return user; },
    async deleteUser(uid) { users.delete(uid); },
    async updateUser(uid, patch) { const user = users.get(uid); if (!user) throw new Error('missing user'); Object.assign(user, patch); return user; },
    async createCustomToken(uid, claims) { return `custom:${uid}:${claims.role}`; }
  };
  const app = { database: () => db, auth: () => auth };
  const admin = async () => ({ user: { uid: 'global-admin' } });
  return { data, users, app, db, auth, admin };
}
async function call(handler, req) { const r = response(); await handler(req, r.res); return r.result(); }
test('PIN se almacena como hash y como copia cifrada autenticada, nunca en texto visible', () => {
  const record = hashPin('4826'), encrypted = encryptPin('4826');
  assert.equal(verifyPin('4826', record), true); assert.equal(verifyPin('0000', record), false);
  assert.equal(record.hash.includes('4826'), false); assert.equal(decryptPin(encrypted), '4826');
  assert.equal(decryptPin({ ...encrypted, ciphertext: Buffer.from('9999').toString('base64') }), null);
  assert.equal(documentKey('123456'), documentKey('123 456'));
});
test('genera PIN aleatorio de cuatro dígitos, incluidos ceros iniciales', () => {
  for (let i = 0; i < 500; i++) assert.match(generatePin(), /^\d{4}$/);
});
test('administrador crea docente con correo como usuario y documento como contraseña inicial', async () => {
  const f = setup(); const handler = createAccountHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const r = await call(handler, { method: 'POST', headers: {}, body: { role: 'teacher', institutionId: 'school', academicYearId: '2027', displayName: 'Ana Docente', email: 'ana@colegio.edu', documentId: '12345678' } });
  assert.equal(r.status, 201); assert.equal(r.payload.username, 'ana@colegio.edu'); assert.equal(r.payload.initialPassword, '12345678');
  const profile = f.data.users[r.payload.uid].profile; assert.equal(profile.mustChangePassword, true); assert.equal(profile.documentId, '12345678');
});
test('administrador crea estudiante con PIN generado automáticamente y lo matricula en el grupo', async () => {
  const f = setup(); const handler = createAccountHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const r = await call(handler, { method: 'POST', headers: {}, body: { role: 'student', institutionId: 'school', academicYearId: '2027', displayName: 'Luis Estudiante', documentId: '87654321', groupId: '6A' } });
  assert.equal(r.status, 201); assert.equal(r.payload.username, '87654321'); assert.match(r.payload.initialPin, /^\d{4}$/);
  const profile = f.data.users[r.payload.uid].profile; assert.equal(profile.pin, undefined);
  assert.equal(verifyPin(r.payload.initialPin, f.data.studentSecrets[r.payload.uid].pin), true);
  assert.equal(decryptPin(f.data.studentSecrets[r.payload.uid].pinEncrypted), r.payload.initialPin);
  assert.equal(f.data.academicYears.school[2027].groups['6A'].enrollments[r.payload.uid].status, 'active');
});
test('no permite duplicar documentos y genera PIN nuevo sin recibirlo del navegador', async () => {
  const f = setup(); const handler = createAccountHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const base = { role: 'student', institutionId: 'school', academicYearId: '2027', displayName: 'Estudiante', documentId: '87654321' };
  const first = await call(handler, { method: 'POST', headers: {}, body: base });
  assert.equal(first.status, 201);
  assert.equal((await call(handler, { method: 'POST', headers: {}, body: base })).status, 409);
});
test('estudiante ingresa con documento y PIN solo si está matriculado en el año activo', async () => {
  const f = setup(); const uid = 'student1', doc = '11223344', key = documentKey(doc);
  f.data.identityIndex = { [key]: { uid, institutionId: 'school', role: 'student', status: 'active' } };
  f.data.users = { [uid]: { profile: { role: 'student', status: 'active' } } }; f.data.studentSecrets = { [uid]: { pin: hashPin('4826') } };
  f.data.memberships = { [uid]: { school: { role: 'student', status: 'active' } } };
  f.data.academicYears.school[2027].groups['6A'].enrollments = { [uid]: { status: 'active' } };
  const handler = createStudentLoginHandler({ getAdminFn: () => f.app });
  let r = await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '4826' } });
  assert.equal(r.status, 200); assert.equal(r.payload.customToken, 'custom:student1:student');
  f.data.academicYears.school[2027].profile.status = 'closed';
  r = await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '4826' } });
  assert.equal(r.status, 403); assert.equal(r.payload.code, 'ACADEMIC_YEAR_CLOSED');
});
test('restablece el PIN generando uno nuevo y limpia el bloqueo temporal', async () => {
  const { data, app, admin } = setup(); const uid = 'studentReset', doc = '22334455', key = documentKey(doc);
  data.users = { [uid]: { profile: { role: 'student', status: 'active', displayName: 'Estudiante', documentId: doc } } };
  data.memberships = { [uid]: { school: { role: 'student', status: 'active' } } };
  data.studentSecrets = { [uid]: { pin: hashPin('1111'), pinEncrypted: encryptPin('1111') } };
  data.security = { studentLoginAttempts: { [key]: { count: 5, lockedUntil: Date.now() + 300000 } } };
  const handler = require('../api/accounts/reset-pin').createHandler({ getAdminFn: () => app, requireGlobalAdminFn: admin });
  const r = await call(handler, { method: 'POST', headers: {}, body: { institutionId: 'school', studentUid: uid } });
  assert.equal(r.status, 200); assert.match(r.payload.initialPin, /^\d{4}$/);
  assert.equal(verifyPin(r.payload.initialPin, data.studentSecrets[uid].pin), true);
  assert.equal(decryptPin(data.studentSecrets[uid].pinEncrypted), r.payload.initialPin);
  assert.equal(data.security.studentLoginAttempts[key], null);
});
test('bloquea al quinto intento incorrecto durante cinco minutos y permite reintentar al vencer', async () => {
  const f = setup(), doc = '33445566'; let clock = 1000000;
  const handler = createStudentLoginHandler({ getAdminFn: () => f.app, now: () => clock });
  for (let i = 0; i < 4; i++) assert.equal((await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '0000' } })).status, 401);
  const fifth = await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '0000' } });
  assert.equal(fifth.status, 429); assert.equal(fifth.payload.code, 'LOGIN_TEMPORARILY_LOCKED');
  const blocked = await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '0000' } }); assert.equal(blocked.status, 429);
  clock += 5 * 60 * 1000 + 1;
  const after = await call(handler, { method: 'POST', headers: {}, body: { documentId: doc, pin: '0000' } }); assert.equal(after.status, 401);
});

test('el administrador puede consultar credenciales cifradas de estudiantes matriculados por año', async () => {
  const f = setup(), uid = 'studentCredentials';
  f.data.users = { [uid]: { profile: { role: 'student', status: 'active', displayName: 'María Pérez', documentId: '55667788' } } };
  f.data.studentSecrets = { [uid]: { pin: hashPin('0427'), pinEncrypted: encryptPin('0427') } };
  f.data.academicYears.school[2027].groups['6A'].enrollments = { [uid]: { status: 'active' } };
  const handler = require('../api/accounts/credentials').createHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const r = await call(handler, { method: 'GET', query: { institutionId: 'school', academicYearId: '2027' }, headers: {} });
  assert.equal(r.status, 200); assert.equal(r.payload.students.length, 1);
  assert.equal(r.payload.students[0].username, '55667788'); assert.equal(r.payload.students[0].secret, '0427');
  assert.deepEqual(r.payload.students[0].groups, ['Sexto A']);
});
test('restablece contraseña docente al documento y exige cambiarla otra vez', async () => {
  const f = setup(), uid = 'teacherReset';
  f.data.users = { [uid]: { profile: { role: 'teacher', status: 'active', documentId: '99887766', email: 'profe@colegio.edu', displayName: 'Docente' } } };
  f.data.memberships = { [uid]: { school: { role: 'teacher', status: 'active' } } };
  f.users.set(uid, { uid, email: 'profe@colegio.edu', password: 'old-password' });
  const handler = require('../api/accounts/reset-teacher-password').createHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const r = await call(handler, { method: 'POST', headers: {}, body: { institutionId: 'school', teacherUid: uid } });
  assert.equal(r.status, 200); assert.equal(r.payload.initialPassword, '99887766'); assert.equal(f.users.get(uid).password, '99887766'); assert.equal(f.data.users[uid].profile.mustChangePassword, true);
});
test('migra una cuenta estudiantil antigua al acceso con documento y PIN sin borrar su membresía', async () => {
  const f = setup(), uid = 'legacyStudent';
  f.data.users = { [uid]: { profile: { displayName: 'Estudiante antiguo', status: 'active', email: 'old@student.example' } } };
  f.data.memberships = { [uid]: { school: { role: 'student', status: 'active' } } };
  f.data.institutionMembers = { school: { [uid]: { uid, displayName: 'Estudiante antiguo', role: 'student', status: 'active' } } };
  f.users.set(uid, { uid, email: 'old@student.example', emailVerified: false });
  const handler = require('../api/accounts/migrate-student').createHandler({ getAdminFn: () => f.app, requireGlobalAdminFn: f.admin });
  const r = await call(handler, { method: 'POST', headers: {}, body: { institutionId: 'school', studentUid: uid, documentId: '44556677', pin: '6402' } });
  assert.equal(r.status, 200); assert.equal(r.payload.username, '44556677'); assert.match(r.payload.initialPin, /^\d{4}$/); assert.equal(f.users.get(uid).emailVerified, true);
  assert.equal(f.data.memberships[uid].school.status, 'active'); assert.equal(f.data.institutionMembers.school[uid].documentId, '44556677');
  assert.equal(verifyPin(r.payload.initialPin, f.data.studentSecrets[uid].pin), true); assert.equal(decryptPin(f.data.studentSecrets[uid].pinEncrypted), r.payload.initialPin);
});
