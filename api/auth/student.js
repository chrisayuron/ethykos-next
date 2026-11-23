const getAdmin = () => require('../../lib/api/firebaseAdmin').getAdmin();
const { verifyPin, documentKey } = require('../../lib/api/studentPin');
const { httpError, institutionHasOpenYear } = require('../../lib/api/accessControl');
const LOCK_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

async function registerFailedAttempt(ref, now) {
  let lockedUntil = 0;
  const result = await ref.transaction(current => {
    const lockExpired = current && Number(current.lockedUntil || 0) > 0 && Number(current.lockedUntil) <= now;
    const record = current && !lockExpired && Number(current.windowStartedAt) && now - Number(current.windowStartedAt) < WINDOW_MS
      ? current
      : { windowStartedAt: now, count: 0, lockedUntil: 0 };
    if (Number(record.lockedUntil || 0) > now) {
      lockedUntil = Number(record.lockedUntil);
      return;
    }
    const count = Number(record.count || 0) + 1;
    lockedUntil = count >= LOCK_ATTEMPTS ? now + LOCK_MS : 0;
    return { windowStartedAt: record.windowStartedAt || now, count, lockedUntil, updatedAt: now };
  }, undefined, false);
  if (!result.committed && !lockedUntil) {
    const latest = result.snapshot?.val?.();
    lockedUntil = Number(latest?.lockedUntil || 0);
  }
  return { committed: result.committed, lockedUntil };
}

function createHandler({ getAdminFn = getAdmin, now = () => Date.now() } = {}) {
  return async function (req, res) {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    try {
      const { documentId, pin } = req.body || {};
      const doc = String(documentId || '').replace(/\s/g, '');
      const code = String(pin || '');
      if (!/^\d{5,15}$/.test(doc) || !/^\d{4}$/.test(code)) throw httpError(400, 'INVALID_CREDENTIALS', 'Documento o PIN incorrectos.');
      const app = getAdminFn(), db = app.database(), auth = app.auth();
      const key = documentKey(doc);
      const attemptRef = db.ref(`security/studentLoginAttempts/${key}`);
      const before = (await attemptRef.once('value')).val();
      const timestamp = now();
      if (Number(before?.lockedUntil || 0) > timestamp) {
        const remainingSeconds = Math.max(1, Math.ceil((Number(before.lockedUntil) - timestamp) / 1000));
        throw httpError(429, 'LOGIN_TEMPORARILY_LOCKED', `Acceso bloqueado temporalmente. Intenta nuevamente en ${Math.ceil(remainingSeconds / 60)} minuto(s).`);
      }

      const index = (await db.ref(`identityIndex/${key}`).once('value')).val();
      let profile = null, pinRecord = null, membership = null, institution = null;
      if (index && index.status === 'active' && index.role === 'student') {
        [profile, pinRecord, membership, institution] = await Promise.all([
          db.ref(`users/${index.uid}/profile`).once('value'),
          db.ref(`studentSecrets/${index.uid}/pin`).once('value'),
          db.ref(`memberships/${index.uid}/${index.institutionId}`).once('value'),
          db.ref(`institutions/${index.institutionId}/profile`).once('value')
        ]).then(xs => xs.map(x => x.val()));
      }

      const valid = !!(profile && profile.status === 'active' && profile.role === 'student' && verifyPin(code, pinRecord));
      if (!valid) {
        const failed = await registerFailedAttempt(attemptRef, timestamp);
        if (failed.lockedUntil > timestamp) throw httpError(429, 'LOGIN_TEMPORARILY_LOCKED', 'Has alcanzado cinco intentos incorrectos. El acceso queda bloqueado durante cinco minutos.');
        throw httpError(401, 'INVALID_CREDENTIALS', 'Documento o PIN incorrectos.');
      }

      await attemptRef.remove();
      if (!membership || membership.status !== 'active' || membership.role !== 'student' || !institution || institution.status !== 'active') throw httpError(403, 'STUDENT_ACCESS_INACTIVE', 'Tu acceso no está activo. Comunícate con la institución.');
      const yearId = String(institution.activeAcademicYearId || institution.academicYear || '').trim();
      if (!yearId) {
        console.error('[auth/student] academic check: missing active year id');
        throw httpError(403, 'ACADEMIC_YEAR_CLOSED', 'La institución no tiene un año lectivo activo.');
      }
      const year = (await db.ref(`academicYears/${index.institutionId}/${yearId}/profile`).once('value')).val();
      const yearOpen = await institutionHasOpenYear(index.institutionId, institution, app);
      if (!year || year.status !== 'active' || !yearOpen) {
        const colombiaParts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(timestamp));
        const today = colombiaParts.find(p=>p.type==='year').value+'-'+colombiaParts.find(p=>p.type==='month').value+'-'+colombiaParts.find(p=>p.type==='day').value;
        console.error('[auth/student] academic year rejected', { yearId, yearStatus:year?.status||null, startsAt:year?.startsAt||null, endsAt:year?.endsAt||null, today, yearOpen, institutionYearId:String(institution.activeAcademicYearId||institution.academicYear||'') });
        throw httpError(403, 'ACADEMIC_YEAR_CLOSED', 'El año lectivo está cerrado o fuera de sus fechas de vigencia.');
      }
      const groups = (await db.ref(`academicYears/${index.institutionId}/${yearId}/groups`).once('value')).val() || {};
      const enrolled = Object.values(groups).some(group => group?.enrollments?.[index.uid]?.status === 'active');
      if (!enrolled) {
        console.error('[auth/student] enrollment rejected', { yearId, groupCount:Object.keys(groups).length, activeEnrollment:false });
        throw httpError(403, 'STUDENT_NOT_ENROLLED', 'No tienes una matrícula activa para este año lectivo.');
      }
      const customToken = await auth.createCustomToken(index.uid, { role: 'student', institutionId: index.institutionId });
      return res.status(200).json({ ok: true, customToken, institutionId: index.institutionId });
    } catch (error) {
      if (error.status === 401) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Documento o PIN incorrectos.' });
      if (error.status === 429) return res.status(429).json({ code: error.code, message: error.message });
      console.error('[auth/student]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'STUDENT_LOGIN_FAILED', message: error.status ? error.message : 'No fue posible iniciar sesión.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.registerFailedAttempt = registerFailedAttempt;
