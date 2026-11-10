# G/Upper Homadola School — Cloudflare Workers backend

## Stage and expectations

The Worker **source is ready for deployment/testing**, not yet deployed by ChatGPT. It replaces the **hosting runtime**, while keeping Firebase Authentication and Firestore records in the same existing Firebase project. **The existing Next.js website and the old Cloud Run code are not changed.**

The Worker uses native JavaScript, WebCrypto and Google REST services rather than the Node-only Firebase Admin SDK. Accounts cannot be created through the public HTML page alone.

**Important:** The Firebase Identity Toolkit Admin REST account-creation route has not yet been integration-tested against this Firebase project. Keep writes disabled until you complete a controlled non-production integration test. Code syntax tests do not prove the Google REST endpoints or Cloudflare deployment work.

## Fixing 404 on /health — Cloudflare dashboard, GitHub-only

The existing Cloudflare Worker URL supplied by the school operator is
`https://upper-homadola-html.lxn4096.workers.dev/`.
The previous Wrangler config used a **different Worker name**, so deployment could
have updated a different Worker while this existing URL still served an old starter script.
The Wrangler `name` is now **upper-homadola-html** to target the existing Worker.

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **upper-homadola-html**.
2. Open **Settings -> Builds** (or **Settings -> Build & Deploy**).
3. Confirm the Git connection points to `LakshanDulip/upper-homadola-html`, production branch `main`. If not connected, use **Connect to Git** and authorize this repository.
4. For a repository-root build (no Root Directory field), set **Deploy command** exactly:
   ```text
   npx --yes wrangler deploy --config cloudflare-worker/wrangler.toml
   ```
   Leave the build command blank unless the Cloudflare UI requires one. If it requires one, use `npm install`. Do **not** use a Pages static-site deploy command.
5. If the dashboard supports a Root Directory setting, it can instead be `cloudflare-worker`; then use `npx wrangler deploy`. Do **not** combine this root setting with the repo-root `--config cloudflare-worker/wrangler.toml` path.
6. **Save** build settings and select **Deploy latest commit** / **Retry deployment** (label varies). Merely changing GitHub source is not proof Cloudflare deployed.
7. Verify [Worker health endpoint](https://upper-homadola-html.lxn4096.workers.dev/health). Expected without credentials:
   ```json
   {"status":"ok","writeEnabled":false,"credentialsConfigured":false}
   ```
   If still 404, inspect **Deployments** to see if the latest deployment is associated with `upper-homadola-html` and the config entrypoint `cloudflare-worker/src/index.js`. Check **Build logs** for Wrangler errors. Do not paste secrets or authorization tokens.

## Next steps after /health works

- **First deployment is read-only.** The `ENABLE_ACCOUNT_WRITES` variable remains `"false"`; never change it merely to fix a 404.
- A private encrypted Worker secret `FIREBASE_SERVICE_ACCOUNT_JSON` is needed before any Firebase reads/writes are possible. Never store its JSON in GitHub or paste it into a chat. Creating a long-lived service account key incurs security risk; consider keyless federation with an appropriate trusted provider if feasible.
- Check unauthenticated `/api/accounts?role=student` returns 401. Perform permission and read-only integration tests before allowing writes.
- Only after isolated safe integration tests should the API configuration be connected in `js/api-config.js`. A live /health response does **not** prove account creation works.

**Cloudflare account ownership is separate from GitHub.** These GitHub changes cannot operate the user's Cloudflare account or trigger a deployment unless the Cloudflare Git integration is connected.

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
