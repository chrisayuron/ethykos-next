const { getAdmin } = require('../lib/api/firebaseAdmin');
const { requireGlobalAdmin } = require('../lib/api/accessControl');
const ADMIN='8mheoQqcekSQkpK5S8qTonUWKt83';
const PHRASE='REINICIAR ETHYKOS NEXT';
const ROOTS=['institutions','academicYears','memberships','institutionMembers','institutionSlugs','identityIndex','studentSecrets','security','auditLogs','institutionAssignments','learningRecords','teacherFeedback'];
module.exports=async function(req,res){
 const action=String(req.query?.action||'');
 if(action==='students-create'||action==='invitations-create'){
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  return res.status(410).json({code:action==='students-create'?'LEGACY_STUDENT_CREATION_DISABLED':'EMAIL_INVITATIONS_DISABLED'});
 }
 if(!['firebase-reset-preview','firebase-reset-export','firebase-reset-execute'].includes(action))return res.status(404).json({code:'LEGACY_ACTION_NOT_FOUND'});
 try{
  const app=getAdmin(),{user}=await requireGlobalAdmin(req,app);
  if(user.uid!==ADMIN)return res.status(403).json({code:'GLOBAL_ADMIN_REQUIRED'});
  const db=app.database(),snap=await db.ref('/').once('value'),root=snap.val()||{};
  if(!root.users?.[ADMIN])return res.status(409).json({code:'GLOBAL_ADMIN_PROFILE_MISSING',message:'No se encontró el perfil del administrador global.'});
  const ids=Object.keys(root.users||{}).filter(uid=>uid!==ADMIN);
  if(action==='firebase-reset-preview'){
   const counts={};for(const k of ROOTS)counts[k]=root[k]?Object.keys(root[k]).length:0;
   return res.status(200).json({ok:true,projectId:process.env.FIREBASE_PROJECT_ID,globalAdminPreserved:true,authAccountsToDelete:ids.length,authUids:ids,rootsToClear:ROOTS,counts,platformPreserved:Object.hasOwn(root,'platform'),nextStep:'Descarga respaldo completo antes de confirmar.'});
  }
  if(action==='firebase-reset-export'){
   res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="ethykos-firebase-backup.json"');res.setHeader('Cache-Control','no-store');
   return res.status(200).send(JSON.stringify({exportedAt:new Date().toISOString(),projectId:process.env.FIREBASE_PROJECT_ID,data:root}));
  }
  if(req.method!=='POST')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const body=req.body||{};
  if(body.confirmation!==PHRASE||body.backupDownloaded!==true||body.expectedAdminUid!==ADMIN)return res.status(400).json({code:'RESET_CONFIRMATION_REQUIRED',message:'Se requiere frase exacta, respaldo descargado y UID administrador confirmado.'});
  const deleted=[],failed=[];
  for(const uid of ids){try{await app.auth().deleteUser(uid);deleted.push(uid);}catch(e){if(e.code==='auth/user-not-found')deleted.push(uid);else failed.push({uid,code:e.code||'AUTH_DELETE_FAILED'});}}
  if(failed.length)return res.status(207).json({ok:false,code:'AUTH_CLEANUP_INCOMPLETE',deletedAuthCount:deleted.length,failedAuth:failed,message:'Se detuvo la limpieza de Realtime Database.'});
  const updates={};for(const k of ROOTS)updates[k]=null;for(const uid of ids)updates['users/'+uid]=null;
  await db.ref('/').update(updates);
  return res.status(200).json({ok:true,deletedAuthCount:deleted.length,globalAdminPreserved:true,platformPreserved:true,clearedRoots:ROOTS,message:'Datos de prueba eliminados; reglas y configuración Firebase no modificadas.'});
 }catch(e){console.error('[firebase-reset]',e.code||e.message||'UNKNOWN');return res.status(e.status||500).json({code:e.code||'FIREBASE_RESET_FAILED',message:e.status?e.message:'Error en mantenimiento Firebase.'});}
};
