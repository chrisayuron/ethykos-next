module.exports = function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  return res.status(410).json({
    code: 'EMAIL_INVITATIONS_DISABLED',
    message: 'Las invitaciones automáticas por correo fueron reemplazadas por la creación de cuentas y la entrega manual de credenciales desde el panel institucional.'
  });
};
