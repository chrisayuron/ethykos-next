const test=require('node:test');
const assert=require('node:assert/strict');
const {requireVerifiedUser,requireGlobalAdmin,requireInstitutionRole,listActiveInstitutionContexts}=require('../lib/api/accessControl');

function fakeApp({token={uid:'teacher-1',email:'teacher@example.com',email_verified:true},data={}}={}){
  return {
    auth:()=>({verifyIdToken:async value=>{if(value!=='valid-token')throw new Error('bad token');return token;}}),
    database:()=>({ref:path=>({once:async()=>({val:()=>path.split('/').reduce((v,k)=>v&&v[k],data)??null})})})
  };
}
const request={headers:{authorization:'Bearer valid-token'}};

test('rechaza solicitudes sin token',async()=>{
  await assert.rejects(()=>requireVerifiedUser({headers:{}},fakeApp()),e=>e.status===401&&e.code==='UNAUTHORIZED');
});
test('exige correo verificado',async()=>{
  await assert.rejects(()=>requireVerifiedUser(request,fakeApp({token:{uid:'x',email_verified:false}})),e=>e.status===403&&e.code==='EMAIL_NOT_VERIFIED');
});
test('autoriza rol activo en institución activa',async()=>{
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'teacher',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio Demo',status:'active',academicYear:'2027'}}},academicYears:{schoolA:{2027:{profile:{status:'active'}}}}}});
  const result=await requireInstitutionRole(request,'schoolA',['teacher'],app);
  assert.equal(result.institution.name,'Colegio Demo');
});
test('rechaza membresía inactiva y rol distinto',async()=>{
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'student',status:'inactive'}}},institutions:{schoolA:{profile:{name:'Colegio Demo',status:'active',academicYear:'2027'}}},academicYears:{schoolA:{2027:{profile:{status:'active'}}}}}});
  await assert.rejects(()=>requireInstitutionRole(request,'schoolA',['teacher'],app),e=>e.code==='INSTITUTION_ACCESS_DENIED');
});
test('solo devuelve contextos activos del propio usuario',async()=>{
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'teacher',status:'active'},schoolB:{role:'teacher',status:'inactive'},schoolC:{role:'student',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio A',status:'active',academicYear:'2027'}},schoolC:{profile:{name:'Colegio C',status:'suspended'}}},academicYears:{schoolA:{2027:{profile:{status:'active'},groups:{'6A':{profile:{status:'active'},teacher:{uid:'teacher-1',status:'active'}}}}}}}});
  const result=await listActiveInstitutionContexts('teacher-1',app);
  assert.equal(result.length,1);assert.equal(result[0].institutionId,'schoolA');assert.equal(result[0].role,'teacher');
});

test('autoriza al administrador global sin exigir membresía institucional',async()=>{
  const app=fakeApp({token:{uid:'8mheoQqcekSQkpK5S8qTonUWKt83',email:'admin@example.com',email_verified:true}});
  const result=await requireGlobalAdmin(request,app);
  assert.equal(result.user.uid,'8mheoQqcekSQkpK5S8qTonUWKt83');
});
test('rechaza a docentes y estudiantes en operaciones globales',async()=>{
  const app=fakeApp({token:{uid:'teacher-1',email:'teacher@example.com',email_verified:true}});
  await assert.rejects(()=>requireGlobalAdmin(request,app),e=>e.status===403&&e.code==='GLOBAL_ADMIN_REQUIRED');
});

test('no expone contextos con el antiguo rol institution_admin',async()=>{
 const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'institution_admin',status:'active'},schoolB:{role:'teacher',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio A',status:'active',academicYear:'2027'}},schoolB:{profile:{name:'Colegio B',status:'active',academicYear:'2027'}}},academicYears:{schoolA:{2027:{profile:{status:'active'}}},schoolB:{2027:{profile:{status:'active'},groups:{'6A':{profile:{status:'active'},teacher:{uid:'teacher-1',status:'active'}}}}}}}});
 const result=await listActiveInstitutionContexts('teacher-1',app);
 assert.deepEqual(result.map(x=>x.institutionId),['schoolB']);
});

test('administrador global obtiene todas las instituciones activas sin membresías',async()=>{
 const uid='8mheoQqcekSQkpK5S8qTonUWKt83';
 const app=fakeApp({data:{institutions:{schoolA:{profile:{name:'Colegio A',status:'active'}},schoolB:{profile:{name:'Colegio B',status:'inactive'}},schoolC:{profile:{name:'Colegio C',status:'active'}}}}});
 const result=await listActiveInstitutionContexts(uid,app);
 assert.deepEqual(result.map(x=>x.institutionId),['schoolA','schoolC']);
 assert.equal(result[0].role,'global_admin');
});

test('bloquea contexto institucional cuando el año lectivo está cerrado',async()=>{const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'teacher',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio A',status:'active',academicYear:'2027'}}},academicYears:{schoolA:{2027:{profile:{status:'closed'}}}}}});const result=await listActiveInstitutionContexts('teacher-1',app);assert.equal(result.length,0);await assert.rejects(()=>requireInstitutionRole(request,'schoolA',['teacher'],app),e=>e.code==='ACADEMIC_YEAR_CLOSED');});
test('no habilita docentes ni estudiantes sin asignación en un grupo del año activo',async()=>{
 const app=fakeApp({token:{uid:'student-1',email:'student@example.invalid',email_verified:true},data:{memberships:{'student-1':{schoolA:{role:'student',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio A',status:'active',academicYear:'2027'}}},academicYears:{schoolA:{2027:{profile:{status:'active'},groups:{'6A':{profile:{status:'active'},enrollments:{}}}}}}}});
 const result=await listActiveInstitutionContexts('student-1',app);assert.equal(result.length,0);
});
