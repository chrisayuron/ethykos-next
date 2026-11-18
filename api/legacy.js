module.exports=function(req,res){
  if(req.method!=='POST') return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const action=String(req.query?.action||'');
  if(action==='students-create') return res.status(410).json({
    code:'LEGACY_STUDENT_CREATION_DISABLED',
    message:'La creación de estudiantes ahora se realiza desde el panel institucional con documento de identidad y PIN de cuatro dígitos.'
  });
  if(action==='invitations-create') return res.status(410).json({
    code:'EMAIL_INVITATIONS_DISABLED',
    message:'Las invitaciones automáticas por correo fueron reemplazadas por la creación de cuentas y la entrega manual de credenciales desde el panel institucional.'
  });
  return res.status(404).json({code:'LEGACY_ACTION_NOT_FOUND'});
};
