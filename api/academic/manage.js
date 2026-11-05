const getAdmin=()=>require('../_lib/firebaseAdmin').getAdmin();
const {requireInstitutionRole,httpError}=require('../_lib/accessControl');
const SAFE=/^[A-Za-z0-9_-]{3,80}$/;
const GROUP_SAFE=/^[A-Za-z0-9_-]{2,80}$/;

function createHandler({getAdminFn=getAdmin,requireRoleFn=requireInstitutionRole}={}){
 return async function(req,res){
  if(!['GET','POST'].includes(req.method))return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  try{
   const input=req.method==='GET'?req.query||{}:req.body||{};
   const {institutionId,academicYearId,action,data={}}=input;
   const app=getAdminFn(),ctx=await requireRoleFn(req,institutionId,['institution_admin'],app);
   const db=app.database(),id=String(institutionId),year=String(academicYearId||ctx.institution.academicYear||new Date().getFullYear());
   if(!SAFE.test(year))throw httpError(400,'INVALID_YEAR','Año académico no válido.');
   const root=`academicYears/${id}/${year}`;
   if(req.method==='GET'){
    const [yearSnap,membersSnap]=await Promise.all([db.ref(root).once('value'),db.ref(`institutionMembers/${id}`).once('value')]);
    const academic=yearSnap.val()||{},members=membersSnap.val()||{};
    const courses=Object.entries(academic.courses||{}).map(([courseId,c])=>({courseId,...(c.profile||{}),groups:Object.entries(c.groups||{}).map(([groupId,g])=>({groupId,...(g.profile||{}),teachers:Object.keys(g.teachers||{}).filter(uid=>g.teachers[uid]?.status==='active'),students:Object.keys(g.enrollments||{}).filter(uid=>g.enrollments[uid]?.status==='active')}))}));
    const teachers=Object.entries(members).filter(([,m])=>m&&m.role==='teacher'&&m.status==='active').map(([uid,m])=>({uid,displayName:m.displayName||m.name||m.email||uid,email:m.email||''}));
    const students=Object.entries(members).filter(([,m])=>m&&m.role==='student'&&m.status==='active').map(([uid,m])=>({uid,displayName:m.displayName||m.name||m.email||uid,email:m.email||''}));
    return res.status(200).json({institution:ctx.institution,academicYearId:year,yearProfile:academic.profile||null,courses,teachers,students});
   }
   const now=Date.now(),updates={};
   if(action==='createYear'){
    const name=String(data.name||year).trim();
    if(!name||name.length>100)throw httpError(400,'INVALID_YEAR_NAME','El nombre del año académico es obligatorio y no puede superar 100 caracteres.');
    const startsAt=data.startsAt||null,endsAt=data.endsAt||null;
    if(startsAt&&Number.isNaN(Date.parse(startsAt)))throw httpError(400,'INVALID_START_DATE','La fecha de inicio no es válida.');
    if(endsAt&&Number.isNaN(Date.parse(endsAt)))throw httpError(400,'INVALID_END_DATE','La fecha de finalización no es válida.');
    if(startsAt&&endsAt&&Date.parse(endsAt)<Date.parse(startsAt))throw httpError(400,'INVALID_DATE_RANGE','La fecha de finalización no puede ser anterior al inicio.');
    updates[`${root}/profile`]={name,startsAt,endsAt,status:'active',createdAt:now,createdBy:ctx.user.uid};
   }else if(action==='createCourse'){
    const courseId=String(data.courseId||'');
    if(!SAFE.test(courseId))throw httpError(400,'INVALID_COURSE_ID','Identificador de curso no válido.');
    const name=String(data.name||'').trim(),gradeLevel=String(data.gradeLevel||'').trim();
    if(!name||name.length>100||!gradeLevel||gradeLevel.length>30)throw httpError(400,'INVALID_COURSE','Nombre y grado son obligatorios.');
    updates[`${root}/courses/${courseId}/profile`]={name,gradeLevel,status:'active',createdAt:now,createdBy:ctx.user.uid};
   }else if(action==='createGroup'){
    const {courseId,groupId,name}=data;
    if(!SAFE.test(String(courseId||''))||!GROUP_SAFE.test(String(groupId||''))||!String(name||'').trim())throw httpError(400,'INVALID_GROUP','Curso, identificador y nombre de grupo son obligatorios.');
    const course=(await db.ref(`${root}/courses/${courseId}/profile`).once('value')).val();
    if(!course||course.status!=='active')throw httpError(404,'COURSE_NOT_FOUND','No existe el curso activo.');
    updates[`${root}/courses/${courseId}/groups/${groupId}/profile`]={name:String(name).trim(),status:'active',createdAt:now,createdBy:ctx.user.uid};
   }else if(action==='assignTeacher'){
    const {courseId,groupId,teacherUid}=data;
    if(!SAFE.test(String(courseId||''))||!GROUP_SAFE.test(String(groupId||''))||!teacherUid)throw httpError(400,'INVALID_ASSIGNMENT','Datos de asignación incompletos.');
    const [course,group,m]=await Promise.all([
     db.ref(`${root}/courses/${courseId}/profile`).once('value'),
     db.ref(`${root}/courses/${courseId}/groups/${groupId}/profile`).once('value'),
     db.ref(`memberships/${teacherUid}/${id}`).once('value')
    ]).then(xs=>xs.map(x=>x.val()));
    if(!course||course.status!=='active')throw httpError(404,'COURSE_NOT_FOUND','No existe el curso activo.');
    if(!group||group.status!=='active')throw httpError(404,'GROUP_NOT_FOUND','No existe el grupo activo.');
    if(!m||m.status!=='active'||m.role!=='teacher')throw httpError(400,'TEACHER_NOT_ACTIVE','El docente no tiene membresía activa en esta institución.');
    updates[`${root}/courses/${courseId}/groups/${groupId}/teachers/${teacherUid}`]={role:'teacher',status:'active',assignedAt:now,assignedBy:ctx.user.uid};
   }else if(action==='enrollStudent'){
    const {courseId,groupId,studentUid}=data;
    if(!SAFE.test(String(courseId||''))||!GROUP_SAFE.test(String(groupId||''))||!studentUid)throw httpError(400,'INVALID_ENROLLMENT','Datos de matrícula incompletos.');
    const [course,group,m]=await Promise.all([
     db.ref(`${root}/courses/${courseId}/profile`).once('value'),
     db.ref(`${root}/courses/${courseId}/groups/${groupId}/profile`).once('value'),
     db.ref(`memberships/${studentUid}/${id}`).once('value')
    ]).then(xs=>xs.map(x=>x.val()));
    if(!course||course.status!=='active')throw httpError(404,'COURSE_NOT_FOUND','No existe el curso activo.');
    if(!group||group.status!=='active')throw httpError(404,'GROUP_NOT_FOUND','No existe el grupo activo.');
    if(!m||m.status!=='active'||m.role!=='student')throw httpError(400,'STUDENT_NOT_ACTIVE','El estudiante no tiene membresía activa en esta institución.');
    updates[`${root}/courses/${courseId}/groups/${groupId}/enrollments/${studentUid}`]={status:'active',enrolledAt:now,enrolledBy:ctx.user.uid};
   }else throw httpError(400,'UNKNOWN_ACTION','Operación académica no reconocida.');

   const auditRef=db.ref('auditLogs').push();
   updates[`auditLogs/${auditRef.key}`]={actorUid:ctx.user.uid,action:`academic.${action}`,institutionId:id,createdAt:now,details:{academicYearId:year,...(action==='createCourse'?{courseId:data.courseId}:{}),...(action==='createGroup'?{courseId:data.courseId,groupId:data.groupId}:{}),...(action==='assignTeacher'?{courseId:data.courseId,groupId:data.groupId,teacherUid:data.teacherUid}:{}),...(action==='enrollStudent'?{courseId:data.courseId,groupId:data.groupId,studentUid:data.studentUid}:{})}};
   // Una sola actualización multi-ruta: los datos académicos y su auditoría se guardan juntos.
   await db.ref().update(updates);
   return res.status(200).json({ok:true,action,academicYearId:year});
  }catch(e){
   console.error('[academic/manage]',e.code||e.message||'UNKNOWN');
   return res.status(e.status||500).json({code:e.code||'ACADEMIC_OPERATION_FAILED',message:e.status?e.message:'No fue posible completar la operación académica.'});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
