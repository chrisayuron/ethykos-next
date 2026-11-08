const test=require('node:test');
const assert=require('node:assert/strict');
const {requireVerifiedUser,requireGlobalAdmin,requireInstitutionRole,listActiveInstitutionContexts}=require('../api/_lib/accessControl');

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
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'teacher',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio Demo',status:'active'}}}}});
  const result=await requireInstitutionRole(request,'schoolA',['teacher'],app);
  assert.equal(result.institution.name,'Colegio Demo');
});
test('rechaza membresía inactiva y rol distinto',async()=>{
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'student',status:'inactive'}}},institutions:{schoolA:{profile:{name:'Colegio Demo',status:'active'}}}}});
  await assert.rejects(()=>requireInstitutionRole(request,'schoolA',['teacher'],app),e=>e.code==='INSTITUTION_ACCESS_DENIED');
});
test('solo devuelve contextos activos del propio usuario',async()=>{
  const app=fakeApp({data:{memberships:{'teacher-1':{schoolA:{role:'teacher',status:'active'},schoolB:{role:'teacher',status:'inactive'},schoolC:{role:'student',status:'active'}}},institutions:{schoolA:{profile:{name:'Colegio A',status:'active'}},schoolC:{profile:{name:'Colegio C',status:'suspended'}}}}});
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
