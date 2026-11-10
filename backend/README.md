# Secure Student & Teacher API — Google Cloud Run

This is the trusted backend for the HTML/CSS/Vanilla JS GitHub Pages admin dashboard.

**Code status:** Backend source is in GitHub; deployment is a separate step. No real student or teacher accounts are created until a school operator deploys this API and the dashboard API URL is configured.

## Security architecture

- Backend uses attached Cloud Run service account through Google Application Default Credentials (ADC). **No service account private keys are uploaded anywhere.**
- Public HTTPS endpoint rejects requests without a valid Firebase signed ID token. `verifyIdToken(token, true)` checks revoked tokens.
- Each request requires signed custom claims `schoolAccess:true, role:admin` **AND** an active Firestore `users/{uid}` profile with role admin.
- Only student/teacher role creation is allowed. Client never selects a privileged role. Username/role/UID are never editable by the client.
- Firebase Auth accounts are created **disabled**; Firestore username is reserved transactionally, profile inserted inactive, trusted claims set, Auth enabled, and profile activated.
- Teacher IDs `TCH-0001`, `TCH-0002`, ... come from a Firestore transaction-backed sequence. Numbers may be skipped if a failed provisioning step needs reconciliation; **never reuse IDs**.
- Student admission number remains permanent and manually assigned.
- Passwords are passed over HTTPS directly to trusted backend, never stored in Firestore, static JS, GitHub, or logs. Student initial passwords accept 6–128 characters, including numeric-only strings, but cannot match the admission number. Teacher initial passwords require 12–128 characters. Short numeric-only passwords are easily guessed and should be avoided.
- Audit logs record actor UID, target UID, action and timestamps, **not passwords**.
- GET /api/accounts returns up to **100** results per role. Pagination is not implemented; UI explicitly says so. Never mistake 100 for the entire population.
- Changes to roles and privileged accounts are out of scope.
- Profile edit supports display name and student grade, or teacher subject and assigned-grade lists. This does not yet implement subject-teacher permission checks or grade-teacher uniqueness, which need a later policy review.

## Endpoints

- `GET /health` — status only, unauthenticated
- `GET /api/accounts?role=student|teacher` — list first 100
- `POST /api/accounts` — create student or teacher
- `PATCH /api/accounts/:uid` — edit approved profile fields
- `PATCH /api/accounts/:uid/status` — enable or disable accounts

Every `/api/` endpoint requires an Admin ID token.

## Cloud Run deployment — browser-only Google Cloud Shell

1. Open [Google Cloud Console](https://console.cloud.google.com/?project=upper-homadola-school&cloudshell=true) and Cloud Shell.
2. Run `git clone https://github.com/LakshanDulip/upper-homadola-html.git` if not cloned; otherwise `cd ~/upper-homadola-html && git pull`.
3. Ensure billing is enabled for Cloud Run and that your account can enable APIs and assign IAM roles.
4. Create a **dedicated runtime service account** for the API. Use least privilege for Firebase Authentication admin operations and Firestore reads/writes. Example:

   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   gcloud iam service-accounts create school-admin-api --display-name="Upper Homadola School Admin API"
   gcloud projects add-iam-policy-binding upper-homadola-school \
      --member="serviceAccount:school-admin-api@upper-homadola-school.iam.gserviceaccount.com" \
      --role="roles/firebaseauth.admin"
   gcloud projects add-iam-policy-binding upper-homadola-school \
      --member="serviceAccount:school-admin-api@upper-homadola-school.iam.gserviceaccount.com" \
      --role="roles/datastore.user"
   ```

   Confirm those roles are appropriate for your organization. If the account already exists, do not run the create command again.

5. Deploy from the project directory:

   ```bash
   cd ~/upper-homadola-html
   gcloud run deploy upper-homadola-school-admin-api \
     --source ./backend \
     --project upper-homadola-school \
     --region asia-south1 \
     --service-account school-admin-api@upper-homadola-school.iam.gserviceaccount.com \
     --allow-unauthenticated \
     --set-env-vars PROJECT_ID=upper-homadola-school,ALLOWED_ORIGIN=https://lakshandulip.github.io
   ```

   Why `--allow-unauthenticated`? Firebase ID token, not Google Cloud IAM token, is used by the website; **the application rejects all unauthorized /api requests**, including signed-in non-admin users. Restrict CORS to the GitHub Pages origin. In production, add Cloud Armor/rate limiting, logging/monitoring and secure recovery controls.

6. Copy the Cloud Run **HTTPS service URL**. A repo maintainer must put that public URL into `js/api-config.js` as `API_BASE_URL`. Do not put any secret there.
7. Wait for GitHub Pages to deploy, sign in to Admin and open **Student Management** / **Teacher Management**. First test lists, then a single school-authorized test record.

## Firebase Security Rules

The existing `firestore.rules` remains deny-by-default and has no public/student/teacher writes. The Admin SDK server bypasses Firestore client Rules and uses Google IAM and trusted request verification. **Do not relax Firestore Rules to allow client creation of privileged accounts.**

## Operational cautions

- Deploying a backend with Firebase Admin access is a security-sensitive operation. Review deployment source, IAM grants and project ownership with an authorized operator before carrying out the commands.
- A single failed network operation can leave an Auth user disabled and/or a Firestore profile inactive. The API deliberately stops rather than silently reusing that ID. Inspect Firestore `users`, `loginNames` and Firebase Auth for repair.
- Teacher ID sequence must not be reset after it has started.
- Production needs MFA for privileged admins, stronger rate limiting, monitoring and formal role/grade assignment workflows.
- This stage does not create actual schedules, marks, library stock or homework modules.
