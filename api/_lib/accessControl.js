function defaultApp(){return require('./firebaseAdmin').getAdmin();}

function httpError(status,code,message){const error=new Error(message);error.status=status;error.code=code;return error;}

async function requireVerifiedUser(req,app=defaultApp()){
  const header=req.headers.authorization||'';
  if(!header.startsWith('Bearer ')) throw httpError(401,'UNAUTHORIZED','Inicia sesión para continuar.');
  let decoded;
  try{decoded=await app.auth().verifyIdToken(header.slice(7));}
  catch(_){throw httpError(401,'INVALID_TOKEN','La sesión no es válida. Inicia sesión nuevamente.');}
  if(!decoded.email_verified) throw httpError(403,'EMAIL_NOT_VERIFIED','Debes verificar tu correo electrónico.');
  return decoded;
}

async function requireInstitutionRole(req,institutionId,allowedRoles,app=defaultApp()){
  const decoded=await requireVerifiedUser(req,app);
  const id=String(institutionId||'').trim();
  if(!id||/[.#$\[\]/]/.test(id)) throw httpError(400,'INVALID_INSTITUTION','El identificador de institución no es válido.');
  const membershipSnap=await app.database().ref(`memberships/${decoded.uid}/${id}`).once('value');
  const membership=membershipSnap.val();
  if(!membership||membership.status!=='active') throw httpError(403,'INSTITUTION_ACCESS_DENIED','No tienes una membresía activa en esta institución.');
  if(!allowedRoles.includes(membership.role)) throw httpError(403,'ROLE_NOT_ALLOWED','Tu perfil no tiene permiso para realizar esta operación.');
  const institutionSnap=await app.database().ref(`institutions/${id}/profile`).once('value');
  const institution=institutionSnap.val();
  if(!institution||institution.status!=='active') throw httpError(403,'INSTITUTION_INACTIVE','La institución no está disponible.');
  return {user:decoded,membership,institution:{id,name:institution.name||'Institución',shortName:institution.shortName||'',slug:institution.slug||'',city:institution.city||'',department:institution.department||'',academicYear:institution.academicYear||''}};
}

async function listActiveInstitutionContexts(uid,app=defaultApp()){
  const membershipsSnap=await app.database().ref(`memberships/${uid}`).once('value');
  const memberships=membershipsSnap.val()||{};
  const active=Object.entries(memberships).filter(([,m])=>m&&m.status==='active'&&['institution_admin','teacher','student'].includes(m.role));
  const contexts=await Promise.all(active.map(async([institutionId,membership])=>{
    const snap=await app.database().ref(`institutions/${institutionId}/profile`).once('value');
    const p=snap.val();
    if(!p||p.status!=='active') return null;
    return {institutionId,role:membership.role,membershipStatus:membership.status,institution:{name:p.name||'Institución',shortName:p.shortName||'',slug:p.slug||'',city:p.city||'',department:p.department||'',academicYear:p.academicYear||''}};
  }));
  return contexts.filter(Boolean).sort((a,b)=>a.institution.name.localeCompare(b.institution.name,'es'));
}

module.exports={requireVerifiedUser,requireInstitutionRole,listActiveInstitutionContexts,httpError};
