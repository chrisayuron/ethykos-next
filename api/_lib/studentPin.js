const crypto = require('node:crypto');
const KEYLEN = 64;
const ALGORITHM = 'aes-256-gcm';

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, KEYLEN).toString('hex');
  return { salt, hash, algorithm: 'scrypt' };
}

function verifyPin(pin, record) {
  if (!record || record.algorithm !== 'scrypt' || !record.salt || !record.hash) return false;
  try {
    const actual = crypto.scryptSync(String(pin), record.salt, KEYLEN);
    const expected = Buffer.from(record.hash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function encryptionKey(raw = process.env.STUDENT_PIN_ENCRYPTION_KEY) {
  if (!raw) {
    const error = new Error('Falta configurar STUDENT_PIN_ENCRYPTION_KEY.');
    error.code = 'PIN_ENCRYPTION_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  let key;
  try { key = Buffer.from(String(raw), 'base64'); } catch (_) { key = Buffer.alloc(0); }
  if (key.length !== 32) {
    const error = new Error('STUDENT_PIN_ENCRYPTION_KEY debe ser una clave Base64 de 32 bytes.');
    error.code = 'PIN_ENCRYPTION_KEY_INVALID';
    error.status = 503;
    throw error;
  }
  return key;
}

function encryptPin(pin, rawKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(rawKey), iv);
  const ciphertext = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1
  };
}

function decryptPin(record, rawKey) {
  if (!record || record.algorithm !== ALGORITHM || !record.iv || !record.ciphertext || !record.authTag) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(rawKey), Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch (_) {
    return null;
  }
}

function generatePin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function documentKey(documentId) {
  return crypto.createHash('sha256').update(String(documentId).replace(/\D/g, '')).digest('hex');
}

module.exports = { hashPin, verifyPin, encryptPin, decryptPin, generatePin, documentKey, encryptionKey };
