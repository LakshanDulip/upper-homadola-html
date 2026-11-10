/**
 * Admin UI for Student/Teacher management. All writes go through a trusted
 * token-verified Cloud Run API; this file contains no Firebase Admin SDK or
 * privileged credentials. Never display private student photos here.
 */
import { auth } from './firebase.js';
import { API_BASE_URL } from './api-config.js';
import { getLocale } from './auth-i18n.js';

const copy={
 si:{
 students:'ශිෂ්‍ය කළමනාකරණය',teachers:'ගුරු කළමනාකරණය',
 studentIntro:'ඇතුළත් වීමේ අංකය, ශ්‍රේණිය සහ ශිෂ්‍ය ගිණුම් ආරක්ෂිතව කළමනාකරණය කරන්න.',
 teacherIntro:'ස්වයංක්‍රීය Teacher ID, විෂයයන් සහ පවරා ඇති ශ්‍රේණි කළමනාකරණය කරන්න.',
 addStudent:'නව ශිෂ්‍ය ගිණුම',addTeacher:'නව ගුරු ගිණුම',name:'සම්පූර්ණ නම',admission:'ස්ථිර ඇතුළත් වීමේ අංකය',grade:'ශ්‍රේණිය',
 tempPassword:'ආරම්භක මුරපදය',passwordHelp:'අවම අකුරු 6යි. ඉලක්කම් පමණක් වුණත් භාවිත කළ හැකියි. Admission Number එක හෝ පහසුවෙන් අනුමාන කළ හැකි අංක භාවිත නොකරන්න.',showPassword:'Password පෙන්වන්න',hidePassword:'Password සඟවන්න',
 saveStudent:'ශිෂ්‍ය ගිණුම සාදන්න',saveTeacher:'ගුරු ගිණුම සාදන්න',saveChanges:'වෙනස්කම් සුරකින්න',
 subjects:'විෂයයන් (කොමා වලින් වෙන් කරන්න)',assignedGrades:'පවරා ඇති ශ්‍රේණි (උදා: 6,7,8)',
 autoId:'Teacher ID එක පද්ධතියෙන් ස්වයංක්‍රීයව ලබා දෙනවා.',list:'ගිණුම් ලැයිස්තුව',search:'නම හෝ ID අනුව සොයන්න',
 id:'පාසල් අංකය',status:'තත්ත්වය',active:'සක්‍රීයයි',inactive:'අක්‍රීයයි',details:'විස්තර',
 actions:'ක්‍රියා',edit:'සංස්කරණය',deactivate:'අක්‍රීය කරන්න',activate:'සක්‍රීය කරන්න',cancel:'අවලංගු',
 empty:'තවම ගිණුම් නොමැත.',loading:'ලැයිස්තුව ලබාගනිමින්...',backendNeeded:'Account Management Backend එක තවම Deploy කර නැහැ. Server සකස් කරන තුරු Accounts සෑදීම/බැලීම කළ නොහැක.',failed:'Backend සම්බන්ධතාවය අසාර්ථකයි. සම්බන්ධතාවය හා අවසර පරීක්ෂා කරන්න.',
 created:'ගිණුම සාර්ථකව සාදන ලදී',updated:'ගිණුම යාවත්කාලීන කළා',statusUpdated:'ගිණුමේ තත්ත්වය වෙනස් කළා',
 confirmStatus:'මෙම ගිණුමේ Login ප්‍රවේශය වෙනස් කිරීමට අවශ්‍ය බව තහවුරු කරන්න.',limit:'උපරිම පළමු ගිණුම් 100 පෙන්වයි. වැඩි ගිණුම් සඳහා Pagination ඉදිරි අදියරේදී.',
 refreshing:'යාවත්කාලීන කරන්න',newStudent:'අලුත් ශිෂ්‍ය',newTeacher:'අලුත් ගුරුවරයා',validation:'නම, ශ්‍රේණි, ID සහ Password නිවැරදිව සම්පූර්ණ කරන්න.',
 configured:'Backend සම්බන්ධතාවය සක්‍රීයයි. සැබෑ ගිණුම් නිර්මාණය වන බව සැලකිල්ලෙන් පරීක්ෂා කරන්න.',
 privacy:'ගුරු ID ස්වයංක්‍රීයව ලැබේ. සිසුන්ගේ අංක නැවත භාවිත නොකළ යුතුයි. Password කිසිදා JavaScript File එකකට නොයන්න.',
 gradeSelect:'ශ්‍රේණිය තෝරන්න',subjectExample:'Mathematics, Science',gradeExample:'6,7,8'
 },
 en:{
 students:'Student management',teachers:'Teacher management',studentIntro:'Securely manage permanent admission numbers, grades and student accounts.',teacherIntro:'Manage automatically assigned teacher IDs, subjects and teaching grades.',
 addStudent:'New student account',addTeacher:'New teacher account',name:'Full name',admission:'Permanent admission number',grade:'Grade',
 tempPassword:'Initial password',passwordHelp:'Minimum 6 characters. Numeric-only passwords are accepted. Do not use the admission number or easily guessed sequences.',showPassword:'Show password',hidePassword:'Hide password',
 saveStudent:'Create student account',saveTeacher:'Create teacher account',saveChanges:'Save changes',
 subjects:'Subjects (comma-separated)',assignedGrades:'Assigned grades (e.g. 6,7,8)',
 autoId:'A unique teacher ID will be generated automatically.',list:'Account directory',search:'Search by name or school ID',
 id:'School ID',status:'Status',active:'Active',inactive:'Inactive',details:'Details',actions:'Actions',edit:'Edit',
 deactivate:'Deactivate',activate:'Activate',cancel:'Cancel',empty:'No accounts yet.',loading:'Loading accounts...',
 backendNeeded:'The account management backend is not deployed yet. Account creation and lists cannot work until setup is complete.',
 failed:'Could not reach the management backend. Check deployment and permissions.',
 created:'Account created successfully',updated:'Account updated',statusUpdated:'Account status updated',
 confirmStatus:'Confirm you want to change this account’s sign-in access.',limit:'Showing up to 100 accounts. Pagination will be added in a future phase.',
 refreshing:'Refresh list',newStudent:'New student',newTeacher:'New teacher',validation:'Enter valid name, grades, ID and password.',
 configured:'Backend endpoint configured. Be careful: these actions affect real accounts.',
 privacy:'Teacher IDs are auto-generated. Student IDs must never be reused. Passwords must never be written to JavaScript files.',
 gradeSelect:'Select grade',subjectExample:'Mathematics, Science',gradeExample:'6,7,8'
 }};
