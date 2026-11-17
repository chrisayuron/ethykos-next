module.exports = function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  return res.status(410).json({
    code: 'LEGACY_STUDENT_CREATION_DISABLED',
    message: 'La creación de estudiantes ahora se realiza desde el panel institucional con documento de identidad y PIN de cuatro dígitos.'
  });
};
