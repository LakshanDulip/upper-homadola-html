import { auth } from './firebase.js';
import { login, verifiedSession, dashboardUrl, logout } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { initLanguage, t } from './auth-i18n.js';
initLanguage();
document.getElementById('year').textContent=new Date().getFullYear();
const form=document.getElementById('login-form'),button=document.getElementById('login-submit'),error=document.getElementById('login-error');
let busy=false;
function showError(key){error.textContent=t(key);error.hidden=false}
function setBusy(value){busy=value;button.disabled=value;button.querySelector('span').textContent=t(value?'signingIn':'signIn')}
document.addEventListener('school-language-change',()=>{
 if(busy)setBusy(true);
 for(const toggle of document.querySelectorAll('[data-toggle-password]')){
  const field=document.getElementById(toggle.dataset.togglePassword);
  toggle.textContent=t(field.type==='password'?'show':'hide');
 }
});
for(const toggle of document.querySelectorAll('[data-toggle-password]')){
 toggle.addEventListener('click',()=>{const field=document.getElementById(toggle.dataset.togglePassword);field.type=field.type==='password'?'text':'password';toggle.textContent=t(field.type==='password'?'show':'hide');toggle.setAttribute('aria-pressed',String(field.type==='text'))});
}
onAuthStateChanged(auth,async user=>{
 if(!user||busy)return;
 try{const session=await verifiedSession(user);location.replace(dashboardUrl(session.role))}
 catch{/* Let user try another account; do not grant access. */}
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;error.hidden=true;
 const username=form.username.value.trim(),password=form.password.value;
 if(!username||!password){showError('required');return}
 setBusy(true);
 try{const credentials=await login(username,password);const session=await verifiedSession(credentials.user);location.replace(dashboardUrl(session.role))}
 catch(err){
  if(err.message==='invalid-username')showError('badUsername');
  else if(err.message==='not-authorized'){await logout().catch(()=>{});showError('notAuthorized')}
  else if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(err.code))showError('invalidLogin');
  else showError('authUnavailable');
  setBusy(false);
 }
});
