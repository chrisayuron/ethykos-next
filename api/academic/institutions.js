const getAdmin = () => require('../../lib/api/firebaseAdmin').getAdmin();
const { requireGlobalAdmin, httpError } = require('../../lib/api/accessControl');

function createHandler({getAdminFn=getAdmin,requireGlobalAdminFn=requireGlobalAdmin}={}){
  return async function(req,res){
    if(req.method!=='GET') return res.status(405).json({code:'METHOD_NOT_ALLOWED',message:'Método no permitido.'});
    try{
      const app=getAdminFn();
      await requireGlobalAdminFn(req,app);
      const snap=await app.database().ref('institutions').once('value');
      const raw=snap.val()||{};
      const institutions=Object.entries(raw)
        .map(([institutionId,item])=>({institutionId,profile:item?.profile||{}}))
        .filter(x=>x.profile.status==='active')
        .map(x=>({institutionId:x.institutionId,institution:{
          name:x.profile.name||'Institución',
          shortName:x.profile.shortName||'',
          academicYear:x.profile.academicYear||'',activeAcademicYearId:Object.prototype.hasOwnProperty.call(x.profile,'activeAcademicYearId')?x.profile.activeAcademicYearId:(x.profile.academicYear||null)
        }}))
        .sort((a,b)=>a.institution.name.localeCompare(b.institution.name,'es'));
      return res.status(200).json({institutions});
    }catch(error){
      console.error('[academic/institutions]',error.code||error.message||'UNKNOWN');
      return res.status(error.status||500).json({
        code:error.code||'INSTITUTIONS_LOAD_FAILED',
        message:error.status?error.message:'No fue posible consultar las instituciones.'
      });
    }
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
