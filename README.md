# G/Upper Homadola School — HTML, CSS & JavaScript

Phase 1 of the new **bilingual school website**. This is a separate repository from the existing Next.js project. It is a public website foundation, **not** a complete school management system yet.

## Included in Phase 1
- Responsive, accessible, maroon/white/black editorial homepage
- Sinhala and English language switcher across homepage and portal page
- Language preference stored locally (non-sensitive preference only)
- Mobile navigation, section scrolling, back-to-top, keyboard support
- Grades 1–11 overview, About, News placeholder, Gallery placeholder and Contact section
- No invented school statistics, fabricated official contact information or unapproved student images
- Honest School Portal placeholder; **no authentication is implemented yet**

## Run locally
Open this folder in VS Code and use the **Live Server** extension on `index.html`, or run a local static server:
```sh
python -m http.server 8080
```
Then visit http://localhost:8080. Use an HTTP server rather than opening files directly from disk because the frontend uses JavaScript ES modules.

## Architecture
- `index.html` — public school landing page
- `login.html` — honest portal coming-soon page (not an authentication form)
- `css/style.css` — design system, layout, responsive styles
- `js/i18n.js` — centralized Sinhala/English translation dictionary
- `js/main.js` — accessible interactions, navigation, translation control

## Verify
1. Load `index.html` and verify there are no browser console errors.
2. Switch between **සිං** and **EN** and confirm all headings, links, descriptions and notices change.
3. Refresh and confirm language choice persists.
4. Test desktop and narrow mobile layout, the menu, anchor links and the Back to top button.
5. Open **Sign in**; it must not ask for credentials or pretend to authenticate users.

## Next phases
Firebase Authentication with secure username aliases and server-assigned claims; student/teacher/admin role gates; protected Cloudflare Worker APIs; Firestore rules; admin account settings and password change; modules for grades, attendance, exams, homework, timetable, library, question bank, notifications, school CMS and Cloudflare R2.

**Do not put passwords in JavaScript files, GitHub, or browser storage.** This repository is publicly readable.

## Deployment
Static assets are compatible with a conventional static host. **GitHub Pages is not automatically enabled by these files.** Configure Pages explicitly if desired, after verifying the website. The existing Next.js production app is unaffected.

Developed by Lakshan.
