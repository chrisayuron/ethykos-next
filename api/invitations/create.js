const {getAdmin,requireAdmin}=require('../_lib/firebaseAdmin');
const {Resend}=require('resend');
const {invitationEmail}=require('../_lib/emailTemplates');
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
  const sent=await resend.emails.send({from:process.env.RESEND_FROM_EMAIL||'Éthykos Next <onboarding@resend.dev>',to:[mail],subject:`Tu invitación a Éthykos Next · ${inst.name||'Institución'}`,html:invitationEmail({name,institution:inst.name||'tu institución',email:mail,verifyUrl,passwordUrl})});
  if(sent.error){const err=new Error(sent.error.message||'RESEND_SEND_FAILED');err.code=sent.error.name||'RESEND_SEND_FAILED';throw err;}
  await db.ref(`invitations/${uid}`).update({status:'sent',sentAt:Date.now(),providerId:sent.data&&sent.data.id||null});
  return res.status(201).json({created:true,emailSent:true,uid});
 }catch(err){
  console.error('[V4.12.2 invitation/create]',err.code||err.message||'UNKNOWN');
  if(err.status)return res.status(err.status).json({code:err.message,message:err.status===401?'Inicia sesión nuevamente.':'No tienes permisos para realizar esta acción.'});
  if(err.message==='SERVER_CONFIG_MISSING')return res.status(500).json({code:'SERVER_CONFIG_MISSING',message:'El servicio de invitaciones no está configurado completamente.'});
  if(err.code==='validation_error'||/testing|only send|verify a domain/i.test(err.message||''))return res.status(400).json({code:'RESEND_TEST_RECIPIENT_LIMIT',message:'El servicio de correo está en modo de prueba y no permite enviar a este destinatario.'});
  return res.status(uid?201:500).json({code:'INVITATION_FAILED',created:!!uid,emailSent:false,message:uid?'La cuenta quedó creada, pero el correo no pudo enviarse.':'No fue posible crear la invitación.'});
 }
};
