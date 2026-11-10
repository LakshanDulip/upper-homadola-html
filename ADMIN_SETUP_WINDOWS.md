# First Admin Setup — Windows PowerShell

Applies to the new static HTML/CSS/JavaScript School Portal at:
https://lakshandulip.github.io/upper-homadola-html/login.html

**State:** GitHub code exists, but the first real admin account requires authorized setup in Firebase. Connecting GitHub does **not** grant this assistant access to the user's Google Cloud credentials. Never paste any private key, Firebase password, access token or service account JSON into ChatGPT, GitHub, Discord or screenshots.

## 0. Confirm the correct project

- Firebase project: `upper-homadola-school`
- Username shown in website: `admin`
- Firebase internal alias: `u-admin@accounts.upperhomadola.school`
- The alias need not receive mail; **self-service email recovery will not work** unless you configure an actual recovery workflow.
- Do not create an additional Admin account if one already exists.
- If an existing administrator was bootstrapped through the older Next.js repository using a different email address, review both accounts carefully; the new login username `admin` maps specifically to the alias above.

## 1. Firebase Authentication (browser console)

Open https://console.firebase.google.com/project/upper-homadola-school/authentication/users

Verify **Email/Password** sign-in is enabled.

Find the account with the exact alias `u-admin@accounts.upperhomadola.school`.

If missing, and you are the authorized school operator, use **Add user** to create it with a unique, strong password. Choose a password in Firebase Console, **never** in a `.js`, `.env`, PowerShell command, README, or chat message.

Copy the exact **User UID** (not the email) from Firebase Authentication → Users.

## 2. Configure authorized website domain

Open Firebase Console → Authentication → Settings → Authorized domains:

- `lakshandulip.github.io` — GitHub Pages
- `localhost` — local testing if applicable

Do not add `https://`, path segments or `.git` to domains. Never remove existing authorized production domains.

## 3. Install tools locally

Install Node.js LTS, Git for Windows and Google Cloud CLI on your trusted PC.

Clone:
```powershell
git clone https://github.com/LakshanDulip/upper-homadola-html.git
cd upper-homadola-html
npm install
npm run check
```

If you cloned earlier, from inside the folder use `git pull` rather than cloning again.

## 4. Authorize Google Application Default Credentials (ADC)

Sign in with a Google Cloud account **authorized to manage Firebase Authentication users, Firestore and IAM** for the project:
```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project upper-homadola-school
```

Your project must permit quota assignment by your selected Google account. If this command fails, inspect permissions rather than pasting credentials anywhere.

Depending on the cloud environment, Admin SDK ADC may need additional project-level roles and setup. Follow the official Firebase Admin SDK guidance; use least-privilege permissions.

## 5. One-time Bootstrap (MODIFIES FIREBASE — run deliberately)

Check again that you have the correct UID and that the intended account belongs to the authorized school operator.

```powershell
$env:TARGET_UID = Read-Host "Paste the verified Firebase Admin UID"
$env:CONFIRM_BOOTSTRAP = "YES"
node scripts/bootstrap-existing-admin.mjs
Remove-Item Env:CONFIRM_BOOTSTRAP
```

This script:

1. Requires the exact UID from Auth and exact admin alias email.
2. Refuses disabled accounts, existing Custom Claims or an existing school profile/index.
3. Creates an *inactive* profile and username index.
4. Assigns signed Firebase Custom Claims `{ schoolAccess: true, role: "admin" }`.
5. Activates the profile.

If interrupted, the script may leave partial records intentionally **without** blindly overwriting them. Do not retry without inspection.

## 6. Check Admin records (READ-ONLY)

In the same PowerShell terminal:

```powershell
node scripts/verify-admin.mjs
Remove-Item Env:TARGET_UID
```

All eight checks must report **PASS**. The verifier never writes to Firebase.

A PASS is a *configuration consistency check*, not evidence that the user can log in from a browser or that Firebase Rules are published.

## 7. Firestore Security Rules

The repository includes `firestore.rules`. Review the file in the repository and go to:

https://console.firebase.google.com/project/upper-homadola-school/firestore/rules

**WARNING:** This Firebase project is shared with the existing Next.js production site. Publishing Firestore Rules affects both websites. Review compatibility first, back up the current published rules, test with Firebase Emulator and only publish with the authorized operator's approval.

The supplied rule set only permits users with a trusted signed school role to read their own `users/{uid}` document and denies all client writes and other reads. Future student/teacher workflows require separately reviewed rules and backend APIs.

## 8. Browser test

Open https://lakshandulip.github.io/upper-homadola-html/login.html

- Username: `admin`
- Password: the secure password *you created in Firebase Authentication*

Expected: redirected to `dashboards/admin.html`, if Firebase Auth, profile, Custom Claims, network and published Rules are all correctly configured.

Test that incorrect credentials fail. Test that opening a different role's dashboard URL does not grant access. Under Account Settings, verify read-only role/status fields. Test Change Password only if prepared to replace the real password, then confirm sign-out and fresh login.

Do **not** enter real students or teachers into the new system until Rules and privileged account security have been reviewed.

## 9. Security before real student data

- Require MFA for privileged accounts and confirm a reliable password recovery procedure.
- Review and test Firestore Rules with Firebase Emulator.
- Do not store usernames/password lists in `js/`, public GitHub or browser storage.
- Use trusted provisioning workflows for student/teacher logins, with admission number or teacher ID as username.
- School private photos require Cloudflare R2 private storage and verified Worker authorization.
- All API authorization must be enforced independently from UI hiding.

## Check status

`npm run check` checks syntax. GitHub Actions runs syntax validation for commits. Neither test provisions an account or proves live login is working.

Developed by Lakshan.
