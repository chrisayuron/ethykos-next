const {test,before,after}=require('node:test');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {ref,set,get}=require('firebase/database');
const rules=fs.readFileSync('database.rules.json','utf8');
let env;
const adminUid='8mheoQqcekSQkpK5S8qTonUWKt83';
const ids={admin:'instAdminA',teacher:'teacherA',student:'studentA',other:'studentB',outsider:'outsider',teacherB:'teacherB'};
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-ethykos-next',database:{host:'127.0.0.1',port:9000,rules}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.database();
  await set(ref(db,'institutions/instA/profile'),{name:'Institución A',status:'active',academicYear:'2026'});
  await set(ref(db,'institutions/instB/profile'),{name:'Institución B',status:'active',academicYear:'2026'});
  const memberships={};
  memberships[`memberships/${ids.admin}/instA`]={role:'institution_admin',status:'active'};
  memberships[`memberships/${ids.teacher}/instA`]={role:'teacher',status:'active'};
  memberships[`memberships/${ids.student}/instA`]={role:'student',status:'active'};
  memberships[`memberships/${ids.other}/instA`]={role:'student',status:'active'};
  memberships[`memberships/${ids.teacherB}/instB`]={role:'teacher',status:'active'};
  await Promise.all(Object.entries(memberships).map(([p,v])=>set(ref(db,p),v)));
  await set(ref(db,'academicYears/instA/2026/profile'),{name:'2026',status:'active'});
  await set(ref(db,'academicYears/instA/2026/courses/course6/profile'),{name:'Sexto',gradeLevel:'6',status:'active'});
  await set(ref(db,'academicYears/instA/2026/courses/course6/groups/6A/profile'),{name:'6A',status:'active'});
  await set(ref(db,'academicYears/instA/2026/courses/course6/groups/6B/profile'),{name:'6B',status:'active'});
  await set(ref(db,'academicYears/instA/2026/courses/course6/groups/6A/teachers/teacherA'),{status:'active'});
  await set(ref(db,'academicYears/instA/2026/courses/course6/groups/6A/enrollments/studentA'),{status:'active'});
  await set(ref(db,'institutionAssignments/instA/asg1'),{academicYearId:'2026',courseId:'course6',groupId:'6A'});
  await set(ref(db,'learningRecords/instA/studentA/asg1'),{sessions:{s1:{score:80}}});
 });
});
after(async()=>{await env.cleanup();});
const ctx=uid=>env.authenticatedContext(uid,{email_verified:true}).database();
test('administrador institucional puede leer y gestionar año académico propio',async()=>{
 const db=ctx(ids.admin);
 await assertSucceeds(get(ref(db,'academicYears/instA/2026/profile')));
 await assertSucceeds(set(ref(db,'academicYears/instA/2026/courses/course7/profile'),{name:'Séptimo',gradeLevel:'7',status:'active'}));
 await assertFails(get(ref(db,'academicYears/instB/2026/profile')));
});
test('docente lee estructura institucional asignada pero no crea cursos',async()=>{
 const db=ctx(ids.teacher);
 await assertSucceeds(get(ref(db,'academicYears/instA/2026/courses/course6/groups/6A/profile')));
 await assertFails(get(ref(db,'academicYears/instA/2026/courses/course6/groups/6B/profile')));
 await assertFails(set(ref(db,'academicYears/instA/2026/courses/course7/profile'),{name:'Intruso',status:'active'}));
 await assertFails(get(ref(db,'academicYears/instB/2026/profile')));
});
test('estudiante lee su institución y no puede escribir cursos ni progreso directamente',async()=>{
 const db=ctx(ids.student);
 await assertSucceeds(get(ref(db,'academicYears/instA/2026/courses/course6/groups/6A/profile')));
 await assertFails(set(ref(db,'academicYears/instA/2026/courses/course7/profile'),{name:'Intruso',status:'active'}));
 await assertFails(set(ref(db,'learningRecords/instA/studentA/asg1/sessions/s1'),{score:100}));
});
test('un estudiante no puede leer progreso de otro estudiante',async()=>{
 const db=ctx(ids.student);
 await assertFails(get(ref(db,'learningRecords/instA/studentB/asg1')));
});
test('un usuario de otra institución no puede leer datos académicos de la institución A',async()=>{
 const db=ctx(ids.teacherB);
 await assertFails(get(ref(db,'academicYears/instA/2026/courses/course6/profile')));
 await assertFails(get(ref(db,'learningRecords/instA/studentA/asg1')));
});
