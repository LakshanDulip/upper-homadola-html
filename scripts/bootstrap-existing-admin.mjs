/**
 * LOCAL TRUSTED OPERATOR ONLY.
 * Create Firebase Auth account FIRST in Firebase Console with the synthetic
 * email alias u-admin@accounts.upperhomadola.school and strong unique password.
 * Copy UID from Firebase Console; verify you control the intended account.
 * Then use Google Application Default Credentials locally and run:
 *   $env:CONFIRM_BOOTSTRAP="YES"
 *   $env:TARGET_UID="<paste UID from Firebase Console>"
 *   node scripts/bootstrap-existing-admin.mjs
 *
 * Never run in a browser, public Worker, CI, or copy credentials into GitHub.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
if(process.env.CONFIRM_BOOTSTRAP!=='YES')throw new Error('Explicit CONFIRM_BOOTSTRAP=YES is required after independently verifying the administrator.');
const uid=(process.env.TARGET_UID??'').trim();
if(!uid||uid.length>128)throw new Error('Set TARGET_UID to the exact UID of the verified admin alias in Firebase Console.');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'upper-homadola-school'});
const auth=getAuth(),db=getFirestore();
const account=await auth.getUser(uid);
const expectedEmail='u-admin@accounts.upperhomadola.school';
if(account.email?.toLowerCase()!==expectedEmail)throw new Error('UID does not belong to the expected admin login alias. Refusing to grant access.');
if(account.disabled)throw new Error('Selected Firebase account is disabled.');
if(account.customClaims && Object.keys(account.customClaims).length)throw new Error('Existing custom claims detected. Refusing to overwrite them.');
const profile=db.doc('users/'+uid),nameIndex=db.doc('loginNames/admin');
await db.runTransaction(async tx=>{
 const [existingProfile,existingName]=await Promise.all([tx.get(profile),tx.get(nameIndex)]);
 if(existingProfile.exists||existingName.exists)throw new Error('Admin profile or username reservation already exists. Refusing to overwrite.');
 tx.create(nameIndex,{uid,createdVia:'trusted-bootstrap',createdAt:FieldValue.serverTimestamp()});
 tx.create(profile,{username:'admin',role:'admin',active:false,createdVia:'trusted-bootstrap',createdAt:FieldValue.serverTimestamp()});
});
try{
 await auth.setCustomUserClaims(uid,{schoolAccess:true,role:'admin'});
 await profile.update({active:true,activatedAt:FieldValue.serverTimestamp()});
 console.log('Admin account activated. UID:',uid,'— sign in with username admin and the Firebase Auth password.');
}catch(err){
 console.error('Bootstrap incomplete. Check claims and Firestore users/'+uid+' before retrying. Do NOT delete or override records blindly.');
 throw err;
}
