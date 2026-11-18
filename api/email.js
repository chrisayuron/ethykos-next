const {requireAdmin}=require('../lib/api/firebaseAdmin');
const {Resend}=require('resend');
const {testEmail,invitationEmail}=require('../lib/api/emailTemplates');

const TEST_RECIPIENT='rrnewball@gmail.com';
const PREVIEW_RECIPIENT='rrnewball@gmail.com';
const DEFAULT_FROM='Éthykos Next <onboarding@resend.dev>';

module.exports=async function(req,res){
  if(req.method!=='POST') return res.status(405).json({code:'METHOD_NOT_ALLOWED',message:'Método no permitido.'});
  const action=String(req.query?.action||'');
  if(!['test','invitation-preview'].includes(action)) return res.status(404).json({code:'EMAIL_ACTION_NOT_FOUND',message:'Acción de correo no encontrada.'});
  try{
    await requireAdmin(req);
    const apiKey=process.env.RESEND_API_KEY;
    if(!apiKey) return res.status(500).json({code:'RESEND_NOT_CONFIGURED',message:'El servicio de correo no está configurado.'});
    const resend=new Resend(apiKey);
    const from=process.env.RESEND_FROM_EMAIL||DEFAULT_FROM;

    if(action==='test'){
      const sent=await resend.emails.send({
        from,to:[TEST_RECIPIENT],subject:'Prueba de correo · Éthykos Next',html:testEmail()
      });
      if(sent.error){
        console.error('[V4.21.0 email/test] Resend rechazó el envío:',sent.error.name||'RESEND_ERROR',sent.error.message||'');
        const restricted=/testing|only send|verify a domain/i.test(sent.error.message||'');
        return res.status(restricted?403:502).json({code:restricted?'RESEND_TEST_RECIPIENT_LIMIT':'RESEND_SEND_FAILED',message:restricted?'Resend no autorizó este destinatario en el modo de prueba.':'Resend no pudo aceptar el mensaje de prueba.'});
      }
      console.info('[V4.21.0 email/test] Solicitud aceptada por Resend. ID:',sent.data&&sent.data.id||'sin-id');
      return res.status(200).json({sent:true,to:TEST_RECIPIENT,id:sent.data&&sent.data.id||null,message:'Resend aceptó el mensaje de prueba.'});
    }

    const html=invitationEmail({
      name:'María Fernanda Torres',institution:'Institución Educativa Demostración',
      email:'maria.torres@institucion.edu.co',verifyUrl:null,passwordUrl:null,preview:true
    });
    const sent=await resend.emails.send({
      from,to:[PREVIEW_RECIPIENT],
      subject:'Vista previa de invitación docente · Éthykos Next',html
    });
    if(sent.error){
      console.error('[V4.21.0 email/invitation-preview] Resend rechazó el envío:',sent.error.name||'RESEND_ERROR',sent.error.message||'');
      const restricted=/testing|only send|verify a domain/i.test(sent.error.message||'');
      return res.status(restricted?403:502).json({code:restricted?'RESEND_TEST_RECIPIENT_LIMIT':'RESEND_SEND_FAILED',message:restricted?'Resend no autorizó este destinatario en el modo de prueba.':'Resend no pudo aceptar la vista previa.'});
    }
    console.info('[V4.21.0 email/invitation-preview] Vista previa aceptada. ID:',sent.data&&sent.data.id||'sin-id');
    return res.status(200).json({sent:true,to:PREVIEW_RECIPIENT,id:sent.data&&sent.data.id||null,message:'Resend aceptó la vista previa de invitación.'});
  }catch(err){
    const tag=action==='test'?'email/test':'email/invitation-preview';
    console.error('[V4.21.0 '+tag+'] Error:',err.code||err.message||'UNKNOWN');
    if(err.status) return res.status(err.status).json({code:err.status===401?'UNAUTHORIZED':'FORBIDDEN',message:err.status===401?'Inicia sesión nuevamente.':'No tienes permisos para realizar esta acción.'});
    return res.status(500).json({code:action==='test'?'EMAIL_TEST_FAILED':'INVITATION_PREVIEW_FAILED',message:action==='test'?'No fue posible completar la prueba.':'No fue posible enviar la vista previa.'});
  }
};
