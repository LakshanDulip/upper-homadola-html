import { auth } from './firebase.js';
import { verifiedSession, loginUrl, dashboardUrl, logout, changePassword, ROLES } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { initLanguage, t, getLocale } from './auth-i18n.js';
const role=document.body.dataset.role,loader=document.getElementById('dash-loading'),frame=document.getElementById('dash-frame');
const sections={overview:document.getElementById('view-overview'),modules:document.getElementById('view-modules'),settings:document.getElementById('view-settings'),students:document.getElementById('view-students'),teachers:document.getElementById('view-teachers')};
const moduleDefinitions={
 student:[['📚','My subjects','මගේ විෂයයන්'],['📝','Homework','ගෙදර වැඩ'],['📊','Exam results','විභාග ප්‍රතිඵල'],['📅','Timetables','කාලසටහන්'],['✓','Attendance','පැමිණීම'],['📖','Question bank','ප්‍රශ්න බැංකුව'],['✦','Activities & awards','ක්‍රියාකාරකම් සහ සම්මාන'],['🔔','Announcements','නිවේදන']],
 teacher:[['📚','Assigned grades','පවරා ඇති ශ්‍රේණි'],['📝','Homework','ගෙදර වැඩ'],['📊','Mark entry','ලකුණු ඇතුළත් කිරීම'],['📅','Timetables','කාලසටහන්'],['✓','Attendance','පැමිණීම'],['📖','Question bank','ප්‍රශ්න බැංකුව'],['🔔','Notices','නිවේදන'],['◇','Responsibilities','වගකීම්']],
 admin:[['♙','Student management','ශිෂ්‍ය කළමනාකරණය'],['◈','Teacher management','ගුරු කළමනාකරණය'],['✓','Attendance','පැමිණීම'],['📊','Examinations','විභාග කළමනාකරණය'],['📅','Timetables','කාලසටහන්'],['📚','Library module','පුස්තකාල අංශය'],['📖','Question bank','ප්‍රශ්න බැංකුව'],['◇','Website editor','වෙබ් අඩවි සංස්කරණය'],['⚙','School settings','පාසල් සැකසුම්']],
 principal:[['📊','Academic overview','අධ්‍යාපන දළ විශ්ලේෂණය'],['✓','Approvals','අනුමැති'],['♙','Student affairs','ශිෂ්‍ය කටයුතු'],['◈','Teacher responsibilities','ගුරු වගකීම්'],['🔔','Announcements','නිවේදන']],
 superadmin:[['♙','Account management','ගිණුම් කළමනාකරණය'],['◇','Roles & permissions','භූමිකා සහ අවසර'],['⚙','School settings','පාසල් සැකසුම්'],['◈','Theme settings','තේමා සැකසුම්'],['📊','Audit logs','විගණන වාර්තා']],
 developer:[['⚙','Technical settings','තාක්ෂණික සැකසුම්'],['◇','Application diagnostics','පද්ධති පරීක්ෂා'],['📊','Audit activity','විගණන කටයුතු'],['◈','Theme configuration','තේමා සැකසුම්'],['✓','Deployment status','ප්‍රකාශන තත්ත්වය']]
};
function showFailure(key){
 loader.replaceChildren();
 const paragraph=document.createElement('p');paragraph.textContent=t(key);
 const anchor=document.createElement('a');anchor.href=loginUrl();anchor.textContent=t('dashRetry');
 loader.append(paragraph,document.createElement('br'),anchor);loader.hidden=false;frame.hidden=true;
}
function put(id,value){const element=document.getElementById(id);if(element)element.textContent=value}
function view(name){
 // Student, teacher and other non-admin dashboards do not contain management panels.
 // Ignore missing elements instead of crashing every non-admin dashboard.
 if(!sections[name])return;
 for(const [key,el] of Object.entries(sections))if(el)el.hidden=key!==name;
 for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===name;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false')}
 if(name==='settings')document.getElementById('current-password').focus();
 document.dispatchEvent(new CustomEvent('school-dashboard-view',{detail:{view:name}}));
}
function fillModules(){
 const area=document.getElementById('modules-grid');area.replaceChildren();
 for(const [index,[symbol,english,sinhala]] of (moduleDefinitions[role]||[]).entries()){
  const card=document.createElement('article');card.className='module-card';
  const icon=document.createElement('span');icon.className='module-icon';icon.textContent=symbol;icon.setAttribute('aria-hidden','true');
  const heading=document.createElement('h3');heading.textContent=getLocale()==='si'?sinhala:english;
  const message=document.createElement('p');message.textContent=t('dashModuleSubtitle');
  const tag=document.createElement('small');tag.textContent=t('dashComing');
  if(role==='admin'&&index<2){
   tag.textContent=getLocale()==='si'?'කළමනාකරණයට යන්න':'Open management';
   card.tabIndex=0;card.setAttribute('role','button');
   const open=()=>view(index===0?'students':'teachers');
   card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  }
  card.append(icon,heading,message,tag);area.append(card);
 }
}
function userDate(value){if(!value)return t('notAvailable');const date=new Date(value);return Number.isNaN(date.valueOf())?t('notAvailable'):new Intl.DateTimeFormat(getLocale()==='si'?'si-LK':'en-GB',{dateStyle:'medium'}).format(date)}
let activeSession=null;
function fillSession(session){
 activeSession=session;
 put('dash-username',session.username||session.user.uid);
 put('account-username',session.username||session.user.uid);
 put('account-role',t('role_'+role));
 put('account-status',t('dashActive'));
 put('account-created',userDate(session.user.metadata.creationTime));
 put('account-last-login',userDate(session.user.metadata.lastSignInTime));
 put('dashboard-greeting',t('dashWelcome')+', '+(session.username||t('role_'+role)));
 put('dashboard-title',t('role_'+role)+' · '+t('dashSubtitle'));
 fillModules();
 if(role==='admin'&&!window.__schoolAdminManagerInitialized){
  window.__schoolAdminManagerInitialized=true;
  import('./admin-management.js').then(m=>m.initAdminManagement()).catch(error=>console.error('Admin management module failed to load',error));
 }
}
initLanguage();
document.addEventListener('school-language-change',()=>{if(activeSession)fillSession(activeSession)});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>view(button.dataset.view));
document.getElementById('logout-button').addEventListener('click',async()=>{await logout();location.replace(loginUrl())});
document.getElementById('year').textContent=new Date().getFullYear();
const newPassword=document.getElementById('new-password'),oldPassword=document.getElementById('current-password'),confirmPassword=document.getElementById('confirm-password'),form=document.getElementById('password-form'),status=document.getElementById('settings-status');
function alertPassword(key,isSuccess=false){status.textContent=t(key);status.className='settings-alert '+(isSuccess?'success':'error');status.hidden=false}
document.getElementById('password-toggle').addEventListener('click',()=>{const visible=newPassword.type==='password';for(const input of [newPassword,oldPassword,confirmPassword])input.type=visible?'text':'password';document.getElementById('password-toggle').textContent=t(visible?'hide':'show')});
form.addEventListener('submit',async e=>{
 e.preventDefault();status.hidden=true;
 if(newPassword.value.length<(role==='student'?6:12)){alertPassword(role==='student'?'dashPasswordTooShortStudent':'dashPasswordTooShort');return}
 if(newPassword.value!==confirmPassword.value){alertPassword('dashPasswordMismatch');return}
 if(newPassword.value===oldPassword.value){alertPassword('dashPasswordSame');return}
 const submit=document.getElementById('password-submit');submit.disabled=true;submit.textContent=t('dashChanging');
 try{await changePassword(oldPassword.value,newPassword.value);form.reset();alertPassword('dashPasswordSuccess',true);location.replace(loginUrl())}
 catch{alertPassword('dashPasswordFail')}
 finally{submit.disabled=false;submit.textContent=t('dashChange')}
});
if(!ROLES.includes(role)){showFailure('dashNoAccess')}
else onAuthStateChanged(auth,async user=>{
 if(!user){location.replace(loginUrl());return}
 try{
  const session=await verifiedSession(user);
  if(session.role!==role){location.replace(dashboardUrl(session.role));return}
  fillSession(session);loader.hidden=true;frame.hidden=false;view('overview');
 }catch{showFailure('dashNoAccess')}
});
