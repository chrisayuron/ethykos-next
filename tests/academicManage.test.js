const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../api/academic/manage');
function getAt(o,p){return p.split('/').filter(Boolean).reduce((v,k)=>v&&v[k],o)??null;}
function setAt(o,p,value){const a=p.split('/').filter(Boolean);let n=o;for(const k of a.slice(0,-1))n=n[k]??(n[k]={});n[a.at(-1)]=value;}
function fixture(){
 const data={institutions:{instA:{profile:{name:'Institución A',status:'active',academicYear:'2027',activeAcademicYearId:'2027'}}},memberships:{teacher1:{instA:{role:'teacher',status:'active'}},teacher2:{instA:{role:'teacher',status:'active'}},student1:{instA:{role:'student',status:'active'}},student2:{instA:{role:'student',status:'active'}}},academicYears:{instA:{2027:{profile:{name:'Año 2027',status:'active'},groups:{}}}}};
 let seq=0;const db={ref(path=''){return{key:`audit${++seq}`,once:async()=>({val:()=>getAt(data,path)}),push(){return{key:`audit${++seq}`}},update:async u=>{for(const[p,v]of Object.entries(u))setAt(data,p,v);}};}};
 const app={database:()=>db};const requireGlobalAdminFn=async()=>({user:{uid:'8mheoQqcekSQkpK5S8qTonUWKt83'}});const handler=createHandler({getAdminFn:()=>app,requireGlobalAdminFn});
 async function call(body,method='POST',query={}){let status=200,payload;const res={status(n){status=n;return this;},json(d){payload=d;return this;}};await handler({method,body,query},res);return{status,payload};}
 return{data,call};
}
test('crea un grupo directamente como 6A, asigna un solo docente y matricula estudiantes',async()=>{
 const{data,call}=fixture();let r=await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{groupId:'6A',name:'Sexto A',gradeLevel:'6'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{groupId:'6A',teacherUid:'teacher1'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{groupId:'6A',teacherUid:'teacher2'}});assert.equal(r.status,200);
 r=await call({institutionId:'instA',academicYearId:'2027',action:'enrollStudent',data:{groupId:'6A',studentUid:'student1'}});assert.equal(r.status,200);
 const g=data.academicYears.instA[2027].groups['6A'];assert.equal(g.teacher.uid,'teacher2');assert.equal(g.enrollments.student1.status,'active');
});
test('no permite matricular al mismo estudiante en dos grupos del mismo año',async()=>{
 const{call}=fixture();await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{groupId:'6A',name:'Sexto A'}});await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{groupId:'6B',name:'Sexto B'}});await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{groupId:'6A',teacherUid:'teacher1'}});await call({institutionId:'instA',academicYearId:'2027',action:'assignTeacher',data:{groupId:'6B',teacherUid:'teacher1'}});await call({institutionId:'instA',academicYearId:'2027',action:'enrollStudent',data:{groupId:'6A',studentUid:'student1'}});const r=await call({institutionId:'instA',academicYearId:'2027',action:'enrollStudent',data:{groupId:'6B',studentUid:'student1'}});assert.equal(r.status,409);assert.equal(r.payload.code,'STUDENT_ALREADY_ENROLLED');
});
test('cierra el año lectivo y elimina la referencia de año activo sin borrar su historial',async()=>{
 const{data,call}=fixture();data.academicYears.instA[2027].groups['6A']={profile:{name:'Sexto A',status:'active'}};const r=await call({institutionId:'instA',academicYearId:'2027',action:'closeYear'});assert.equal(r.status,200);assert.equal(data.academicYears.instA[2027].profile.status,'closed');assert.equal(data.institutions.instA.profile.activeAcademicYearId,null);assert.ok(data.academicYears.instA[2027].groups['6A']);
});
test('prepara un nuevo año y no permite activarlo mientras el anterior siga activo',async()=>{
 const{data,call}=fixture();let r=await call({institutionId:'instA',academicYearId:'2028',action:'createYear',data:{name:'Año 2028'}});assert.equal(r.status,200);assert.equal(data.academicYears.instA[2028].profile.status,'preparing');r=await call({institutionId:'instA',academicYearId:'2028',action:'activateYear'});assert.equal(r.status,409);assert.equal(r.payload.code,'ACTIVE_YEAR_MUST_CLOSE');
});
test('activa el año nuevo después de cerrar el anterior',async()=>{
 const{data,call}=fixture();await call({institutionId:'instA',academicYearId:'2028',action:'createYear',data:{name:'Año 2028'}});await call({institutionId:'instA',academicYearId:'2027',action:'closeYear'});const r=await call({institutionId:'instA',academicYearId:'2028',action:'activateYear'});assert.equal(r.status,200);assert.equal(data.institutions.instA.profile.activeAcademicYearId,'2028');assert.equal(data.academicYears.instA[2028].profile.status,'active');
});
test('no permite modificar grupos en un año cerrado',async()=>{
 const{data,call}=fixture();data.academicYears.instA[2027].profile.status='closed';const r=await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{groupId:'6A',name:'Sexto A'}});assert.equal(r.status,409);assert.equal(r.payload.code,'YEAR_NOT_ACTIVE');
});
test('GET devuelve años, grupos, docente y estudiantes',async()=>{
 const{data,call}=fixture();data.academicYears.instA[2027].groups['6A']={profile:{name:'Sexto A',gradeLevel:'6',status:'active'},teacher:{uid:'teacher1',status:'active'},enrollments:{student1:{status:'active'}}};const r=await call({},'GET',{institutionId:'instA',academicYearId:'2027'});assert.equal(r.status,200);assert.equal(r.payload.groups[0].teacherUid,'teacher1');assert.deepEqual(r.payload.groups[0].students,['student1']);assert.equal(r.payload.teachers.length,2);assert.equal(r.payload.students.length,2);
});
test('rechaza fechas invertidas',async()=>{const{call}=fixture();const r=await call({institutionId:'instA',academicYearId:'2028',action:'createYear',data:{name:'2028',startsAt:'2028-12-01',endsAt:'2028-01-01'}});assert.equal(r.status,400);assert.equal(r.payload.code,'INVALID_DATE_RANGE');});

test('rechaza identificadores que no corresponden a grupos de 6.º a 11.º',async()=>{
 const{call}=fixture();
 for(const groupId of ['6','6-A','5A','12A','6a','CURSO6']) {
  const r=await call({institutionId:'instA',academicYearId:'2027',action:'createGroup',data:{groupId,name:'Grupo de prueba'}});
  assert.equal(r.status,400,groupId);
  assert.equal(r.payload.code,'INVALID_GROUP',groupId);
 }
});
test('ignora cualquier estructura antigua courses > groups',async()=>{
 const{data,call}=fixture();
 data.academicYears.instA[2027].courses={grade6:{groups:{'6A':{profile:{name:'Grupo legado',status:'active'},teachers:{teacher1:{status:'active'}},enrollments:{student1:{status:'active'}}}}}};
 const r=await call({},'GET',{institutionId:'instA',academicYearId:'2027'});
 assert.equal(r.status,200);
 assert.deepEqual(r.payload.groups,[]);
});
