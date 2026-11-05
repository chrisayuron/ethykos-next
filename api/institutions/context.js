
const {
  requireVerifiedUser,
  listActiveInstitutionContexts
} = require('../_lib/accessControl');

const { getAdmin } = require('../_lib/firebaseAdmin');

module.exports = async function (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Método no permitido.'
    });
  }

  let stage = 'INITIALIZE_FIREBASE';

  try {
    const app = getAdmin();

    stage = 'VERIFY_USER';
    const user = await requireVerifiedUser(req, app);

    stage = 'LOAD_INSTITUTION_CONTEXTS';
    const institutions = await listActiveInstitutionContexts(
      user.uid,
      app
    );

    return res.status(200).json({
      uid: user.uid,
      email: user.email || null,
      institutions
    });

  } catch (error) {
    console.error('[Éthykos Next V4.15.1] institutions/context', {
      stage,
      code: error?.code || null,
      message: error?.message || 'UNKNOWN',
      stack: error?.stack || null
    });

    return res.status(error.status || 500).json({
      code: error.code || 'CONTEXT_LOAD_FAILED',
      message: error.status
        ? error.message
        : 'No fue posible consultar tus instituciones.'
    });
  }
};
