const {getAdmin,requireAdmin}=require('../_lib/firebaseAdmin');
const {requireVerifiedUser,requireInstitutionRole}=require('../_lib/accessControl');
const {Resend}=require('resend');
const APP_URL=process.env.APP_URL||'https://ethykos-next.vercel.app';
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
 let uid=null,created=false,persisted=false;
 try{
  const {displayName,email,institutionId,gradeLevel,courseId,groupId}=req.body||{};
  const name=String(displayName||'').trim(),mail=String(email||'').trim().toLowerCase(),id=String(institutionId||'').trim();
  if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(mail)||mail.length>254||!id||/[.#$\[\]\/]/.test(id))return res.status(400).json({code:'INVALID_INPUT',message:'Revisa nombre, correo e institución.'});
  const app=getAdmin(),db=app.database();const header=req.headers.authorization||'';let actorUid='8mheoQqcekSQkpK5S8qTonUWKt83';
  if(header.startsWith('Bearer ')){
   const decoded=await app.auth().verifyIdToken(header.slice(7));actorUid=decoded.uid;
   if(decoded.uid==='8mheoQqcekSQkpK5S8qTonUWKt83') await requireAdmin(req);
   else await requireInstitutionRole(req,id,['institution_admin'],app);
  }else await requireAdmin(req);
  const inst=(await db.ref(`institutions/${id}/profile`).once('value')).val();
  if(!inst||inst.status!=='active')return res.status(400).json({code:'INSTITUTION_INACTIVE',message:'La institución no está activa.'});
  let groupPath=null;
  if(courseId||groupId||gradeLevel){
   if(!courseId||!groupId||!gradeLevel)return res.status(400).json({code:'ACADEMIC_LINK_REQUIRED',message:'Para matricular al estudiante indica grado, curso y grupo.'});
   groupPath=`academicYears/${id}/${inst.academicYear||new Date().getFullYear()}/courses/${courseId}/groups/${groupId}`;
   const group=(await db.ref(groupPath+'/profile').once('value')).val();
   if(!group||group.status!=='active')return res.status(400).json({code:'GROUP_NOT_FOUND',message:'El grupo seleccionado no está disponible.'});
  }
  try{await app.auth().getUserByEmail(mail);return res.status(409).json({code:'EMAIL_EXISTS',message:'Ya existe una cuenta con ese correo. Debe recuperarse o vincularse la cuenta existente.'});}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  const user=await app.auth().createUser({email:mail,displayName:name,emailVerified:false,disabled:false});uid=user.uid;created=true;
  const now=Date.now(),updates={};
  updates[`users/${uid}/profile`]={displayName:name,email:mail,status:'active',mustChangePassword:true,createdAt:now,createdBy:actorUid};
  updates[`memberships/${uid}/${id}`]={role:'student',status:'active',createdAt:now};
  updates[`institutionMembers/${id}/${uid}`]={uid,displayName:name,email:mail,role:'student',status:'active',createdAt:now};
  if(groupPath)updates[`${groupPath}/enrollments/${uid}`]={status:'active',enrolledAt:now,gradeLevel:String(gradeLevel)};
  updates[`auditLogs/${db.ref('auditLogs').push().key}`]={actorUid,action:'student.created',institutionId:id,details:{uid,gradeLevel:gradeLevel||null,courseId:courseId||null,groupId:groupId||null},createdAt:now};
  await db.ref().update(updates);persisted=true;
  let resetUrl=null,emailSent=false,emailError=null;
  try{resetUrl=await app.auth().generatePasswordResetLink(mail,{url:`${APP_URL}/auth-action`,handleCodeInApp:false});}catch(linkError){console.error('[students/create] reset link:',linkError.code||'LINK_FAILED');emailError='PASSWORD_LINK_FAILED';}
  if(resetUrl&&process.env.RESEND_API_KEY){
   const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#24304a"><div style="background:#172b55;color:white;padding:28px;text-align:center"><h1>✦ ÉTHYKOS NEXT</h1><p>APRENDER · CRECER · TRASCENDER</p></div><div style="padding:30px"><h2>¡Bienvenido, ${name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}!</h2><p>Tu cuenta de estudiante ha sido creada en ${inst.name||'tu institución'}.</p><p>Para establecer tu contraseña, utiliza el siguiente enlace:</p><p><a href="${resetUrl}" style="display:inline-block;background:#315bdc;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none">Establecer mi contraseña</a></p><p>Después podrás iniciar sesión con ${mail}.</p></div><footer style="background:#f2f5fa;padding:20px;text-align:center">Mensaje automático de Éthykos Next.</footer></div>`;
   const sent=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM_EMAIL||'Éthykos Next <onboarding@resend.dev>',to:[mail],subject:`Activa tu cuenta de estudiante · ${inst.name||'Éthykos Next'}`,html});
   emailSent=!sent.error;
   if(sent.error)console.error('[students/create] Resend:',sent.error.name||'SEND_FAILED');
  }
  return res.status(201).json({created:true,persisted:true,uid,emailSent,emailError,message:emailSent?'Cuenta creada y correo enviado.':'Cuenta creada; el correo quedó pendiente de envío.'});
 }catch(e){
  console.error('[students/create]',e.code||e.message||'UNKNOWN');
  if(created&&!persisted&&uid){try{await getAdmin().auth().deleteUser(uid);}catch(clean){console.error('[students/create] cleanup',clean.code||'FAILED');}}
  return res.status(e.status||500).json({code:e.code||e.message||'STUDENT_CREATE_FAILED',message:e.status?e.message:'No fue posible crear la cuenta del estudiante.'});
 }
};
