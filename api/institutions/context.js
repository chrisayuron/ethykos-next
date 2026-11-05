const {requireVerifiedUser,listActiveInstitutionContexts}=require('../_lib/accessControl');
const {getAdmin}=require('../_lib/firebaseAdmin');

module.exports=async function(req,res){
  if(req.method!=='GET') return res.status(405).json({code:'METHOD_NOT_ALLOWED',message:'Método no permitido.'});
  try{
    const app=getAdmin();
    const user=await requireVerifiedUser(req,app);
    const institutions=await listActiveInstitutionContexts(user.uid,app);
    return res.status(200).json({uid:user.uid,email:user.email||null,institutions});
  }catch(error){
    console.error('[V4.13.0 institutions/context]',error.code||error.message||'UNKNOWN');
    return res.status(error.status||500).json({code:error.code||'CONTEXT_LOAD_FAILED',message:error.status?error.message:'No fue posible consultar tus instituciones.'});
  }
};
