/**
 * Private school-management API hosted on Google Cloud Run.
 *
 * Uses Cloud Run's attached service-account identity (Application Default
 * Credentials), not a service-account private key in GitHub or the browser.
 * Public HTTP invoker is intentional: every /api route requires a VERIFIED
 * Firebase ID token (with checkRevoked=true), trusted admin custom claims,
 * and matching active Firestore profile. This is NOT a public sign-up API.
 */
import { createServer } from 'node:http';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.PROJECT_ID || 'upper-homadola-school';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://lakshandulip.github.io';
const PORT = Number(process.env.PORT || 8080);
initializeApp({credential:applicationDefault(),projectId:PROJECT_ID});
const auth = getAuth(), db = getFirestore();
const usernamePattern = /^[a-z0-9_-]{1,40}$/;
const studentIdPattern = /^[a-z0-9_-]{1,40}$/;
const invalidStudentPrefix = /^(?:admin(?:2)?|superadmin|principal|developer|tch-)/;
const roles = new Set(['student','teacher']);
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json = (res, status, data, origin='')=>{
 res.writeHead(status,{...JSON_HEADERS,...(origin===ALLOWED_ORIGIN?{'access-control-allow-origin':ALLOWED_ORIGIN,'vary':'Origin'}:{})});
 res.end(JSON.stringify(data));
};
function checkText(value,max=120){
 return typeof value==='string' && value.trim().length>=2 && value.trim().length<=max && !/[<>\u0000-\u001f]/.test(value);
}
function validGrade(v){return Number.isInteger(v)&&v>=1&&v<=11}
function validSubjects(value){
 return Array.isArray(value) && value.length<=20 &&
  value.every(v=>typeof v==='string'&&v.length>=2&&v.length<=60&&!/[<>\u0000-\u001f]/.test(v));
}
function validGrades(value){
 return Array.isArray(value) && value.length<=11 &&
  value.every(validGrade)&&new Set(value).size===value.length;
}
function fail(code,message){const e=new Error(message);e.status=code;throw e}
function validateCreate(body,role){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid request');
 const displayName=String(body.displayName||'').trim();
 if(!checkText(displayName))fail(400,'Enter a valid name (2–120 characters)');
 const password=body.password;
 if(typeof password!=='string'||password.length<(role==='student'?6:12)||password.length>128)fail(400,role==='student'?'Student password must contain 6–128 characters':'Teacher password must contain 12–128 characters');
 if(role==='student'&&!/^[A-Z]{2}[0-9]{4}$/.test(password))fail(400,'Student initial password must contain exactly two uppercase letters and four digits');
 if(body.role==='student'&&password.toLowerCase()===String(body.admissionNumber||'').trim().toLowerCase())fail(400,'Admission number cannot be used as the password');
 if(role==='student'){
  const admissionNumber=String(body.admissionNumber||'').trim().toLowerCase();
  if(!studentIdPattern.test(admissionNumber)||invalidStudentPrefix.test(admissionNumber))fail(400,'Invalid or reserved admission number');
  if(!validGrade(body.grade))fail(400,'Choose a grade from 1 to 11');
  return {displayName,password,username:admissionNumber,grade:body.grade};
 }
 if(!validSubjects(body.subjects||[])||!validGrades(body.assignedGrades||[]))fail(400,'Invalid subject or assigned grade list');
 return {displayName,password,subjects:[...new Set(body.subjects||[])],assignedGrades:body.assignedGrades||[]};
}
function sanitizeProfile(doc){
 const x=doc.data();
 return {
  uid:doc.id,username:x.username||'',displayName:x.displayName||'',
  role:x.role,active:x.active===true,
  ...(x.role==='student'?{grade:x.grade??null}:{}),
  ...(x.role==='teacher'?{subjects:x.subjects||[],assignedGrades:x.assignedGrades||[]}:{}),
 };
}
async function authenticatedAdmin(req){
 const header=req.headers.authorization||'';
 if(!header.startsWith('Bearer '))fail(401,'Sign in required');
 let verified;
 try{verified=await auth.verifyIdToken(header.slice(7),true)}
 catch{fail(401,'Session expired or invalid. Sign in again')}
 if(verified.schoolAccess!==true||verified.role!=='admin')fail(403,'Administrator permission required');
 const actor=await db.doc('users/'+verified.uid).get();
 if(!actor.exists||actor.get('active')!==true||actor.get('role')!=='admin')fail(403,'Administrator account is not active');
 return verified.uid;
}
async function readBody(req){
 let text='';
 for await(const chunk of req){
  text+=chunk.toString('utf8');
  if(Buffer.byteLength(text,'utf8')>16384)fail(413,'Request too large');
 }
 try{return JSON.parse(text)}
 catch{fail(400,'Invalid JSON body')}
}
async function allocateTeacherId(){
 const counter=db.doc('_system/teacherSequence');
 return db.runTransaction(async tx=>{
  const snapshot=await tx.get(counter);
  const current=snapshot.exists?snapshot.get('lastNumber'):0;
  if(!Number.isSafeInteger(current)||current<0||current>=999999)fail(500,'Teacher ID sequence configuration error');
  const next=current+1;
  tx.set(counter,{lastNumber:next,updatedAt:FieldValue.serverTimestamp()});
  return 'TCH-'+String(next).padStart(4,'0');
 });
}
async function createAccount(role,body,actor){
 const input=validateCreate(body,role);
 const username=role==='teacher'?await allocateTeacherId():input.username;
 const normalized=username.toLowerCase();
 if(!usernamePattern.test(normalized))fail(400,'Invalid school username');
 const email='u-'+normalized+'@accounts.upperhomadola.school';
 let user;
 try{
  // Create disabled first: cannot sign in until all trusted records are ready.
  user=await auth.createUser({email,password:input.password,displayName:input.displayName,disabled:true,emailVerified:false});
 }catch(err){
  if(err.code==='auth/email-already-exists')fail(409,'This school ID is already in use');
  throw err;
 }
 const profile=db.doc('users/'+user.uid),reservation=db.doc('loginNames/'+normalized),audit=db.collection('auditLogs').doc();
 try{
  await db.runTransaction(async tx=>{
   const [reserved,existingProfile]=await Promise.all([tx.get(reservation),tx.get(profile)]);
   if(reserved.exists||existingProfile.exists)fail(409,'School ID already exists');
   tx.create(reservation,{uid:user.uid,createdBy:actor,createdAt:FieldValue.serverTimestamp()});
   tx.create(profile,{
    username,role,displayName:input.displayName,active:false,
    ...(role==='student'?{grade:input.grade}:{subjects:input.subjects,assignedGrades:input.assignedGrades}),
    createdAt:FieldValue.serverTimestamp(),createdBy:actor,createdVia:'trusted-admin-api'
   });
   tx.create(audit,{action:'account.provision.requested',actorUid:actor,targetUid:user.uid,targetRole:role,at:FieldValue.serverTimestamp()});
  });
  await auth.setCustomUserClaims(user.uid,{schoolAccess:true,role});
  await auth.updateUser(user.uid,{disabled:false});
  await profile.update({active:true,activatedAt:FieldValue.serverTimestamp()});
  await db.collection('auditLogs').add({action:'account.provision.completed',actorUid:actor,targetUid:user.uid,targetRole:role,at:FieldValue.serverTimestamp()});
  return {uid:user.uid,username,role,displayName:input.displayName};
 }catch(err){
  // Preserve a disabled or inactive partial identity for manual reconciliation.
  // Never blindly overwrite, delete or reuse a potentially allocated school ID.
  try{await auth.updateUser(user.uid,{disabled:true});await auth.revokeRefreshTokens(user.uid)}catch{}
  console.error('Account provision incomplete; inspect Firebase UID for reconciliation:',user.uid);
  if(err.status===409)throw err;
  fail(500,'Account setup was incomplete. Contact the system operator; do not retry with the same ID without verification.');
 }
}
async function listAccounts(role){
 if(!roles.has(role))fail(400,'Invalid role filter');
 const snapshot=await db.collection('users').where('role','==',role).limit(100).get();
 return {accounts:snapshot.docs.map(sanitizeProfile).sort((a,b)=>a.username.localeCompare(b.username)),limit:100,moreMayExist:snapshot.size===100};
}
async function getTarget(uid){
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))fail(400,'Invalid account identifier');
 const doc=await db.doc('users/'+uid).get();
 if(!doc.exists||!roles.has(doc.get('role')))fail(404,'Student or teacher not found');
 return doc;
}
async function updateAccount(uid,body,actor){
 const target=await getTarget(uid);
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid update');
 const role=target.get('role');
 const displayName=String(body.displayName||'').trim();
 if(!checkText(displayName))fail(400,'Enter a valid name');
 let changes;
 if(role==='student'){
  if(!validGrade(body.grade))fail(400,'Choose a grade from 1 to 11');
  changes={displayName,grade:body.grade};
 }else{
  if(!validSubjects(body.subjects||[])||!validGrades(body.assignedGrades||[]))fail(400,'Invalid subject or grade assignment');
  changes={displayName,subjects:[...new Set(body.subjects||[])],assignedGrades:body.assignedGrades||[]};
 }
 // No role/username/UID writes, regardless of extra fields supplied by client.
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(target.ref);
  if(!fresh.exists||fresh.get('role')!==role)fail(409,'Account changed; please refresh');
  tx.update(target.ref,{...changes,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor});
  tx.create(db.collection('auditLogs').doc(),{actorUid:actor,targetUid:uid,targetRole:role,action:'account.profile.updated',at:FieldValue.serverTimestamp()});
 });
 return {success:true};
}
async function changeStatus(uid,body,actor){
 const target=await getTarget(uid);
 if(typeof body?.active!=='boolean')fail(400,'Provide an active status');
 const active=body.active;
 // Disable Auth before deactivating Firestore profile; inverse for activation.
 // If Firestore update fails, an account can remain disabled until repaired.
 if(!active){
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
 }
 if(active){
  const account=await auth.getUser(uid);
  if(account.customClaims?.schoolAccess!==true||account.customClaims?.role!==target.get('role'))
   fail(409,'Trusted account claims do not match; manual review required');
  await auth.updateUser(uid,{disabled:false});
 }
 await db.runTransaction(async tx=>{
  const fresh=await tx.get(target.ref);
  if(!fresh.exists||fresh.get('role')!==target.get('role'))fail(409,'Account changed; review manually');
  tx.update(target.ref,{active,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor});
  tx.create(db.collection('auditLogs').doc(),{action:active?'account.activated':'account.deactivated',actorUid:actor,targetUid:uid,targetRole:target.get('role'),at:FieldValue.serverTimestamp()});
 });
 return {success:true};
}
createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(origin&&origin!==ALLOWED_ORIGIN)return json(res,403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS'){
  res.writeHead(204,{'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600','vary':'Origin'});res.end();return;
 }
 try{
  const url=new URL(req.url||'/', 'https://internal.local');
  if(url.pathname==='/health'&&req.method==='GET')return json(res,200,{status:'ok'},origin);
  if(!url.pathname.startsWith('/api/'))fail(404,'Not found');
  const actor=await authenticatedAdmin(req);
  if(url.pathname==='/api/accounts'&&req.method==='GET')return json(res,200,await listAccounts(url.searchParams.get('role')),origin);
  if(url.pathname==='/api/accounts'&&req.method==='POST'){
   const body=await readBody(req);
   if(!roles.has(body?.role))fail(400,'Only student or teacher accounts may be provisioned');
   return json(res,201,await createAccount(body.role,body,actor),origin);
  }
  const match=url.pathname.match(/^\/api\/accounts\/([a-zA-Z0-9_-]{1,128})(\/status)?$/);
  if(match&&req.method==='PATCH'){
   const body=await readBody(req);
   const data=match[2]?await changeStatus(match[1],body,actor):await updateAccount(match[1],body,actor);
   return json(res,200,data,origin);
  }
  fail(404,'Not found');
 }catch(err){
  if(!err.status)console.error('API internal error:',err.code||err.name||'unknown');
  json(res,err.status||500,{error:err.status?err.message:'Internal server error'},origin);
 }
}).listen(PORT,'0.0.0.0',()=>console.log('School Admin API listening on port',PORT));
