import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut, getIdTokenResult, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
export const ROLES=Object.freeze(['student','teacher','admin','principal','superadmin','developer']);
const USERNAME=/^[a-z0-9_-]{1,40}$/;
export const homeUrl=()=>new URL('../index.html',import.meta.url).href;
export const loginUrl=()=>new URL('../login.html',import.meta.url).href;
export const dashboardUrl=role=>new URL('../dashboards/'+role+'.html',import.meta.url).href;
export function resolveLoginEmail(input){
 const value=String(input??'').trim().toLowerCase();
 if(value.includes('@')){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('invalid-username');return value}
 if(!USERNAME.test(value))throw new Error('invalid-username');
 return 'u-'+value+'@accounts.upperhomadola.school';
}
export async function login(username,password){
 if(!password)throw new Error('missing-password');
 return signInWithEmailAndPassword(auth,resolveLoginEmail(username),password);
}
export async function verifiedSession(user){
 if(!user)throw new Error('no-session');
 const token=await getIdTokenResult(user,true);
 const role=token.claims.role;
 if(token.claims.schoolAccess!==true||!ROLES.includes(role))throw new Error('not-authorized');
 const snapshot=await getDoc(doc(db,'users',user.uid));
 if(!snapshot.exists())throw new Error('not-authorized');
 const profile=snapshot.data();
 if(profile.active!==true||profile.role!==role)throw new Error('not-authorized');
 return {role,username:typeof profile.username==='string'?profile.username:'',profile, user};
}
export async function changePassword(currentPassword,newPassword){
 const user=auth.currentUser;
 if(!user||!user.email)throw new Error('no-session');
 const credential=EmailAuthProvider.credential(user.email,currentPassword);
 await reauthenticateWithCredential(user,credential);
 await updatePassword(user,newPassword);
 await signOut(auth);
}
export async function logout(){await signOut(auth)}
