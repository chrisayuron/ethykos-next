module.exports=async function(req,res){
 const action=String(req.query?.action||'');
 if(action==='students-create'||action==='invitations-create'){
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  return res.status(410).json({code:action==='students-create'?'LEGACY_STUDENT_CREATION_DISABLED':'EMAIL_INVITATIONS_DISABLED'});
 }
 return res.status(404).json({code:'LEGACY_ACTION_NOT_FOUND'});
};