const t=key=>copy[getLocale()]?.[key]||copy.en[key]||key;
let initialized=false;
const cached={student:[],teacher:[]};
function el(id){return document.getElementById(id)}
function notice(role,message,type='info'){
 const target=el(role+'-management-message');if(!target)return;
 target.textContent=message;target.className='management-message '+type;target.hidden=false;
}
function createNode(tag,cls,value){
 const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;
}
function language(){
 for(const element of document.querySelectorAll('[data-manage-text]'))element.textContent=t(element.dataset.manageText);
 for(const element of document.querySelectorAll('[data-manage-placeholder]'))element.placeholder=t(element.dataset.managePlaceholder);
 for(const role of ['student','teacher']){
  const form=recordForm(role);
  if(!form)continue;
  const editing=Boolean(form.elements.uid.value);
  const title=el(role+'-form-title');
  const save=el(role+'-submit');
  title.textContent=editing?t('edit')+' · '+(role==='student'?form.elements.admissionNumber.value:cached.teacher.find(a=>a.uid===form.elements.uid.value)?.username||''):t(role==='student'?'addStudent':'addTeacher');
  save.textContent=t(editing?'saveChanges':role==='student'?'saveStudent':'saveTeacher');
  render(role);
  const input=form.elements.password;
  const toggle=el(role+'-toggle-password');
  if(input&&toggle)toggle.textContent=t(input.type==='text'?'hidePassword':'showPassword');
 }
}
function parseComma(input){return input.split(',').map(s=>s.trim()).filter(Boolean)}
function recordForm(role){return el(role+'-form')}
function editRecord(role,account){
 const form=recordForm(role);
 form.elements.uid.value=account.uid;
 form.elements.displayName.value=account.displayName;
 if(role==='student'){
  form.elements.admissionNumber.value=account.username;
  form.elements.grade.value=String(account.grade??'');
  form.elements.admissionNumber.readOnly=true;
 }else{
  form.elements.subjects.value=(account.subjects||[]).join(', ');
  form.elements.assignedGrades.value=(account.assignedGrades||[]).join(', ');
 }
 const passwordField=el(role+'-password-field');passwordField.hidden=true;form.elements.password.required=false;form.elements.password.value='';
 form.elements.password.type='password';
 const toggle=el(role+'-toggle-password');toggle.setAttribute('aria-pressed','false');toggle.textContent=t('showPassword');
 const headline=el(role+'-form-title');headline.textContent=t('edit')+' · '+account.username;
 const save=el(role+'-submit');save.textContent=t('saveChanges');
 el(role+'-cancel').hidden=false;
 form.scrollIntoView({behavior:'smooth',block:'start'});
}
function resetForm(role){
 const form=recordForm(role);form.reset();form.elements.uid.value='';
 if(role==='student')form.elements.admissionNumber.readOnly=false;
 el(role+'-password-field').hidden=false;form.elements.password.required=true;
 el(role+'-form-title').textContent=t(role==='student'?'addStudent':'addTeacher');
 el(role+'-submit').textContent=t(role==='student'?'saveStudent':'saveTeacher');
 el(role+'-cancel').hidden=true;
 const passwordInput=form.elements.password;
 passwordInput.type='password';
 const toggle=el(role+'-toggle-password');
 toggle.setAttribute('aria-pressed','false');
 toggle.textContent=t('showPassword');
}
function render(role){
 const rows=el(role+'-rows');if(!rows)return;rows.replaceChildren();
 const search=(el(role+'-search').value||'').toLowerCase();
 const list=cached[role].filter(a=>(a.username+' '+a.displayName).toLowerCase().includes(search));
 if(!list.length){const row=createNode('tr');const cell=createNode('td','empty-cell',t('empty'));cell.colSpan=5;row.append(cell);rows.append(row);return}
 for(const account of list){
  const row=createNode('tr');
  row.append(createNode('td','school-id',account.username),createNode('td','',account.displayName));
  const detail=role==='student'?((account.grade??'—')+''):((account.subjects||[]).join(', ')||'—');
  row.append(createNode('td','',detail));
  const status=createNode('td'),pill=createNode('span','mgmt-status '+(account.active?'is-active':'is-inactive'),t(account.active?'active':'inactive'));status.append(pill);row.append(status);
  const actions=createNode('td','mgmt-actions');
  const edit=createNode('button','mgmt-action',t('edit'));edit.type='button';edit.addEventListener('click',()=>editRecord(role,account));
  const toggle=createNode('button','mgmt-action danger',t(account.active?'deactivate':'activate'));toggle.type='button';
  toggle.addEventListener('click',async()=>{
   if(!confirm(t('confirmStatus')+'\n'+account.username))return;
   toggle.disabled=true;
   try{
    await request('/api/accounts/'+encodeURIComponent(account.uid)+'/status',{method:'PATCH',body:{active:!account.active}});
    await load(role);
    notice(role,t('statusUpdated'),'success');
   }catch(err){notice(role,err.message||t('failed'),'error')}
   finally{toggle.disabled=false}
  });
  actions.append(edit,toggle);row.append(actions);rows.append(row);
 }
}
async function request(path,{method='GET',body}={}){
 if(!API_BASE_URL||!/^https:\/\/[^\s/]+/.test(API_BASE_URL))throw new Error(t('backendNeeded'));
 const user=auth.currentUser;if(!user)throw new Error(t('failed'));
 const token=await user.getIdToken();
 const url=API_BASE_URL.replace(/\/$/,'')+path;
 const response=await fetch(url,{method,headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof result.error==='string'?result.error:t('failed'));
 return result;
}
async function load(role){
 const target=el(role+'-management-message');target.hidden=true;
 if(!API_BASE_URL){notice(role,t('backendNeeded'));render(role);return}
 notice(role,t('loading'));
 try{
  const result=await request('/api/accounts?role='+encodeURIComponent(role));
  cached[role]=Array.isArray(result.accounts)?result.accounts:[];
  render(role);
  target.hidden=true;
  if(result.moreMayExist)notice(role,t('limit'));
 }catch(err){notice(role,err.message||t('failed'),'error')}
}
async function save(role,event){
 event.preventDefault();const form=recordForm(role),button=el(role+'-submit');
 const editing=Boolean(form.elements.uid.value);
 let body={displayName:form.elements.displayName.value.trim()};
 if(role==='student'){
  body.grade=Number(form.elements.grade.value);
  if(!editing)body.admissionNumber=form.elements.admissionNumber.value.trim();
 }else{
  body.subjects=parseComma(form.elements.subjects.value);
  body.assignedGrades=parseComma(form.elements.assignedGrades.value).map(Number);
 }
 if(!editing)body.password=form.elements.password.value;
 if(!body.displayName||(!editing&&body.password.length<(role==='student'?6:12))||role==='student'&&(!Number.isInteger(body.grade)||body.grade<1||body.grade>11)||role==='teacher'&&body.assignedGrades.some(g=>!Number.isInteger(g)||g<1||g>11)){
  notice(role,t('validation'),'error');return;
 }
 if(role==='student'&&!editing&&body.password.toLowerCase()===body.admissionNumber.toLowerCase()){notice(role,t('passwordHelp'),'error');return}
 button.disabled=true;
 try{
  const response=await request(editing?'/api/accounts/'+encodeURIComponent(form.elements.uid.value):'/api/accounts',{
   method:editing?'PATCH':'POST',body:editing?body:{...body,role}
  });
  // Never store or echo temporary credentials.
  resetForm(role);await load(role);
  notice(role,t(editing?'updated':'created')+(response.username?' · '+response.username:''),'success');
 }catch(err){notice(role,err.message||t('failed'),'error')}
 finally{button.disabled=false}
}
export function initAdminManagement(){
 if(initialized)return;initialized=true;
 for(const role of ['student','teacher']){
  const form=recordForm(role);if(!form)continue;
  form.addEventListener('submit',event=>save(role,event));
  el(role+'-cancel').addEventListener('click',()=>resetForm(role));
  el(role+'-search').addEventListener('input',()=>render(role));
  el(role+'-refresh').addEventListener('click',()=>load(role));
  const toggle=el(role+'-toggle-password');
  toggle.addEventListener('click',()=>{
   const input=form.elements.password;
   const visible=input.type==='password';
   input.type=visible?'text':'password';
   toggle.textContent=t(visible?'hidePassword':'showPassword');
   toggle.setAttribute('aria-pressed',String(visible));
  });
  if(role==='student'){
   const options=el('student-grade');
   for(let grade=1;grade<=11;grade++){const option=document.createElement('option');option.value=String(grade);option.textContent=String(grade);options.append(option)}
  }
  if(!API_BASE_URL)notice(role,t('backendNeeded'));
 }
 language();
 document.addEventListener('school-language-change',language);
 document.addEventListener('school-dashboard-view',event=>{
  if(event.detail?.view==='students')load('student');
  if(event.detail?.view==='teachers')load('teacher');
 });
}
