const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../api/academic/institutions');

test('lista instituciones activas solo para administrador global',async()=>{
  const data={institutions:{
    instA:{profile:{name:'Colegio A',status:'active',academicYear:'2027'}},
    instB:{profile:{name:'Colegio B',status:'suspended'}}
  }};
  const app={database:()=>({ref:()=>({once:async()=>({val:()=>data.institutions})})})};
  let authorized=false;
  const handler=createHandler({getAdminFn:()=>app,requireGlobalAdminFn:async()=>{authorized=true;return {user:{uid:'global'}};}});
  let status=200,payload;
  const res={status(n){status=n;return this;},json(v){payload=v;return this;}};
  await handler({method:'GET'},res);
  assert.equal(status,200);
  assert.equal(authorized,true);
  assert.deepEqual(payload.institutions.map(x=>x.institutionId),['instA']);
  assert.equal(payload.institutions[0].institution.academicYear,'2027');
});

test('rechaza métodos distintos de GET',async()=>{
  const handler=createHandler();
  let status=200;
  const res={status(n){status=n;return this;},json(){return this;}};
  await handler({method:'POST'},res);
  assert.equal(status,405);
});
