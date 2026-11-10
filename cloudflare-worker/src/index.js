/**
 * Cloudflare Workers school admin API (no Node SDK, no npm runtime packages).
 * Firebase Auth Admin REST + Firestore REST; all requests use WebCrypto JWTs.
 *
 * SAFETY:
 * - Requires Firebase ID token with verified issuer/audience/RSA signature,
 *   schoolAccess and admin role claims.
 * - Checks Firebase user disabled/token revocation via admin lookup REST.
 * - Checks active admin Firestore profile for EVERY privileged request.
 * - Service account credentials ONLY in Cloudflare Worker secret
 *   FIREBASE_SERVICE_ACCOUNT_JSON. Never put credentials in GitHub/HTML.
 * - Account mutations OFF until ENABLE_ACCOUNT_WRITES="true".
 * - Never stores, returns or logs passwords.
 */
const roles=new Set(['student','teacher']);
const usernamePattern=/^[a-z0-9_-]{1,40}$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const forbidden=/^(?:admin(?:2)?|superadmin|principal|developer|tch-)/;
const encoder=new TextEncoder();
const decoder=new TextDecoder();
let cachedJwks=null,jwksExpiresAt=0,oauthCache=null;
const err=(status,message)=>{const e=new Error(message);e.status=status;throw e};
const toB64Url=bytes=>{
 let s='';for(const n of bytes)s+=String.fromCharCode(n);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
function fromB64Url(str){
 if(!/^[\w-]+$/.test(str)||str.length%4===1)err(401,'Invalid authentication token');
 const raw=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function decodeJwt(str){
 const parts=str.split('.');
 if(parts.length!==3)err(401,'Invalid authentication token');
 try{return {parts,header:JSON.parse(decoder.decode(fromB64Url(parts[0]))),payload:JSON.parse(decoder.decode(fromB64Url(parts[1])))}}
 catch{err(401,'Invalid authentication token')}
}
function pemToDer(pem){
 const clean=pem.replace(/-----BEGIN (?:PRIVATE KEY|PUBLIC KEY|CERTIFICATE)-----/g,'').replace(/-----END (?:PRIVATE KEY|PUBLIC KEY|CERTIFICATE)-----/g,'').replace(/\s/g,'');
 return Uint8Array.from(atob(clean),c=>c.charCodeAt(0));
}
function parseServiceAccount(env){
 let a;
 try{a=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON||'')}
 catch{err(503,'Backend credentials have not been configured')}
 if(!a||a.type!=='service_account'||a.project_id!==env.PROJECT_ID||typeof a.private_key!=='string'||!a.private_key.includes('BEGIN PRIVATE KEY')||!a.client_email?.endsWith('.iam.gserviceaccount.com'))
  err(503,'Backend credentials are incomplete or mismatched');
 return a;
}
async function httpJson(url,options={},message='Upstream service failed'){
 const response=await fetch(url,{...options,headers:{accept:'application/json',...(options.headers||{})}});
 const json=await response.json().catch(()=>({}));
 if(!response.ok){
  // Do not reflect credential-bearing Google error messages to public clients.
  console.error(message,response.status,JSON.stringify(json?.error?.status||json?.error?.code||'unknown'));
  if(response.status===404)return {__notFound:true};
  if(response.status===409||response.status===412)err(409,'School ID is already in use or document changed');
  err(502,message);
 }
 return json;
}
async function oauthToken(env){
 if(oauthCache&&oauthCache.expires>Date.now()+60000&&oauthCache.email===env.PROJECT_ID)return oauthCache.token;
 const sa=parseServiceAccount(env),now=Math.floor(Date.now()/1000);
 const header=toB64Url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const payload=toB64Url(encoder.encode(JSON.stringify({
  iss:sa.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',
  aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3000
 })));
 const key=await crypto.subtle.importKey('pkcs8',pemToDer(sa.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=toB64Url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(header+'.'+payload))));
 const result=await httpJson('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+payload+'.'+signature}).toString()
 },'Google service account authentication failed');
 if(!result.access_token)err(503,'Service account token was not issued');
 oauthCache={token:result.access_token,expires:Date.now()+Math.min(result.expires_in||3000,3000)*1000,email:env.PROJECT_ID};
 return oauthCache.token;
}
async function adminJson(env,url,method='GET',body){
 return httpJson(url,{method,headers:{authorization:'Bearer '+await oauthToken(env),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})},'Firebase backend operation failed');
}
const authUrl=(env,suffix)=>'https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(env.PROJECT_ID)+'/accounts'+suffix;
const firestoreBase=env=>'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(env.PROJECT_ID)+'/databases/(default)/documents';
const docPath=(env,path)=>firestoreBase(env)+'/'+path.split('/').map(encodeURIComponent).join('/');
async function docGet(env,path){const data=await adminJson(env,docPath(env,path));return data.__notFound?null:data}
async function docPatch(env,path,changes){
 const url=new URL(docPath(env,path));
 for(const key of Object.keys(changes))url.searchParams.append('updateMask.fieldPaths',key);
 return adminJson(env,url.toString()+'&currentDocument.exists=true','PATCH',{fields:toFields(changes)});
}
const fv=value=>{
 if(value===null)return {nullValue:null};
 if(typeof value==='string')return {stringValue:value};
 if(typeof value==='boolean')return {booleanValue:value};
 if(Number.isInteger(value))return {integerValue:String(value)};
 if(typeof value==='number')return {doubleValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(fv)}};
 if(typeof value==='object')return {mapValue:{fields:toFields(value)}};
 err(400,'Unsupported field value');
};
const toFields=object=>Object.fromEntries(Object.entries(object).map(([k,v])=>[k,fv(v)]));
const unpack=v=>{
 if(!v)return undefined;
 if('stringValue'in v)return v.stringValue;
 if('booleanValue'in v)return v.booleanValue;
 if('integerValue'in v)return Number(v.integerValue);
 if('doubleValue'in v)return v.doubleValue;
 if('nullValue'in v)return null;
 if('arrayValue'in v)return (v.arrayValue.values||[]).map(unpack);
 if('mapValue'in v)return fromFields(v.mapValue.fields||{});
 if('timestampValue'in v)return v.timestampValue;
 return undefined;
};
const fromFields=fields=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,unpack(v)]));
const fromDoc=d=>({...fromFields(d.fields||{}),uid:d.name?.split('/').at(-1)});
function validName(s){return typeof s==='string'&&s.trim().length>=2&&s.trim().length<=120&&!/[<>\u0000-\u001f]/.test(s)}
const validGrade=n=>Number.isInteger(n)&&n>=1&&n<=11;
const validSubjects=a=>Array.isArray(a)&&a.length<=20&&a.every(s=>typeof s==='string'&&s.length>=2&&s.length<=60&&!/[<>\u0000-\u001f]/.test(s));
const validGrades=a=>Array.isArray(a)&&a.length<=11&&a.every(validGrade)&&new Set(a).size===a.length;
function validate(body,role,editing=false){
 if(!body||typeof body!=='object'||Array.isArray(body))err(400,'Invalid form data');
 if(!validName(body.displayName))err(400,'Full name is required (2–120 characters)');
 const displayName=body.displayName.trim();
 if(!editing){
  if(typeof body.password!=='string'||body.password.length<(role==='student'?6:12)||body.password.length>128)
   err(400,role==='student'?'Student password must be 6–128 characters':'Teacher password must be 12–128 characters');
 }
 if(role==='student'){
  if(!validGrade(body.grade))err(400,'Choose a grade from 1 to 11');
  const username=editing?undefined:String(body.admissionNumber||'').trim().toLowerCase();
  if(!editing){
   if(!/^[A-Z]{2}[0-9]{4}$/.test(body.password))err(400,'Student initial password must contain exactly two uppercase letters and four digits');
   if(!usernamePattern.test(username)||forbidden.test(username))err(400,'Invalid or reserved admission number');
   if(body.password.toLowerCase()===username)err(400,'Admission number cannot be used as password');
  }
  return {displayName,grade:body.grade,...(!editing?{username,password:body.password}:{})};
 }
 if(!validSubjects(body.subjects||[])||!validGrades(body.assignedGrades||[]))err(400,'Invalid subject or grade assignment');
 return {displayName,subjects:[...new Set(body.subjects||[])],assignedGrades:body.assignedGrades||[],...(!editing?{password:body.password}:{})};
}
async function firebaseJwks(){
 if(cachedJwks&&Date.now()<jwksExpiresAt)return cachedJwks;
 const res=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
 if(!res.ok)err(503,'Cannot verify Firebase session');
 const jwks=await res.json();
 if(!jwks||!Array.isArray(jwks.keys))err(503,'Invalid Firebase signing key response');
 const age=(res.headers.get('cache-control')||'').match(/max-age=(\d+)/);
 cachedJwks=jwks;jwksExpiresAt=Date.now()+Math.min(Number(age?.[1]||3600),21600)*1000;
 return jwks;
}
async function verifyFirebaseJwt(env,token){
 if(token.length>8192)err(401,'Invalid authentication token');
 const {parts,header,payload}=decodeJwt(token);
 if(header.alg!=='RS256'||typeof header.kid!=='string')err(401,'Unsupported authentication token');
 const now=Math.floor(Date.now()/1000);
 if(payload.aud!==env.PROJECT_ID||payload.iss!=='https://securetoken.google.com/'+env.PROJECT_ID
  ||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128
  ||typeof payload.iat!=='number'||payload.iat>now+60
  ||typeof payload.exp!=='number'||payload.exp<=now
  ||typeof payload.auth_time!=='number'||payload.auth_time>now+60
 )err(401,'Expired or invalid authentication session');
 const jwks=await firebaseJwks();
 const jwk=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use!=='enc');
 if(!jwk)err(401,'Unknown Firebase signing key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const okay=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,fromB64Url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
 if(!okay)err(401,'Firebase session signature invalid');
 if(payload.schoolAccess!==true||payload.role!=='admin')err(403,'Administrator permission required');
 return payload;
}
async function requireAdmin(env,request){
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Bearer '))err(401,'Please sign in');
 const claims=await verifyFirebaseJwt(env,header.slice(7));
 // Verify enabled/non-revoked status against Identity Toolkit Admin API.
 const lookup=await adminJson(env,authUrl(env,':lookup'),'POST',{localId:[claims.sub]});
 const u=lookup.users?.[0];
 if(!u||u.disabled===true||Number(u.validSince||0)>claims.auth_time)err(401,'Session revoked or account disabled');
 const document=await docGet(env,'users/'+claims.sub);
 const profile=document&&fromDoc(document);
 if(!profile||profile.role!=='admin'||profile.active!==true)err(403,'Administrator account inactive or unauthorized');
 return claims.sub;
}
async function listAccounts(env,role){
 if(!roles.has(role))err(400,'Invalid role');
 const result=await adminJson(env,firestoreBase(env)+':runQuery','POST',{
  structuredQuery:{from:[{collectionId:'users'}],where:{fieldFilter:{field:{fieldPath:'role'},op:'EQUAL',value:fv(role)}},limit:100}
 });
 if(!Array.isArray(result))err(502,'Invalid Firestore query response');
 const accounts=result.filter(x=>x.document).map(x=>{
  const {uid,username,displayName,role,active,grade,subjects,assignedGrades}=fromDoc(x.document);
  return {uid,username,displayName,role,active:active===true,...(role==='student'?{grade:grade??null}:{subjects:subjects||[],assignedGrades:assignedGrades||[]})};
 }).sort((a,b)=>a.username.localeCompare(b.username));
 return {accounts,limit:100,moreMayExist:accounts.length===100};
}
function auditWrite(env,actor,target,role,action){
 const id=crypto.randomUUID().replace(/-/g,'');
 return {update:{name:docPath(env,'auditLogs/'+id),fields:toFields({
  action,actorUid:actor,targetUid:target,targetRole:role,at:new Date().toISOString()
 })},currentDocument:{exists:false}};
}
async function commit(env,writes,transaction){
 return adminJson(env,firestoreBase(env)+':commit','POST',{writes,...(transaction?{transaction}:{})});
}
async function allocateTeacherId(env){
 for(let attempt=0;attempt<5;attempt++){
  const start=await adminJson(env,firestoreBase(env)+':beginTransaction','POST',{options:{readWrite:{}}});
  const transaction=start.transaction;
  const url=docPath(env,'_system/teacherSequence')+'?transaction='+encodeURIComponent(transaction);
  const doc=await adminJson(env,url);
  const count=doc.__notFound?0:fromDoc(doc).lastNumber;
  if(!Number.isSafeInteger(count)||count<0||count>=999999)err(500,'Invalid teacher ID sequence');
  try{
   await commit(env,[{update:{name:docPath(env,'_system/teacherSequence'),fields:toFields({lastNumber:count+1,updatedAt:new Date().toISOString()})}}],transaction);
   return 'TCH-'+String(count+1).padStart(4,'0');
  }catch(e){if(e.status!==409||attempt===4)throw e}
 }
 err(503,'Could not allocate teacher ID');
}
async function createAccount(env,body,role,actor){
 const input=validate(body,role);
 const username=role==='student'?input.username:await allocateTeacherId(env);
 const email='u-'+username+'@accounts.upperhomadola.school';
 // Firebase Admin Identity Toolkit REST create endpoint (not client signUp).
 const response=await adminJson(env,authUrl(env,''),'POST',{email,password:input.password,displayName:input.displayName,disabled:true,emailVerified:false});
 const uid=response.localId||response.uid;
 if(!uid)err(502,'Auth did not return account ID. Inspect Firebase for reconciliation');
 const fields={username,role,displayName:input.displayName,active:false,createdBy:actor,createdAt:new Date().toISOString(),createdVia:'cloudflare-worker',
  ...(role==='student'?{grade:input.grade}:{subjects:input.subjects,assignedGrades:input.assignedGrades})};
 try{
  await commit(env,[
   {update:{name:docPath(env,'loginNames/'+username),fields:toFields({uid,createdBy:actor,createdAt:new Date().toISOString()})},currentDocument:{exists:false}},
   {update:{name:docPath(env,'users/'+uid),fields:toFields(fields)},currentDocument:{exists:false}},
   auditWrite(env,actor,uid,role,'account.provision.requested')
  ]);
  await adminJson(env,authUrl(env,':update'),'POST',{localId:uid,customAttributes:JSON.stringify({schoolAccess:true,role}),disableUser:false});
  await docPatch(env,'users/'+uid,{active:true,activatedAt:new Date().toISOString()});
  await commit(env,[auditWrite(env,actor,uid,role,'account.provision.completed')]);
  return {uid,username,role,displayName:input.displayName};
 }catch(e){
  try{await adminJson(env,authUrl(env,':update'),'POST',{localId:uid,disableUser:true})}catch{}
  console.error('Incomplete account provision; manual review Firebase Auth UID',uid);
  if(e.status===409)throw e;
  err(500,'Account setup incomplete. Inspect Firebase records before retrying this school ID');
 }
}
async function targetAccount(env,uid){
 if(!idPattern.test(uid))err(400,'Invalid account UID');
 const doc=await docGet(env,'users/'+uid),target=doc&&fromDoc(doc);
 if(!target||!roles.has(target.role))err(404,'Account not found');
 return target;
}
async function updateAccount(env,uid,body,actor){
 const target=await targetAccount(env,uid),input=validate(body,target.role,true);
 await commit(env,[
  {update:{name:docPath(env,'users/'+uid),fields:toFields({...input,updatedBy:actor,updatedAt:new Date().toISOString()})},updateMask:{fieldPaths:Object.keys(input).concat(['updatedBy','updatedAt'])},currentDocument:{exists:true}},
  auditWrite(env,actor,uid,target.role,'account.profile.updated')
 ]);
 return {success:true};
}
async function changeStatus(env,uid,body,actor){
 const target=await targetAccount(env,uid);
 if(typeof body?.active!=='boolean')err(400,'Invalid account status');
 const lookup=await adminJson(env,authUrl(env,':lookup'),'POST',{localId:[uid]});
 const u=lookup.users?.[0];
 if(!u)err(409,'Auth user missing; manual recovery needed');
 const existing=JSON.parse(u.customAttributes||'{}');
 if(existing.role!==target.role||existing.schoolAccess!==true)err(409,'Auth custom claims mismatch');
 const active=body.active;
 // On deactivation: disable Auth BEFORE changing the Firestore profile.
 // On activation: turn Auth back on only after claims have been verified.
 await adminJson(env,authUrl(env,':update'),'POST',{localId:uid,disableUser:!active});
 await commit(env,[
  {update:{name:docPath(env,'users/'+uid),fields:toFields({active,updatedBy:actor,updatedAt:new Date().toISOString()})},updateMask:{fieldPaths:['active','updatedBy','updatedAt']},currentDocument:{exists:true}},
  auditWrite(env,actor,uid,target.role,active?'account.activated':'account.deactivated')
 ]);
 return {success:true};
}
function responseJson(env,request,body,status=200){
 const origin=request.headers.get('origin');
 const cors=origin===env.ALLOWED_ORIGIN?{
  'access-control-allow-origin':env.ALLOWED_ORIGIN,'vary':'Origin'
 }:{};
 return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...cors}});
}
async function parseBody(req){
 const len=Number(req.headers.get('content-length')||0);
 if(len>16384)err(413,'Request too large');
 const text=await req.text();
 if(encoder.encode(text).byteLength>16384)err(413,'Request too large');
 try{return JSON.parse(text)}catch{err(400,'Invalid JSON')}
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('origin');
  if(origin&&origin!==env.ALLOWED_ORIGIN)return responseJson(env,request,{error:'Origin not allowed'},403);
  if(request.method==='OPTIONS'){
   if(origin!==env.ALLOWED_ORIGIN)return responseJson(env,request,{error:'Origin not allowed'},403);
   return new Response(null,{status:204,headers:{
    'access-control-allow-origin':env.ALLOWED_ORIGIN,
    'access-control-allow-methods':'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers':'authorization,content-type',
    'access-control-max-age':'600',
    'vary':'Origin'
   }});
  }
  try{
   if(!env.PROJECT_ID||!env.ALLOWED_ORIGIN)err(503,'Worker not configured');
   const u=new URL(request.url);
   if(u.pathname==='/health'&&request.method==='GET')return responseJson(env,request,{status:'ok',writeEnabled:env.ENABLE_ACCOUNT_WRITES==='true',credentialsConfigured:!!env.FIREBASE_SERVICE_ACCOUNT_JSON});
   if(!u.pathname.startsWith('/api/'))err(404,'Not found');
   const actor=await requireAdmin(env,request);
   if(u.pathname==='/api/accounts'&&request.method==='GET')
    return responseJson(env,request,await listAccounts(env,u.searchParams.get('role')));
   if(env.ENABLE_ACCOUNT_WRITES!=='true')err(503,'Account writes are disabled until secure deployment is verified');
   if(u.pathname==='/api/accounts'&&request.method==='POST'){
    const body=await parseBody(request);
    if(!roles.has(body?.role))err(400,'Only student and teacher roles may be provisioned');
    return responseJson(env,request,await createAccount(env,body,body.role,actor),201);
   }
   const match=u.pathname.match(/^\/api\/accounts\/([A-Za-z0-9_-]{1,128})(\/status)?$/);
   if(match&&request.method==='PATCH'){
    const body=await parseBody(request);
    const result=match[2]?await changeStatus(env,match[1],body,actor):await updateAccount(env,match[1],body,actor);
    return responseJson(env,request,result);
   }
   err(404,'Not found');
  }catch(e){
   if(!e.status)console.error('Worker unexpected exception:',e?.name||'Error');
   return responseJson(env,request,{error:e.status?e.message:'Internal server error'},e.status||500);
  }
 }
};
