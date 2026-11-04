const {requireAdmin}=require('../_lib/firebaseAdmin');
const {Resend}=require('resend');

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
      html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f7fb;padding:32px 12px;font-family:Arial,sans-serif;color:#1d2939"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;padding:32px"><tr><td><div style="font-size:12px;letter-spacing:2px;font-weight:bold;color:#2563eb">ÉTHYKOS NEXT</div><h1 style="font-size:24px;margin:18px 0 12px">¡El correo de prueba llegó!</h1><p>Este mensaje confirma que Éthykos Next pudo conectarse con Resend y solicitar el envío de un correo.</p><p style="color:#667085;font-size:13px">Este es un mensaje técnico de prueba. No se creó ninguna cuenta ni se modificaron perfiles o membresías.</p><p style="margin-top:28px;color:#667085;font-size:12px">Éthykos Next · Prueba de integración de correo</p></td></tr></table></td></tr></table></body></html>`
    });
    if(sent.error){
      console.error('[V4.12.1 email/test] Resend rechazó el envío:',sent.error.name||'RESEND_ERROR',sent.error.message||'');
      const restricted=/testing|only send|verify a domain/i.test(sent.error.message||'');
      return res.status(restricted?403:502).json({code:restricted?'RESEND_TEST_RECIPIENT_LIMIT':'RESEND_SEND_FAILED',message:restricted?'Resend no autorizó este destinatario en el modo de prueba.':'Resend no pudo aceptar el mensaje de prueba.'});
    }
    console.info('[V4.12.1 email/test] Solicitud aceptada por Resend. ID:',sent.data&&sent.data.id||'sin-id');
    return res.status(200).json({sent:true,to:TEST_RECIPIENT,id:sent.data&&sent.data.id||null,message:'Resend aceptó el mensaje de prueba.'});
  }catch(err){
    console.error('[V4.12.1 email/test] Error:',err.code||err.message||'UNKNOWN');
    if(err.status) return res.status(err.status).json({code:err.status===401?'UNAUTHORIZED':'FORBIDDEN',message:err.status===401?'Inicia sesión nuevamente.':'No tienes permisos para realizar esta acción.'});
    return res.status(500).json({code:'EMAIL_TEST_FAILED',message:'No fue posible completar la prueba de correo.'});
  }
};
