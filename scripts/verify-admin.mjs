/**
 * Read-only admin setup verification from a trusted local PC.
 *
 * PowerShell:
 *   $env:TARGET_UID = "<UID copied from Firebase Authentication Users>"
 *   node scripts/verify-admin.mjs
 *
 * This tool makes NO writes to Firebase Authentication or Firestore.
 * Never run Admin SDK tools in the browser or on a publicly accessible server.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const uid = (process.env.TARGET_UID ?? '').trim();
if (!uid || uid.length > 128 || uid.includes('/')) {
  throw new Error('Set TARGET_UID to the exact UID from Firebase Console, not an email address.');
}
const projectId = 'upper-homadola-school';
const expectedEmail = 'u-admin@accounts.upperhomadola.school';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const auth = getAuth();
const db = getFirestore();
const account = await auth.getUser(uid);
const [profileDoc, loginNameDoc] = await Promise.all([
  db.doc(`users/${uid}`).get(),
  db.doc('loginNames/admin').get(),
]);
const profile = profileDoc.exists ? profileDoc.data() : null;
const loginName = loginNameDoc.exists ? loginNameDoc.data() : null;
const checks = {
  expectedFirebaseProject: projectId,
  exactAuthEmailAlias: (account.email ?? '').toLowerCase() === expectedEmail,
  firebaseAccountEnabled: !account.disabled,
  trustedAdminCustomClaims:
    account.customClaims?.schoolAccess === true &&
    account.customClaims?.role === 'admin',
  firestoreProfilePresent: Boolean(profile),
  firestoreProfileActive: profile?.active === true,
  firestoreRoleMatches: profile?.role === 'admin',
  firestoreUsernameMatches: profile?.username === 'admin',
  usernameReservedForUid: loginName?.uid === uid,
};
console.log('Read-only Admin setup verification:');
for (const [key, value] of Object.entries(checks)) {
  if (key === 'expectedFirebaseProject') console.log(`  Project: ${value}`);
  else console.log(`  ${value ? 'PASS' : 'FAIL'} ${key}`);
}
const passed = Object.entries(checks)
  .filter(([key]) => key !== 'expectedFirebaseProject')
  .every(([, value]) => value === true);
if (!passed) {
  console.error('\nSetup is NOT complete. Verify the failing items before using the website.');
  process.exitCode = 1;
} else {
  console.log('\nTrusted records are consistent. Next, test browser login and published Firestore Rules.');
}
