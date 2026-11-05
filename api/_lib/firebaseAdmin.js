
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

let app;
let adminServices;

function getAdmin() {
  if (adminServices) return adminServices;

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_DATABASE_URL
  } = process.env;

  if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY ||
    !FIREBASE_DATABASE_URL
  ) {
    throw new Error('SERVER_CONFIG_MISSING');
  }

  const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey
        }),
        databaseURL: FIREBASE_DATABASE_URL
      });

  adminServices = {
    auth: () => getAuth(app),
    database: () => getDatabase(app)
  };

  return adminServices;
}

async function requireAdmin(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    const e = new Error('UNAUTHORIZED');
    e.status = 401;
    throw e;
  }

  const decoded = await getAdmin().auth().verifyIdToken(header.slice(7));

  if (decoded.uid !== '8mheoQqcekSQkpK5S8qTonUWKt83') {
    const e = new Error('FORBIDDEN');
    e.status = 403;
    throw e;
  }

  return decoded;
}

module.exports = { getAdmin, requireAdmin };
