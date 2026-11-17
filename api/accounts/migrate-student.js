const getAdmin = () => require('../_lib/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../_lib/accessControl');
const { hashPin, encryptPin, generatePin, documentKey } = require('../_lib/studentPin');
function createHandler({ getAdminFn = getAdmin, requireGlobalAdminFn = requireGlobalAdmin } = {}) {
  return async function (req, res) {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    let claimed = false, path = null;
    try {
      const app = getAdminFn(), { user: actor } = await requireGlobalAdminFn(req, app), db = app.database();
      const { institutionId, studentUid, documentId } = req.body || {};
      const id = String(institutionId || '').trim(), uid = String(studentUid || '').trim(), doc = String(documentId || '').replace(/\s/g, '');
      if (!id || !uid || !/^\d{5,15}$/.test(doc)) throw httpError(400, 'INVALID_MIGRATION_DATA', 'Revisa el estudiante y el documento de identidad.');
      const [membership, profile] = await Promise.all([db.ref(`memberships/${uid}/${id}`).once('value'), db.ref(`users/${uid}/profile`).once('value')]).then(xs => xs.map(x => x.val()));
      if (!membership || membership.status !== 'active' || membership.role !== 'student' || !profile || profile.role && profile.role !== 'student' || profile.status === 'inactive') throw httpError(404, 'STUDENT_NOT_FOUND', 'No se encontró una cuenta de estudiante activa en esta institución.');
      const key = documentKey(doc); path = `identityIndex/${key}`;
      const existingIndex = (await db.ref(path).once('value')).val();
      if (existingIndex && existingIndex.uid !== uid) throw httpError(409, 'DOCUMENT_EXISTS', 'Ese documento ya está asociado a otra cuenta.');
      if (!existingIndex) {
        const claim = await db.ref(path).transaction(current => current ? undefined : { status: 'creating', createdAt: Date.now(), uid }, undefined, false);
        if (!claim.committed) throw httpError(409, 'DOCUMENT_EXISTS', 'Ese documento ya está asociado a otra cuenta.');
        claimed = true;
      }
      const pin = generatePin();
      await app.auth().updateUser(uid, { emailVerified: true });
      const now = Date.now(), updates = {
        [`users/${uid}/profile/role`]: 'student',
        [`users/${uid}/profile/status`]: 'active',
        [`users/${uid}/profile/documentId`]: doc,
        [`users/${uid}/profile/username`]: doc,
        [`users/${uid}/profile/migratedToPinAt`]: now,
        [`studentSecrets/${uid}/pin`]: hashPin(pin),
        [`studentSecrets/${uid}/pinEncrypted`]: encryptPin(pin),
        [`security/studentLoginAttempts/${key}`]: null,
        [`memberships/${uid}/${id}/role`]: 'student',
        [`institutionMembers/${id}/${uid}/documentId`]: doc,
        [`institutionMembers/${id}/${uid}/role`]: 'student',
        [`identityIndex/${key}`]: { uid, institutionId: id, role: 'student', status: 'active', createdAt: now, migrated: true },
        [`auditLogs/${db.ref('auditLogs').push().key}`]: { actorUid: actor.uid, action: 'account.student.migrated_to_pin', institutionId: id, createdAt: now, details: { studentUid: uid } }
      };
      await db.ref().update(updates); claimed = false;
      return res.status(200).json({ ok: true, uid, displayName: profile.displayName || 'Estudiante', username: doc, initialPin: pin, migrated: true });
    } catch (error) {
      if (claimed && path) { try { await getAdminFn().database().ref(path).remove(); } catch (_) {} }
      console.error('[accounts/migrate-student]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'STUDENT_MIGRATION_FAILED', message: error.status ? error.message : 'No fue posible migrar la cuenta de estudiante.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
