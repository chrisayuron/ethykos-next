const getAdmin = () => require('../_lib/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../_lib/accessControl');
const { decryptPin, encryptionKey } = require('../_lib/studentPin');

function createHandler({ getAdminFn = getAdmin, requireGlobalAdminFn = requireGlobalAdmin } = {}) {
  return async function (req, res) {
    if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    try {
      const app = getAdminFn();
      const { user: actor } = await requireGlobalAdminFn(req, app);
      const db = app.database();
      encryptionKey(); // Falla explícitamente si la clave no está configurada o no tiene 32 bytes.
      const institutionId = String(req.query?.institutionId || '').trim();
      const academicYearId = String(req.query?.academicYearId || '').trim();
      if (!institutionId || /[.#$\[\]/]/.test(institutionId) || !/^\d{4}$/.test(academicYearId)) throw httpError(400, 'INVALID_CREDENTIALS_QUERY', 'Selecciona una institución y un año lectivo válido.');
      const [institutionSnap, yearSnap, groupsSnap] = await Promise.all([
        db.ref(`institutions/${institutionId}/profile`).once('value'),
        db.ref(`academicYears/${institutionId}/${academicYearId}/profile`).once('value'),
        db.ref(`academicYears/${institutionId}/${academicYearId}/groups`).once('value')
      ]);
      const institution = institutionSnap.val(), year = yearSnap.val(), groups = groupsSnap.val() || {};
      if (!institution || institution.status !== 'active') throw httpError(404, 'INSTITUTION_NOT_FOUND', 'No se encontró la institución.');
      if (!year) throw httpError(404, 'YEAR_NOT_FOUND', 'No se encontró el año lectivo.');

      const studentGroups = new Map(), teacherGroups = new Map();
      for (const [groupId, group] of Object.entries(groups)) {
        if (group?.profile?.status !== 'active') continue;
        const teacherUid = group.teacher?.status === 'active' ? group.teacher.uid : null;
        if (teacherUid) {
          if (!teacherGroups.has(teacherUid)) teacherGroups.set(teacherUid, []);
          teacherGroups.get(teacherUid).push(group.profile.name || groupId);
        }
        for (const [uid, enrollment] of Object.entries(group.enrollments || {})) {
          if (enrollment?.status !== 'active') continue;
          if (!studentGroups.has(uid)) studentGroups.set(uid, []);
          studentGroups.get(uid).push(group.profile.name || groupId);
        }
      }

      const studentRows = await Promise.all([...studentGroups.entries()].map(async ([uid, groupNames]) => {
        const [profileSnap, secretSnap] = await Promise.all([
          db.ref(`users/${uid}/profile`).once('value'),
          db.ref(`studentSecrets/${uid}`).once('value')
        ]);
        const profile = profileSnap.val() || {}, secrets = secretSnap.val() || {};
        const pin = decryptPin(secrets.pinEncrypted);
        if (secrets.pinEncrypted && !pin) throw httpError(503, 'PIN_DECRYPTION_FAILED', 'No fue posible recuperar algunos PIN. Verifica que STUDENT_PIN_ENCRYPTION_KEY sea la misma que se utilizó al crearlos.');
        return {
          uid,
          role: 'Estudiante',
          name: profile.displayName || 'Estudiante',
          username: profile.documentId || '',
          secret: pin,
          secretLabel: pin ? 'PIN' : 'PIN no recuperable; restablecer',
          groups: groupNames,
          credentialAvailable: !!pin
        };
      }));

      const teacherRows = await Promise.all([...teacherGroups.entries()].map(async ([uid, groupNames]) => {
        const profile = (await db.ref(`users/${uid}/profile`).once('value')).val() || {};
        return {
          uid,
          role: 'Docente',
          name: profile.displayName || 'Docente',
          username: profile.email || '',
          secret: profile.mustChangePassword ? String(profile.documentId || '') : null,
          secretLabel: profile.mustChangePassword ? 'Contraseña inicial' : 'Contraseña personal ya establecida',
          groups: groupNames,
          credentialAvailable: !!profile.mustChangePassword
        };
      }));

      await db.ref(`auditLogs/${db.ref('auditLogs').push().key}`).set({
        actorUid: actor.uid,
        action: 'account.credentials.viewed',
        institutionId,
        createdAt: Date.now(),
        details: { academicYearId, students: studentRows.length, teachers: teacherRows.length }
      });

      return res.status(200).json({
        ok: true,
        institution: institution.name || 'Institución',
        academicYearId,
        yearStatus: year.status || 'unknown',
        students: studentRows.sort((a, b) => a.name.localeCompare(b.name, 'es')),
        teachers: teacherRows.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      });
    } catch (error) {
      console.error('[accounts/credentials]', error.code || error.message || 'UNKNOWN');
      return res.status(error.status || 500).json({ code: error.code || 'CREDENTIALS_LOAD_FAILED', message: error.status ? error.message : 'No fue posible consultar las credenciales.' });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
