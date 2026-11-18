const crypto = require('node:crypto');
const getAdmin = () => require('../../lib/api/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../../lib/api/accessControl');
const { hashPin, encryptPin, generatePin, documentKey } = require('../../lib/api/studentPin');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE = /^[A-Za-z0-9_-]{2,80}$/;
function createHandler({ getAdminFn = getAdmin, requireGlobalAdminFn = requireGlobalAdmin } = {}) {
  return async function (req, res) {
    if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    let createdUid = null;
    let claimedDocument = false;
    let documentIndexPath = null;
    try {
      const app = getAdminFn();
      const { user: actor } = await requireGlobalAdminFn(req, app);
      const db = app.database();
      const auth = app.auth();
      const body = req.body || {};
      const role = String(body.role || '');
      const institutionId = String(body.institutionId || '').trim();
      const displayName = String(body.displayName || '').trim();
      const documentId = String(body.documentId || '').replace(/\s/g, '');
      const yearId = String(body.academicYearId || '').trim();
      const groupId = String(body.groupId || '').trim().toUpperCase();
      if (!institutionId || /[.#$\[\]/]/.test(institutionId) || !displayName || displayName.length > 120 || !/^\d{5,15}$/.test(documentId)) {
        throw httpError(400, 'INVALID_ACCOUNT_DATA', 'Revisa la institución, el nombre y el documento de identidad.');
      }
      if (!['teacher', 'student'].includes(role)) throw httpError(400, 'INVALID_ROLE', 'Solo se pueden crear cuentas de docentes o estudiantes.');
      const inst = (await db.ref(`institutions/${institutionId}/profile`).once('value')).val();
      if (!inst || inst.status !== 'active') throw httpError(404, 'INSTITUTION_NOT_FOUND', 'La institución no existe o no está activa.');
      const activeYear = String(inst.activeAcademicYearId || inst.academicYear || '');
      if (!activeYear || (yearId && yearId !== activeYear)) throw httpError(409, 'YEAR_NOT_ACTIVE', 'La institución no tiene el año lectivo seleccionado activo.');
      const yearProfile = (await db.ref(`academicYears/${institutionId}/${activeYear}/profile`).once('value')).val();
      if (yearProfile && yearProfile.status !== 'active') throw httpError(409, 'YEAR_NOT_ACTIVE', 'El año lectivo no está activo.');
      if (role === 'teacher' && (!EMAIL.test(String(body.email || '').trim()) || String(body.email).length > 254)) throw httpError(400, 'INVALID_EMAIL', 'Escribe un correo electrónico válido para el docente.');
      const studentPin = role === 'student' ? generatePin() : null;
      const encryptedStudentPin = role === 'student' ? encryptPin(studentPin) : null;
      if (groupId && !SAFE.test(groupId)) throw httpError(400, 'INVALID_GROUP', 'El grupo seleccionado no es válido.');
      if (groupId) {
        const group = (await db.ref(`academicYears/${institutionId}/${activeYear}/groups/${groupId}`).once('value')).val();
        if (!group || group.profile?.status !== 'active') throw httpError(404, 'GROUP_NOT_FOUND', 'El grupo no existe en el año lectivo activo.');
        if (role === 'student' && (!group.teacher || group.teacher.status !== 'active')) throw httpError(409, 'TEACHER_REQUIRED', 'Asigna primero el docente de Ética al grupo.');
      }
      const key = documentKey(documentId);
      const documentRef = db.ref(`identityIndex/${key}`);
      documentIndexPath = `identityIndex/${key}`;
      const claim = await documentRef.transaction(current => { const stamp = Date.now(); if (!current || (current.status === 'creating' && stamp - Number(current.createdAt || 0) > 10 * 60 * 1000)) return { status: 'creating', createdAt: stamp }; return undefined; }, undefined, false);
      if (!claim.committed) throw httpError(409, 'DOCUMENT_EXISTS', 'Ya existe una cuenta registrada con ese documento.');
      claimedDocument = true;
      let email, password, emailVerified = true;
      if (role === 'teacher') {
        if (documentId.length < 6) throw httpError(400, 'DOCUMENT_PASSWORD_TOO_SHORT', 'El documento del docente debe tener al menos seis dígitos para utilizarse como contraseña inicial de Firebase.');
        email = String(body.email).trim().toLowerCase();
        password = documentId;
      } else {
        email = `student-${key.slice(0, 32)}@students.ethykos.invalid`;
        password = crypto.randomBytes(36).toString('base64url');
      }
      try { await auth.getUserByEmail(email); throw httpError(409, 'EMAIL_EXISTS', 'Ese correo ya está asociado a una cuenta.'); }
      catch (error) { if (error.status) throw error; if (error.code !== 'auth/user-not-found') throw error; }
      const user = await auth.createUser({ email, password, displayName, emailVerified, disabled: false });
      createdUid = user.uid;
      const now = Date.now();
      const profile = {
        displayName, documentId, role, status: 'active', createdAt: now, createdBy: actor.uid,
        ...(role === 'teacher' ? { email, mustChangePassword: true } : { username: documentId, mustChangePassword: false })
      };
      const updates = {
        [`users/${user.uid}/profile`]: profile,
        ...(role === 'student' ? { [`studentSecrets/${user.uid}/pin`]: hashPin(studentPin), [`studentSecrets/${user.uid}/pinEncrypted`]: encryptedStudentPin } : {}),
        [`memberships/${user.uid}/${institutionId}`]: { role, status: 'active', createdAt: now, createdBy: actor.uid },
        [`institutionMembers/${institutionId}/${user.uid}`]: { uid: user.uid, displayName, documentId, ...(role === 'teacher' ? { email } : {}), role, status: 'active', createdAt: now },
        [`identityIndex/${key}`]: { uid: user.uid, institutionId, role, status: 'active', createdAt: now },
        [`auditLogs/${db.ref('auditLogs').push().key}`]: { actorUid: actor.uid, action: `account.${role}.created`, institutionId, createdAt: now, details: { uid: user.uid, groupId: groupId || null } }
      };
      if (groupId && role === 'student') updates[`academicYears/${institutionId}/${activeYear}/groups/${groupId}/enrollments/${user.uid}`] = { status: 'active', enrolledAt: now, enrolledBy: actor.uid };
      await db.ref().update(updates);
      claimedDocument = false;
      return res.status(201).json({ ok: true, uid: user.uid, role, displayName, username: role === 'teacher' ? email : documentId, initialPassword: role === 'teacher' ? documentId : undefined, initialPin: role === 'student' ? studentPin : undefined, groupId: groupId || null, mustChangePassword: role === 'teacher' });
    } catch (error) {
      if (createdUid) {
        try { await getAdminFn().auth().deleteUser(createdUid); } catch (_) {}
      }
      if (claimedDocument && documentIndexPath) {
        try { await getAdminFn().database().ref(documentIndexPath).remove(); } catch (_) {}
      }
      console.error('[accounts/create]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'ACCOUNT_CREATE_FAILED', message: error.status ? error.message : 'No fue posible crear la cuenta.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
