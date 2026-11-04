const {requireAdmin}=require('../_lib/firebaseAdmin');
const {Resend}=require('resend');
const {testEmail}=require('../_lib/emailTemplates');

const TEST_RECIPIENT='rrnewball@gmail.com';
const DEFAULT_FROM='Éthykos Next <onboarding@resend.dev>';

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({code:'METHOD_NOT_ALLOWED',message:'Método no permitido.'});
  try{
    await requireAdmin(req);
    const apiKey=process.env.RESEND_API_KEY;
    if(!apiKey) return res.status(500).json({code:'RESEND_NOT_CONFIGURED',message:'El servicio de correo no está configurado.'});

    const resend=new Resend(apiKey);
    const from=process.env.RESEND_FROM_EMAIL||DEFAULT_FROM;
    const sent=await resend.emails.send({
      from,
      to:[TEST_RECIPIENT],
      subject:'Prueba de correo · Éthykos Next',
      html:testEmail()
    });
    if(sent.error){
      console.error('[V4.12.2 email/test] Resend rechazó el envío:',sent.error.name||'RESEND_ERROR',sent.error.message||'');
      const restricted=/testing|only send|verify a domain/i.test(sent.error.message||'');
      return res.status(restricted?403:502).json({code:restricted?'RESEND_TEST_RECIPIENT_LIMIT':'RESEND_SEND_FAILED',message:restricted?'Resend no autorizó este destinatario en el modo de prueba.':'Resend no pudo aceptar el mensaje de prueba.'});
    }
    console.info('[V4.12.2 email/test] Solicitud aceptada por Resend. ID:',sent.data&&sent.data.id||'sin-id');
    return res.status(200).json({sent:true,to:TEST_RECIPIENT,id:sent.data&&sent.data.id||null,message:'Resend aceptó el mensaje de prueba.'});
  }catch(err){
    console.error('[V4.12.2 email/test] Error:',err.code||err.message||'UNKNOWN');
    if(err.status) return res.status(err.status).json({code:err.status===401?'UNAUTHORIZED':'FORBIDDEN',message:err.status===401?'Inicia sesión nuevamente.':'No tienes permisos para realizar esta acción.'});
    return res.status(500).json({code:'EMAIL_TEST_FAILED',message:'No fue posible completar la prueba de correo.'});
  }
};
