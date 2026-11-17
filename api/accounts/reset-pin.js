const getAdmin = () => require('../_lib/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../_lib/accessControl');
const { hashPin, encryptPin, generatePin } = require('../_lib/studentPin');
function createHandler({ getAdminFn = getAdmin, requireGlobalAdminFn = requireGlobalAdmin } = {}) {
  return async function (req, res) {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    try {
      const app = getAdminFn(), { user: actor } = await requireGlobalAdminFn(req, app), db = app.database();
      const { institutionId, studentUid } = req.body || {};
      const id = String(institutionId || '').trim(), uid = String(studentUid || '').trim();
      if (!id || !uid) throw httpError(400, 'INVALID_RESET_DATA', 'Selecciona un estudiante.');
      const membership = (await db.ref(`memberships/${uid}/${id}`).once('value')).val();
      const profile = (await db.ref(`users/${uid}/profile`).once('value')).val();
      if (!membership || membership.status !== 'active' || membership.role !== 'student' || !profile || profile.role !== 'student' || profile.status !== 'active') throw httpError(404, 'STUDENT_NOT_FOUND', 'No se encontró un estudiante activo en esta institución.');
      const pin = generatePin();
      const updates = {
        [`studentSecrets/${uid}/pin`]: hashPin(pin),
        [`studentSecrets/${uid}/pinEncrypted`]: encryptPin(pin),
        [`security/studentLoginAttempts/${require('../_lib/studentPin').documentKey(profile.documentId)}`]: null,
        [`auditLogs/${db.ref('auditLogs').push().key}`]: { actorUid: actor.uid, action: 'account.student.pin_reset', institutionId: id, createdAt: Date.now(), details: { studentUid: uid } }
      };
      await db.ref().update(updates);
      return res.status(200).json({ ok: true, uid, username: profile.documentId, initialPin: pin, displayName: profile.displayName });
    } catch (error) {
      console.error('[accounts/reset-pin]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'PIN_RESET_FAILED', message: error.status ? error.message : 'No fue posible restablecer el PIN.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
