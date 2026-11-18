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


const GLOBAL_ADMIN_UID = '8mheoQqcekSQkpK5S8qTonUWKt83';

async function requireGlobalAdmin(req, app=defaultApp()){
  const decoded=await requireVerifiedUser(req,app);
  if(decoded.uid!==GLOBAL_ADMIN_UID) throw httpError(403,'GLOBAL_ADMIN_REQUIRED','Esta operación requiere permisos de administrador global.');
  return {user:decoded};
}

async function institutionHasOpenYear(institutionId,institution,app){
  const yearId=String(institution.activeAcademicYearId||institution.academicYear||'').trim();
  if(!yearId)return false;
  const snap=await app.database().ref(`academicYears/${institutionId}/${yearId}/profile`).once('value');
  const profile=snap.val();
  // Compatibilidad: años antiguos sin perfil explícito siguen operativos hasta que se migren.
  return !profile || profile.status==='active';
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
  if(!await institutionHasOpenYear(id,institution,app)) throw httpError(403,'ACADEMIC_YEAR_CLOSED','La institución no tiene un año lectivo activo. El acceso académico está cerrado.');
  return {user:decoded,membership,institution:{id,name:institution.name||'Institución',shortName:institution.shortName||'',slug:institution.slug||'',city:institution.city||'',department:institution.department||'',academicYear:institution.academicYear||''}};
}

async function listActiveInstitutionContexts(uid,app=defaultApp()){
  if(uid===GLOBAL_ADMIN_UID){
    const institutionsSnap=await app.database().ref('institutions').once('value');
    const institutions=institutionsSnap.val()||{};
    return Object.entries(institutions)
      .filter(([,item])=>item&&item.profile&&item.profile.status==='active')
      .map(([institutionId,item])=>({
        institutionId,
        role:'global_admin',
        membershipStatus:'active',
        institution:{name:item.profile.name||'Institución',shortName:item.profile.shortName||'',slug:item.profile.slug||'',city:item.profile.city||'',department:item.profile.department||'',academicYear:item.profile.academicYear||''}
      }))
      .sort((a,b)=>a.institution.name.localeCompare(b.institution.name,'es'));
  }
  const membershipsSnap=await app.database().ref(`memberships/${uid}`).once('value');
  const memberships=membershipsSnap.val()||{};
  const active=Object.entries(memberships).filter(([,m])=>m&&m.status==='active'&&['teacher','student'].includes(m.role));
  const contexts=await Promise.all(active.map(async([institutionId,membership])=>{
    const snap=await app.database().ref(`institutions/${institutionId}/profile`).once('value');
    const p=snap.val();
    if(!p||p.status!=='active') return null;
    if(!await institutionHasOpenYear(institutionId,p,app)) return null;
    const yearId=String(p.activeAcademicYearId||p.academicYear||'').trim();
    if(!yearId) return null;
    const yearData=(await app.database().ref(`academicYears/${institutionId}/${yearId}`).once('value')).val()||{};
    const groups=yearData.groups||{};
    let assigned=false;
    if(membership.role==='teacher'){
      assigned=Object.values(groups).some(g=>g&&g.profile?.status==='active'&&g.teacher?.uid===uid&&g.teacher?.status==='active');
    }else{
      assigned=Object.values(groups).some(g=>g&&g.profile?.status==='active'&&g.enrollments?.[uid]?.status==='active');
    }
    if(!assigned) return null;
    return {institutionId,role:membership.role,membershipStatus:membership.status,institution:{name:p.name||'Institución',shortName:p.shortName||'',slug:p.slug||'',city:p.city||'',department:p.department||'',academicYear:yearId}};
  }));
  return contexts.filter(Boolean).sort((a,b)=>a.institution.name.localeCompare(b.institution.name,'es'));
}

module.exports={requireVerifiedUser,requireGlobalAdmin,requireInstitutionRole,listActiveInstitutionContexts,institutionHasOpenYear,httpError};
