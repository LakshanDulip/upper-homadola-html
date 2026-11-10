# G/Upper Homadola School — HTML/CSS/Vanilla JS

New bilingual implementation (separate from the existing Next.js production repository).

## Current development status

### Phase 1 — public website
- Responsive maroon/white/black homepage
- Sinhala/English switcher; remembers a non-sensitive language preference locally
- Overview of Grades 1–11
- News/gallery placeholders until verified school content is approved

### Phase 2 — authentication foundation (code implemented; setup and live login unverified)
- Firebase Email/Password login with username alias mapping
- Student admission numbers; teacher IDs such as `TCH-0001`; privileged usernames such as `admin`
- Firebase ID token schoolAccess/role claims and Firestore users/{uid} active-role profile check
- Role-specific dashboard shells (all module cards say “coming in next phase”)
- Account Settings with read-only account status and *real Firebase password change requiring current password*
- Local trusted one-time admin bootstrap for an existing verified alias account
- Deny-by-default Firestore rules for current minimal data

**No admin account has been created by committing this code. No Rules or Cloudflare assets have been deployed. No private records management modules are implemented yet.**

## Local preview

Install Git and Python, then:

```powershell
git clone https://github.com/LakshanDulip/upper-homadola-html.git
cd upper-homadola-html
python -m http.server 8080
```

Open http://localhost:8080/. The Firebase module imports use the official versioned Firebase CDN and require an internet connection.

Do not open `index.html` using `file://` because ES modules need a web origin.

## Firebase configuration

The frontend in `js/firebase.js` uses the **public Firebase Web SDK config** for Firebase project `upper-homadola-school`. Public Firebase config identifiers are not service account credentials. The *Firebase Admin SDK* is never imported by public frontend scripts.

1. In Firebase Console → Authentication → Sign-in method, enable Email/Password.
2. In Authentication → Settings → Authorized domains, add the actual website hostname(s), including localhost for local sign-in where required and `lakshandulip.github.io` if using GitHub Pages.
3. Enable Cloud Firestore for the same project.
4. Review `firestore.rules` and deploy with Firebase Console or Firebase CLI from an authorized account. **IMPORTANT:** This Firebase project is also used by the older Next.js site. Deploying Rules affects both websites. Confirm compatibility before publishing.
5. All users need trusted server-side claims `{schoolAccess:true,role:"student"|"teacher"|...}` plus Firestore `users/{uid}` containing `{username,role,active:true}`.
6. No user may assign their own role, activate their own profile or create another person's account via browser JavaScript.

### One-time admin bootstrap (Windows PowerShell)

**Only the authorized school operator should do this.** Before proceeding, check that nobody has already provisioned the admin account for this Firebase project.

- Create an Email/Password user in Firebase Console with email alias `u-admin@accounts.upperhomadola.school`, and a unique strong password that you **do not paste into ChatGPT, GitHub or a terminal command**.
- Copy and independently verify that user's Firebase UID from Authentication → Users.
- On a trusted PC install Node.js and Google Cloud CLI. Sign in with an authorized Google account:
  ```powershell
  gcloud auth application-default login
  ```
- From the repository directory install the local-only Admin SDK:
  ```powershell
  npm install
  ```
- In the *same* PowerShell terminal, supply the UID from Firebase Console:
  ```powershell
  $env:CONFIRM_BOOTSTRAP = "YES"
  $env:TARGET_UID = "<verified Firebase UID>"
  node scripts/bootstrap-existing-admin.mjs
  Remove-Item Env:CONFIRM_BOOTSTRAP,Env:TARGET_UID
  ```

The script refuses to grant access to an Auth user whose email is different from the exact alias, is disabled, already has claims, or is already in the school profile/username index. It creates a temporarily inactive profile, then assigns the Admin claim, then activates the profile. If partially interrupted, *do not rerun blindly*—inspect actual Auth claims and Firestore records as an administrator before any repair.

This script does not create a real email inbox for the alias. Password recovery must be handled by a trusted school administrator. Privileged MFA and appropriate recovery controls are strongly recommended before production use.

### Student/teacher provisioning

Account creation for Student and Teacher roles **is not implemented in this repository yet**. Do not insert passwords into `js/` files, Firestore, GitHub or localStorage. Create an audited trusted Admin SDK/Worker provisioning workflow in the next phase, using unique school IDs and permission checks.

## Current authorization behavior

- A successful Firebase password login is *not sufficient* to open a dashboard.
- The browser also requires a signed Firebase Custom Claim for a recognized role, `schoolAccess:true`, and a matching active Firestore user profile.
- The dashboard compares the signed role with the route's role, and reroutes other legitimate roles to their correct dashboard.
- This frontend guard controls UI only. **Firestore Rules and the future Cloudflare Worker backend enforce private data permissions**. Do not put private student or teacher information in static HTML/JS.
- Current Firestore rules permit signed-in authorized accounts to fetch only their own minimal status profile; deny all other browser reads and all writes.

## Account Settings

The **Change Password** form requires a current password, a new password of at least 12 characters, confirmation and Firebase reauthentication. When password update succeeds, the user is signed out to re-login. Username, role and active status are read-only.

User profile editing, secure password recovery, MFA, remote session management and detailed account audit logs are **future work**. Never present these as implemented until tested and deployed.

## Files

- `index.html`, `css/style.css`, `js/main.js`, `js/i18n.js`: public pages
- `login.html`, `css/auth.css`, `js/login.js`, `js/auth-i18n.js`: login UI
- `js/firebase.js`, `js/auth.js`: Firebase web access and signed role/profile checks
- `dashboards/*.html`, `js/dashboard.js`: role-specific UI and Account Settings
- `firestore.rules`: draft Firestore rules (manual deployment required)
- `scripts/bootstrap-existing-admin.mjs`: trusted local Admin SDK bootstrap (never deploy to browser)

## Test checklist

1. `npm run check` checks JS syntax.
2. Test Sinhala/English switcher on home, login and dashboard; refresh to verify preference.
3. Verify wrong credentials fail without disclosing whether an account exists.
4. Verify unprovisioned, missing-claims and disabled accounts cannot enter dashboard.
5. Verify correct role accesses its own page and not another role's page.
6. Verify password change rejects incorrect current password; confirm valid change forces re-login.
7. Verify Firestore Rules with Firebase Emulator before production, including blocked student/teacher reads, unauthorized writes and directory listing.
8. Browser visual and accessibility smoke tests on desktop and mobile.
9. Verify GitHub Pages/Cloudflare deployment separately; GitHub push alone does not deploy.

No browser end-to-end tests or production sign-in have been performed merely by committing these files.

## Next phase
Secure Student/Teacher account provisioning, admin-managed roles/responsibilities, protected APIs with audit logging, actual school modules, Cloudflare R2 and CMS.

Developed by Lakshan.
