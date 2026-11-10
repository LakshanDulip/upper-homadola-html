import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {readFileSync} from 'node:fs';
const env={PROJECT_ID:'upper-homadola-school',ALLOWED_ORIGIN:'https://lakshandulip.github.io',ENABLE_ACCOUNT_WRITES:'false'};
const req=(route,method='GET',headers={})=>new Request('https://test.workers.dev'+route,{method,headers});
test('health endpoint exposes status but no credentials',async()=>{
 const r=await worker.fetch(req('/health'),env);
 assert.equal(r.status,200);
 const x=await r.json();assert.equal(x.status,'ok');assert.equal(x.writeEnabled,false);assert.equal(x.credentialsConfigured,false);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unauthenticated account list is rejected',async()=>{
 const r=await worker.fetch(req('/api/accounts?role=student'),env);
 assert.equal(r.status,401);
});
test('unauthenticated create is rejected before any Firebase access',async()=>{
 const r=await worker.fetch(req('/api/accounts','POST',{'content-type':'application/json'}),env);
 assert.equal(r.status,401);
});
test('cross-site browser requests are rejected',async()=>{
 const r=await worker.fetch(req('/api/accounts','GET',{'origin':'https://untrusted.example'}),env);
 assert.equal(r.status,403);
});
test('preflight allows ONLY GitHub Pages origin',async()=>{
 const good=await worker.fetch(req('/api/accounts','OPTIONS',{'origin':env.ALLOWED_ORIGIN}),env);
 assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-origin'),env.ALLOWED_ORIGIN);
 const bad=await worker.fetch(req('/api/accounts','OPTIONS',{'origin':'https://evil.example'}),env);
 assert.equal(bad.status,403);
});
test('source has no public registration or static credential',()=>{
 const s=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(s,/FIREBASE_SERVICE_ACCOUNT_JSON/);
 assert.match(s,/ENABLE_ACCOUNT_WRITES!=='true'/);
 assert.match(s,/verifyFirebaseJwt/);
 assert.match(s,/actor\.get\('active'\)|profile\.active!==true/);
 assert.doesNotMatch(s,/-----BEGIN PRIVATE KEY-----[A-Za-z0-9]/);
});
