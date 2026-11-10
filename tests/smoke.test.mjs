import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=read('js/dashboard.js');
const admin=read('dashboards/admin.html');
const management=read('js/admin-management.js');
const backend=read('backend/server.mjs');
const student=read('dashboards/student.html');
const teacher=read('dashboards/teacher.html');

test('all six dashboard route documents contain required shared views',()=>{
 for(const role of ['student','teacher','admin','principal','superadmin','developer']){
  const source=read('dashboards/'+role+'.html');
  for(const id of ['view-overview','view-modules','view-settings','dash-loading','dash-frame','password-form','password-submit'])
   assert.ok(source.includes('id="'+id+'"'),role+' missing '+id);
 }
});
test('missing admin-only sections do not crash other roles',()=>{
 assert.match(dashboard,/if\(!sections\[name\]\)return/);
 assert.match(dashboard,/if\(el\)el\.hidden=key!==name/);
 assert.doesNotMatch(student,/id="view-students"/);
 assert.doesNotMatch(teacher,/id="view-teachers"/);
});
test('admin account forms have show/hide controls for staff and students',()=>{
 for(const role of ['student','teacher']){
  for(const id of [role+'-form',role+'-initial-password',role+'-toggle-password',role+'-rows'])
   assert.ok(admin.includes('id="'+id+'"'),id+' missing');
  assert.ok(management.includes("el(role+'-toggle-password')"));
 }
 assert.doesNotMatch(admin,/student-generate-password/);
});
test('numeric-only student password and minimum length are preserved',()=>{
 assert.match(admin,/id="student-initial-password"[^>]*minlength="6"/);
 assert.match(admin,/id="teacher-initial-password"[^>]*minlength="12"/);
 assert.match(backend,/role==='student'\?6:12/);
 assert.match(backend,/Admission number cannot be used as the password/);
});
test('backend requires trusted admin claims and profile, with no public role selector',()=>{
 assert.match(backend,/verifyIdToken\(header\.slice\(7\),true\)/);
 assert.match(backend,/verified\.role!=='admin'/);
 assert.match(backend,/actor\.get\('active'\)!==true/);
 assert.match(backend,/!roles\.has\(body\?\.role\)/);
});
test('Firestore rules deny all client writes and profile lists',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/allow list, create, update, delete: if false/);
 assert.match(rules,/allow read, write: if false/);
});
