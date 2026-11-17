const getAdmin = () => require('../_lib/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../_lib/accessControl');
function createHandler({ getAdminFn = getAdmin, requireGlobalAdminFn = requireGlobalAdmin } = {}) {
  return async function (req, res) {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    try {
      const app = getAdminFn(), { user: actor } = await requireGlobalAdminFn(req, app), db = app.database(), auth = app.auth();
      const { institutionId, teacherUid } = req.body || {};
      const id = String(institutionId || '').trim(), uid = String(teacherUid || '').trim();
      if (!id || !uid) throw httpError(400, 'INVALID_RESET_DATA', 'Selecciona un docente.');
      const [membership, profile] = await Promise.all([db.ref(`memberships/${uid}/${id}`).once('value'), db.ref(`users/${uid}/profile`).once('value')]).then(xs => xs.map(x => x.val()));
      if (!membership || membership.status !== 'active' || membership.role !== 'teacher' || !profile || profile.role !== 'teacher' || profile.status !== 'active' || !/^\d{6,15}$/.test(String(profile.documentId || ''))) throw httpError(404, 'TEACHER_NOT_FOUND', 'No se encontró un docente activo con documento válido.');
      await auth.updateUser(uid, { password: String(profile.documentId) });
      await db.ref().update({
        [`users/${uid}/profile/mustChangePassword`]: true,
        [`auditLogs/${db.ref('auditLogs').push().key}`]: { actorUid: actor.uid, action: 'account.teacher.password_reset', institutionId: id, createdAt: Date.now(), details: { teacherUid: uid } }
      });
      return res.status(200).json({ ok: true, uid, username: profile.email, initialPassword: String(profile.documentId), displayName: profile.displayName });
    } catch (error) {
      console.error('[accounts/reset-teacher-password]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'PASSWORD_RESET_FAILED', message: error.status ? error.message : 'No fue posible restablecer la contraseña.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
