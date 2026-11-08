const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../api/academic/manage');

function getAt(root,path){return path.split('/').filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],root);}
function setAt(root,path,value){const parts=path.split('/').filter(Boolean);let node=root;for(const p of parts.slice(0,-1))node=node[p]??(node[p]={});node[parts.at(-1)]=value;}
function fixture(){
 const data={
  institutions:{instA:{profile:{name:'Institución A',status:'active',academicYear:'2027'}}},
  memberships:{teacher1:{instA:{role:'teacher',status:'active'}},student1:{instA:{role:'student',status:'active'}}},
  institutionMembers:{instA:{teacher1:{uid:'teacher1',displayName:'Docente Uno',email:'docente@test.co',role:'teacher',status:'active'},student1:{uid:'student1',displayName:'Estudiante Uno',email:'estudiante@test.co',role:'student',status:'active'}}},
  academicYears:{instA:{2027:{courses:{}}}}
 };
 let pushId=0;
 const db={ref(path=''){
  return {key:`audit${++pushId}`,once:async()=>({val:()=>getAt(data,path)||null}),push(){return {key:`audit${++pushId}`}},update:async updates=>{for(const [p,v] of Object.entries(updates))setAt(data,p,v);}};
 }};
 const app={database:()=>db};
 const requireGlobalAdminFn=async()=>({user:{uid:'8mheoQqcekSQkpK5S8qTonUWKt83'}});
 const handler=createHandler({getAdminFn:()=>app,requireGlobalAdminFn});
 async function call(body,method='POST',query={}){let status=200,payload;const res={status(n){status=n;return this;},json(d){payload=d;return this;}};await handler({method,body,query},res);return {status,payload};}
 return {data,call};
}

test('flujo académico completo crea año, curso, grupo, asignación, matrícula y auditoría',async()=>{
 const {data,call}=fixture();
 let r=await call({institutionId:'instA',academicYearId:'2027',action:'createYear',data:{name:'Año lectivo 2027',startsAt:'2027-01-15',endsAt:'2027-11-30'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'createCourse',data:{courseId:'grado6',name:'Sexto',gradeLevel:'6'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{courseId:'grado6',groupId:'6A',name:'Sexto A'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{courseId:'grado6',groupId:'6A',teacherUid:'teacher1'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'enrollStudent',data:{courseId:'grado6',groupId:'6A',studentUid:'student1'}});assert.equal(r.status,200);
 const group=data.academicYears.instA[2027].courses.grado6.groups['6A'];
 assert.equal(group.teachers.teacher1.status,'active');assert.equal(group.enrollments.student1.status,'active');
 const audit=Object.values(data.auditLogs||{});assert.equal(audit.length,5);assert.deepEqual(audit.map(x=>x.action),['academic.createYear','academic.createCourse','academic.createGroup','academic.assignTeacher','academic.enrollStudent']);
});

test('no asigna docente si el curso está inactivo',async()=>{
 const {data,call}=fixture();data.academicYears.instA[2027].courses.grado6={profile:{name:'Sexto',status:'inactive'},groups:{"6A":{profile:{name:'Sexto A',status:'active'}}}};
 const r=await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{courseId:'grado6',groupId:'6A',teacherUid:'teacher1'}});
 assert.equal(r.status,404);assert.equal(r.payload.code,'COURSE_NOT_FOUND');assert.equal(Object.keys(data.auditLogs||{}).length,0);
});

test('no matricula estudiante si el curso está inactivo',async()=>{
 const {data,call}=fixture();data.academicYears.instA[2027].courses.grado6={profile:{name:'Sexto',status:'inactive'},groups:{"6A":{profile:{name:'Sexto A',status:'active'}}}};
 const r=await call({institutionId:'instA',academicYearId:'2027',action:'enrollStudent',data:{courseId:'grado6',groupId:'6A',studentUid:'student1'}});
 assert.equal(r.status,404);assert.equal(r.payload.code,'COURSE_NOT_FOUND');assert.equal(Object.keys(data.auditLogs||{}).length,0);
});

test('rechaza fechas de año académico invertidas',async()=>{
 const {data,call}=fixture();const r=await call({institutionId:'instA',academicYearId:'2027',action:'createYear',data:{name:'2027',startsAt:'2027-12-01',endsAt:'2027-01-01'}});
 assert.equal(r.status,400);assert.equal(r.payload.code,'INVALID_DATE_RANGE');assert.equal(Object.keys(data.auditLogs||{}).length,0);
});

test('GET devuelve cursos, grupos y usuarios activos de la institución autorizada',async()=>{
 const {data,call}=fixture();
 data.academicYears.instA[2027].courses.grado6={profile:{name:'Sexto',gradeLevel:'6',status:'active'},groups:{'6A':{profile:{name:'Sexto A',status:'active'},teachers:{teacher1:{status:'active'}},enrollments:{student1:{status:'active'}}}}};
 const r=await call({},'GET',{institutionId:'instA',academicYearId:'2027'});
 assert.equal(r.status,200);assert.equal(r.payload.courses[0].groups[0].teachers[0],'teacher1');assert.equal(r.payload.courses[0].groups[0].students[0],'student1');assert.equal(r.payload.teachers.length,1);assert.equal(r.payload.students.length,1);
});
