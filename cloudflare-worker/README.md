# G/Upper Homadola School — Cloudflare Workers backend

## Stage and expectations

The Worker **source is ready for deployment/testing**, not yet deployed by ChatGPT. It replaces the **hosting runtime**, while keeping Firebase Authentication and Firestore records in the same existing Firebase project. **The existing Next.js website and the old Cloud Run code are not changed.**

The Worker uses native JavaScript, WebCrypto and Google REST services rather than the Node-only Firebase Admin SDK. Accounts cannot be created through the public HTML page alone.

**Important:** The Firebase Identity Toolkit Admin REST account-creation route has not yet been integration-tested against this Firebase project. Keep writes disabled until you complete a controlled non-production integration test. Code syntax tests do not prove the Google REST endpoints or Cloudflare deployment work.

## Cloudflare dashboard (no computer installation)

1. Cloudflare Dashboard -> **Workers & Pages** -> **Create** -> **Worker**.
2. Choose **Connect to Git** if offered, authorize GitHub, then select **LakshanDulip/upper-homadola-html** and branch `main`.
3. Set the **root directory** to `cloudflare-worker` (if shown). Deploy command: `npx wrangler deploy`. If the interface offers only a starter Worker, create it first, then connect the Git repository through its Settings/Build configuration. Exact labels can differ.
4. Confirm the Worker name is `upper-homadola-school-api` and config points to `cloudflare-worker/wrangler.toml`.
5. The Worker deployment should provide a URL such as `https://upper-homadola-school-api.<account-subdomain>.workers.dev`. This is a PUBLIC endpoint URL, not a secret. Do not guess it.
6. Open `https://<your-worker-url>/health`. Expected:
   ```json
   {"status":"ok","writeEnabled":false,"credentialsConfigured":false}
   ```
7. In **Settings -> Variables and Secrets**, set **FIREBASE_SERVICE_ACCOUNT_JSON** as **Secret (encrypted)** to the full valid GCP service-account JSON. This is sensitive. Never post it in chat, GitHub, a screenshot or a commit. Use a dedicated, scoped service account, not your Google user account. The `school-admin-api@upper-homadola-school.iam.gserviceaccount.com` service account previously created for Cloud Run can be reused only if the project owner consciously authorizes key issuance. Creating a JSON private key increases risk; prefer short-lived workload identity federation when available.
8. Keep `PROJECT_ID=upper-homadola-school`, `ALLOWED_ORIGIN=https://lakshandulip.github.io` and `ENABLE_ACCOUNT_WRITES=false` as configured in `wrangler.toml`.
9. Verify `/health` now shows `credentialsConfigured:true` and `writeEnabled:false`.
10. The Worker must pass authorization checks: unauthenticated `/api/accounts` returns **401**, invalid/non-admin sessions are rejected, and an authorized Admin token can list `/api/accounts?role=student`.
11. Only after safe read-only integration testing of Firestore/Firebase REST APIs and controlled account creation in an isolated test project, change `ENABLE_ACCOUNT_WRITES` to `"true"` and redeploy. **There is no one-click live-account-creation guarantee at this stage.**
12. Once a verified Cloudflare Worker URL is available, configure `js/api-config.js` with that URL and push to GitHub. Do not put a secret in that file.

**Cloudflare account ownership is separate from GitHub access.** Connecting the GitHub repository or deploying a Worker requires explicit Cloudflare account authorization through its dashboard; a GitHub push cannot silently deploy to an unconnected Cloudflare account.

## Firebase permissions and security

- All `/api/` endpoints require a valid Firebase ID token with Google RSA signature, correct project audience and issuer, `schoolAccess:true`, `role:admin`, **and** an active matching Firestore admin profile.
- The account also has to be enabled in Firebase Auth and have a non-revoked ID token; the Worker checks `validSince`.
- The server uses OAuth 2.0 service account tokens to call Google REST APIs.
- Firebase Auth account provisioning uses a **disabled-first** approach. Firestore user and username reservation are committed together with an audit entry before activation.
- User IDs, roles, passwords and audit history must not be writable by GitHub Pages / client Firestore rules.
- The Worker uses a single project-wide service-account secret; secret rotation, credential monitoring, rate limiting, key issuance restrictions, and MFA for Admins should be arranged before production.
- The Cloudflare free tier has request limits. Google Firebase/Firestore usage limits and charges remain separate.
- Six-character student passwords (including digits-only) are possible by policy but weak: do not set them equal to admission numbers, birthdays or obvious sequences.

## Testing locally (optional)

```bash
cd cloudflare-worker
npm install
npm test
npx wrangler dev
```

The GitHub Actions workflow includes Worker code syntax checks and smoke tests. These tests verify routing, 401/403 behavior and default write-off mode, not Google service integration.

## Troubleshooting

- **Deployment missing / not linked:** Check Cloudflare Worker Deployments.
- **Worker returns 503 credentials not configured:** Configure encrypted Worker secret, not a public variable.
- **Worker returns 502 Firebase backend operation failed:** Check the attached service-account permissions, Google Identity Toolkit/Firestore API availability, and Cloudflare runtime logs (never log passwords).
- **Account writes are disabled:** Expected protective behavior until tests are complete.
- **Admin still sees "backend not deployed":** The public Worker URL has not yet been put into `js/api-config.js`.
