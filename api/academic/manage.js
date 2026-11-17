const getAdmin=()=>require('../_lib/firebaseAdmin').getAdmin();
const {requireGlobalAdmin,httpError}=require('../_lib/accessControl');
const SAFE=/^[A-Za-z0-9_-]{2,80}$/;
const GLOBAL_UID='8mheoQqcekSQkpK5S8qTonUWKt83';

function createHandler({getAdminFn=getAdmin,requireGlobalAdminFn=requireGlobalAdmin}={}){
 return async function(req,res){
  if(!['GET','POST'].includes(req.method))return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  try{
   const input=req.method==='GET'?req.query||{}:req.body||{};
   const {institutionId,academicYearId,action,data={}}=input;
   const app=getAdminFn(),ctx=await requireGlobalAdminFn(req,app),db=app.database();
   const id=String(institutionId||'').trim();
   if(!id||/[.#$\[\]/]/.test(id))throw httpError(400,'INVALID_INSTITUTION','Identificador de institución no válido.');
   const institutionSnap=await db.ref(`institutions/${id}/profile`).once('value');
   const ip=institutionSnap.val();
   if(!ip||ip.status!=='active')throw httpError(404,'INSTITUTION_NOT_FOUND','La institución no existe o no está activa.');
   const year=String(academicYearId||ip.activeAcademicYearId||ip.academicYear||'').trim();
   if(!SAFE.test(year)){
    if(req.method==='GET')return res.status(200).json({institution:{id,name:ip.name||'Institución'},activeAcademicYearId:ip.activeAcademicYearId||null,years:[],yearProfile:null,groups:[],teachers:[],students:[]});
    throw httpError(400,'INVALID_YEAR','Selecciona un año lectivo válido.');
   }
   const root=`academicYears/${id}/${year}`;
   if(req.method==='GET'){
    const [yearsSnap,yearSnap,membersSnap,indexSnap]=await Promise.all([
     db.ref(`academicYears/${id}`).once('value'),db.ref(root).once('value'),db.ref('memberships').once('value'),db.ref(`institutionMembers/${id}`).once('value')
    ]);
    const yearsRaw=yearsSnap.val()||{},academic=yearSnap.val()||{},all=membersSnap.val()||{},index=indexSnap.val()||{},members={};
    for(const [uid,byInst] of Object.entries(all))if(byInst&&byInst[id]?.status==='active')members[uid]={...(index[uid]||{}),...byInst[id]};
    const groups=Object.entries(academic.groups||{}).map(([groupId,g])=>({groupId,...(g.profile||{}),teacherUid:g.teacher?.uid||null,students:Object.keys(g.enrollments||{}).filter(uid=>g.enrollments[uid]?.status==='active')}));
    // Compatibilidad temporal de lectura para grupos guardados en la estructura anterior curso > grupo.
    for(const [courseId,c] of Object.entries(academic.courses||{}))for(const [groupId,g] of Object.entries(c.groups||{}))groups.push({groupId,courseId,...(g.profile||{}),teacherUid:Object.keys(g.teachers||{}).find(uid=>g.teachers[uid]?.status==='active')||null,students:Object.keys(g.enrollments||{}).filter(uid=>g.enrollments[uid]?.status==='active'),legacy:true});
    const teachers=Object.entries(members).filter(([,m])=>m.role==='teacher').map(([uid,m])=>({uid,displayName:m.displayName||m.name||m.email||uid,email:m.email||'',documentId:m.documentId||''}));
    const students=Object.entries(members).filter(([,m])=>m.role==='student').map(([uid,m])=>({uid,displayName:m.displayName||m.name||m.documentId||uid,email:m.email||'',documentId:m.documentId||''}));
    const years=Object.entries(yearsRaw).map(([yearId,y])=>({yearId,name:y.profile?.name||yearId,status:y.profile?.status||'legacy',startsAt:y.profile?.startsAt||null,endsAt:y.profile?.endsAt||null})).sort((a,b)=>b.yearId.localeCompare(a.yearId));
    return res.status(200).json({institution:{id,name:ip.name||'Institución'},activeAcademicYearId:Object.prototype.hasOwnProperty.call(ip,'activeAcademicYearId')?ip.activeAcademicYearId:(ip.academicYear||null),academicYearId:year,yearProfile:academic.profile||null,years,groups,teachers,students});
   }
   const now=Date.now(),updates={};
   const yearSnap=await db.ref(`${root}/profile`).once('value'),yp=yearSnap.val();
   if(action==='createYear'){
    const name=String(data.name||year).trim(),startsAt=data.startsAt||null,endsAt=data.endsAt||null;
    if(!name||name.length>100)throw httpError(400,'INVALID_YEAR_NAME','El nombre del año lectivo es obligatorio.');
    if(startsAt&&Number.isNaN(Date.parse(startsAt)))throw httpError(400,'INVALID_START_DATE','La fecha de inicio no es válida.');
    if(endsAt&&Number.isNaN(Date.parse(endsAt)))throw httpError(400,'INVALID_END_DATE','La fecha de finalización no es válida.');
    if(startsAt&&endsAt&&Date.parse(endsAt)<Date.parse(startsAt))throw httpError(400,'INVALID_DATE_RANGE','La fecha final no puede ser anterior a la inicial.');
    if(yp&&yp.status!=='preparing')throw httpError(409,'YEAR_ALREADY_EXISTS','Ese año lectivo ya existe y no se puede sobrescribir.');
    updates[`${root}/profile`]={...(yp||{}),name,startsAt,endsAt,status:'preparing',createdAt:yp?.createdAt||now,updatedAt:now,createdBy:yp?.createdBy||ctx.user.uid};
   }else if(action==='activateYear'){
    if(!yp)throw httpError(404,'YEAR_NOT_FOUND','Primero crea el año lectivo.');
    if(yp.status==='closed')throw httpError(409,'YEAR_CLOSED','Un año lectivo cerrado no se puede reabrir.');
    const activeId=String(ip.activeAcademicYearId||ip.academicYear||'');
    if(activeId&&activeId!==year){const activeProfile=(await db.ref(`academicYears/${id}/${activeId}/profile`).once('value')).val();if((activeProfile&&activeProfile.status==='active')||(!activeProfile&&activeId===String(ip.academicYear||'')))throw httpError(409,'ACTIVE_YEAR_MUST_CLOSE','Cierra el año lectivo activo antes de abrir otro.');}
    updates[`${root}/profile/status`]='active';updates[`${root}/profile/activatedAt`]=now;updates[`institutions/${id}/profile/activeAcademicYearId`]=year;updates[`institutions/${id}/profile/academicYear`]=year;
   }else if(action==='closeYear'){
    const isLegacyActive=!yp&&String(ip.activeAcademicYearId||ip.academicYear||'')===year;
    if((!yp&&!isLegacyActive)||(yp&&yp.status!=='active'))throw httpError(409,'YEAR_NOT_ACTIVE','Solo se puede cerrar un año lectivo activo.');
    updates[`${root}/profile`]={...(yp||{}),name:yp?.name||`Año lectivo ${year}`,status:'closed',closedAt:now,closedBy:ctx.user.uid};
    if(String(ip.activeAcademicYearId||ip.academicYear||'')===year){updates[`institutions/${id}/profile/activeAcademicYearId`]=null;updates[`institutions/${id}/profile/academicYear`]=null;}
   }else{
    if(!yp||yp.status!=='active'||String(ip.activeAcademicYearId||ip.academicYear||'')!==year)throw httpError(409,'YEAR_NOT_ACTIVE','La operación requiere un año lectivo activo.');
    if(action==='createGroup'){
     const groupId=String(data.groupId||'').trim().toUpperCase(),name=String(data.name||groupId).trim(),gradeLevel=String(data.gradeLevel||'').trim();
     if(!SAFE.test(groupId)||!name||name.length>100)throw httpError(400,'INVALID_GROUP','Identificador y nombre del grupo son obligatorios.');
     const existing=(await db.ref(`${root}/groups/${groupId}`).once('value')).val();if(existing)throw httpError(409,'GROUP_ALREADY_EXISTS','Ese grupo ya existe en el año lectivo.');
     updates[`${root}/groups/${groupId}/profile`]={name,gradeLevel,status:'active',createdAt:now,createdBy:ctx.user.uid};
    }else if(action==='assignTeacher'){
     const groupId=String(data.groupId||'').trim().toUpperCase(),teacherUid=String(data.teacherUid||'').trim();
     if(!SAFE.test(groupId)||!teacherUid)throw httpError(400,'INVALID_ASSIGNMENT','Selecciona un grupo y un docente.');
     const [group,m]=await Promise.all([db.ref(`${root}/groups/${groupId}/profile`).once('value'),db.ref(`memberships/${teacherUid}/${id}`).once('value')]).then(a=>a.map(x=>x.val()));
     if(!group||group.status!=='active')throw httpError(404,'GROUP_NOT_FOUND','El grupo no existe o está inactivo.');
     if(!m||m.status!=='active'||m.role!=='teacher')throw httpError(400,'TEACHER_NOT_ACTIVE','El docente no tiene una cuenta activa en esta institución.');
     updates[`${root}/groups/${groupId}/teacher`]={uid:teacherUid,status:'active',assignedAt:now,assignedBy:ctx.user.uid};
    }else if(action==='enrollStudent'){
     const groupId=String(data.groupId||'').trim().toUpperCase(),studentUid=String(data.studentUid||'').trim();
     if(!SAFE.test(groupId)||!studentUid)throw httpError(400,'INVALID_ENROLLMENT','Selecciona un grupo y un estudiante.');
     const [group,m,teacher]=await Promise.all([db.ref(`${root}/groups/${groupId}/profile`).once('value'),db.ref(`memberships/${studentUid}/${id}`).once('value'),db.ref(`${root}/groups/${groupId}/teacher`).once('value')]).then(a=>a.map(x=>x.val()));
     if(!group||group.status!=='active')throw httpError(404,'GROUP_NOT_FOUND','El grupo no existe o está inactivo.');
     if(!teacher||teacher.status!=='active')throw httpError(409,'TEACHER_REQUIRED','Asigna primero un docente de Ética al grupo.');
     if(!m||m.status!=='active'||m.role!=='student')throw httpError(400,'STUDENT_NOT_ACTIVE','El estudiante no tiene una cuenta activa en esta institución.');
     const existing=(await db.ref(`${root}/groups`).once('value')).val()||{};
     for(const [otherId,g] of Object.entries(existing))if(otherId!==groupId&&g.enrollments?.[studentUid]?.status==='active')throw httpError(409,'STUDENT_ALREADY_ENROLLED','El estudiante ya está matriculado en otro grupo de este año lectivo.');
     updates[`${root}/groups/${groupId}/enrollments/${studentUid}`]={status:'active',enrolledAt:now,enrolledBy:ctx.user.uid};
    }else throw httpError(400,'UNKNOWN_ACTION','Operación académica no reconocida.');
   }
   const auditRef=db.ref('auditLogs').push();updates[`auditLogs/${auditRef.key}`]={actorUid:ctx.user.uid,action:`academic.${action}`,institutionId:id,createdAt:now,details:{academicYearId:year,...(data.groupId?{groupId:data.groupId}:{}),...(data.teacherUid?{teacherUid:data.teacherUid}:{}),...(data.studentUid?{studentUid:data.studentUid}:{})}};
   await db.ref().update(updates);
   return res.status(200).json({ok:true,action,academicYearId:year,status:action==='createYear'?'preparing':action==='closeYear'?'closed':action==='activateYear'?'active':undefined});
  }catch(e){console.error('[academic/manage]',e.code||e.message||'UNKNOWN');return res.status(e.status||500).json({code:e.code||'ACADEMIC_OPERATION_FAILED',message:e.status?e.message:'No fue posible completar la operación académica.'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
