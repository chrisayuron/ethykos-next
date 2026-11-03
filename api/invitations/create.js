const {getAdmin,requireAdmin}=require('../_lib/firebaseAdmin');
const {Resend}=require('resend');
const APP_URL='https://ethykos-next.vercel.app';
function htmlEmail({name,institution,verifyUrl,passwordUrl}){
 const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1d2939"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 34px;background:#eff6ff"><div style="font-size:12px;letter-spacing:2px;font-weight:bold;color:#2563eb">ÉTHYKOS NEXT</div><h1 style="font-size:25px;margin:16px 0 4px">¡Te damos la bienvenida!</h1><p style="margin:0;color:#536174">Aprender · Crecer · Trascender</p></td></tr><tr><td style="padding:30px 34px"><p>Hola <strong>${safe(name)}</strong>:</p><p>Has sido invitado(a) a participar como docente en <strong>${safe(institution)}</strong>, dentro de la plataforma Éthykos Next.</p><p>Para activar tu acceso, completa estos dos pasos en orden:</p><p style="margin:25px 0 8px"><strong>1. Confirma tu correo electrónico</strong></p><p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:bold">Confirmar mi correo</a></p><p style="margin:24px 0 8px"><strong>2. Establece tu contraseña personal</strong></p><p><a href="${passwordUrl}" style="display:inline-block;background:#168b69;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:bold">Crear mi contraseña</a></p><p style="font-size:13px;line-height:1.65;color:#667085;margin-top:24px">Si no reconoces esta invitación, puedes ignorar este mensaje. No compartas estos enlaces con otras personas.</p><p style="font-size:13px;color:#667085">Después de completar los pasos, ingresa desde <a href="${APP_URL}/login">Éthykos Next</a>.</p></td></tr><tr><td style="padding:18px 34px;background:#f8fafc;color:#98a2b3;font-size:11px">Mensaje automático de Éthykos Next. Por favor, no respondas a este correo.</td></tr></table></td></tr></table></body></html>`;
}
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).json({message:'Método no permitido.'});
 let uid;
 try{
  await requireAdmin(req);
  const {displayName,email,institutionId}=req.body||{};
  const name=String(displayName||'').trim(),mail=String(email||'').trim().toLowerCase(),id=String(institutionId||'').trim();
  if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(mail)||mail.length>254||!id)return res.status(400).json({code:'INVALID_INPUT',message:'Revisa el nombre, correo y la institución seleccionada.'});
  const app=getAdmin(),db=app.database(),auth=app.auth();
  const instSnap=await db.ref(`institutions/${id}/profile`).once('value'),inst=instSnap.val();
  if(!inst||inst.status!=='active')return res.status(400).json({code:'INSTITUTION_INACTIVE',message:'La institución seleccionada no está disponible.'});
  try{await auth.getUserByEmail(mail);return res.status(409).json({code:'auth/email-already-exists',message:'Ya existe una cuenta con ese correo.'});}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  const created=await auth.createUser({email:mail,displayName:name,emailVerified:false,disabled:false});uid=created.uid;
  const actionSettings={url:`${APP_URL}/auth-action`,handleCodeInApp:false};
  const verifyUrl=await auth.generateEmailVerificationLink(mail,actionSettings);
  const passwordUrl=await auth.generatePasswordResetLink(mail,actionSettings);
  const now=Date.now(),updates={};
  updates[`users/${uid}/profile`]={displayName:name,email:mail,status:'active',mustChangePassword:true,createdAt:now,createdBy:'8mheoQqcekSQkpK5S8qTonUWKt83'};
  updates[`memberships/${uid}/${id}`]={role:'teacher',status:'active',createdAt:now,createdBy:'8mheoQqcekSQkpK5S8qTonUWKt83'};
  updates[`institutionMembers/${id}/${uid}`]={uid,displayName:name,email:mail,role:'teacher',status:'active',createdAt:now};
  updates[`invitations/${uid}`]={uid,email:mail,institutionId:id,status:'pending_email',createdAt:now,updatedAt:now};
  updates[`auditLogs/${db.ref('auditLogs').push().key}`]={actorUid:'8mheoQqcekSQkpK5S8qTonUWKt83',action:'teacher.invited',details:{uid,institutionId:id,email:mail},createdAt:now};
  await db.ref().update(updates);
  const resendKey=process.env.RESEND_API_KEY;if(!resendKey)return res.status(201).json({created:true,emailSent:false,uid,message:'Cuenta creada; falta configurar el servicio de correo.'});
  const resend=new Resend(resendKey);
  const sent=await resend.emails.send({from:process.env.RESEND_FROM_EMAIL||'Éthykos Next <onboarding@resend.dev>',to:[mail],subject:`Tu invitación a Éthykos Next · ${inst.name||'Institución'}`,html:htmlEmail({name,institution:inst.name||'tu institución',verifyUrl,passwordUrl})});
  if(sent.error){const err=new Error(sent.error.message||'RESEND_SEND_FAILED');err.code=sent.error.name||'RESEND_SEND_FAILED';throw err;}
  await db.ref(`invitations/${uid}`).update({status:'sent',sentAt:Date.now(),providerId:sent.data&&sent.data.id||null});
  return res.status(201).json({created:true,emailSent:true,uid});
 }catch(err){
  console.error('[V4.12 invitation/create]',err.code||err.message||'UNKNOWN');
  if(err.status)return res.status(err.status).json({code:err.message,message:err.status===401?'Inicia sesión nuevamente.':'No tienes permisos para realizar esta acción.'});
  if(err.message==='SERVER_CONFIG_MISSING')return res.status(500).json({code:'SERVER_CONFIG_MISSING',message:'El servicio de invitaciones no está configurado completamente.'});
  if(err.code==='validation_error'||/testing|only send|verify a domain/i.test(err.message||''))return res.status(400).json({code:'RESEND_TEST_RECIPIENT_LIMIT',message:'El servicio de correo está en modo de prueba y no permite enviar a este destinatario.'});
  return res.status(uid?201:500).json({code:'INVITATION_FAILED',created:!!uid,emailSent:false,message:uid?'La cuenta quedó creada, pero el correo no pudo enviarse.':'No fue posible crear la invitación.'});
 }
};
