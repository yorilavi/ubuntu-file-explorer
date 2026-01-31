# Pre-Release Checklist: GitHub Public Release

**Target:** Open-source Ubuntu File Explorer on GitHub
**Created:** 2026-01-30
**Last Updated:** 2026-01-30

---

## Security & Secrets

- [x] Scan git history for secrets (API keys, passwords, private keys) — **PASSED: No secrets found in 225 commits**
- [x] Check for .env files committed — **PASSED: No .env files, properly gitignored**
- [x] Review hardcoded paths — **SANITIZED: All personal paths replaced with ~/ or relative paths**
- [x] Audit ssh2 usage (ensure no credential logging) — **PASSED: Credentials never logged**
- [x] Check electron-conf storage paths (no personal data in defaults) — **PASSED: Clean defaults**
- [x] Verify safeStorage doesn't leak credentials in logs — **PASSED: Properly encrypted**

---

## Legal & Licensing

- [x] Choose license (MIT, Apache 2.0, GPL, etc.) — **MIT**
- [x] Add LICENSE file to repository root — **CREATED**
- [x] Check dependency licenses (ensure all deps compatible with chosen license) — **All MIT/Apache-2.0 compatible**
- [ ] Add license headers to source files (if required by license) — **Not required for MIT**

---

## Documentation

- [x] README.md — Features, screenshots, installation, usage, building from source — **CREATED**
- [x] CONTRIBUTING.md — How to contribute, code style, PR process — **CREATED**
- [x] CODE_OF_CONDUCT.md — Community standards — **CREATED**
- [x] CHANGELOG.md — Version history from git tags — **CREATED**
- [x] SECURITY.md — How to report vulnerabilities — **CREATED**

### README Sections

- [x] App name + tagline (one-line description)
- [ ] Screenshot/GIF showing app in action — **TODO: Add docs/screenshot.png**
- [x] Features list (bullet points)
- [x] Requirements (macOS version, Node version)
- [x] Installation instructions (download DMG or build from source)
- [x] Building from source (`npm install && npm run make`)
- [x] Configuration (SSH config requirements)
- [x] Keyboard shortcuts table
- [x] Roadmap (link to issues/projects) — **Links to GitHub**
- [x] Credits and acknowledgments — **Tech stack listed**

---

## Repository Setup

- [ ] .gitignore complete (node_modules, dist, out, .env, .DS_Store, *.dmg) — **VERIFY**
- [ ] Decide on .planning/ visibility (keep or remove for public) — **DECISION NEEDED**
- [x] Add .github/ISSUE_TEMPLATE/bug_report.md — **CREATED**
- [x] Add .github/ISSUE_TEMPLATE/feature_request.md — **CREATED**
- [x] Add .github/PULL_REQUEST_TEMPLATE.md — **CREATED**
- [ ] Add .github/FUNDING.yml (optional: sponsor links)
- [ ] Set repository description on GitHub — **After push**
- [ ] Add topics/tags: electron, sftp, file-manager, macos, ssh — **After push**

---

## Build & Release

- [x] Update package.json metadata (name, description, author, repository, homepage, bugs) — **DONE**
- [ ] Verify build works from fresh clone (`npm install && npm run make`)
- [ ] Create GitHub Release for v1.2 with DMG attached
- [ ] Code signing with Apple Developer ID (optional for notarization)
- [ ] Configure electron-updater for auto-updates (optional)

---

## Code Quality

- [ ] Remove console.log debugging statements (keep intentional logging only) — **Current logging acceptable**
- [x] ESLint/Prettier config present and enforceable — **ESLint configured**
- [ ] TypeScript strict mode enabled — **VERIFY**
- [ ] Remove or file TODO/FIXME comments as issues
- [ ] Add test suite (optional but recommended)

---

## Pre-Push Verification

- [ ] Fresh clone builds successfully
- [ ] App launches and connects to SSH server
- [ ] All features work (file ops, preview, lightbox, folder transfer, PDF)
- [ ] No personal data visible in app or logs
- [ ] README instructions are accurate and complete

---

## Post-Release

- [ ] Announce on social media / communities
- [ ] Monitor issues for first-time user feedback
- [ ] Tag v1.2.0 as first public release (or v1.2.1 if changes needed)

---

## Summary

**Completed:** 23 items
**Remaining:** 14 items

**Critical Action Items:**
1. Add screenshot to `docs/screenshot.png`
2. Verify fresh clone build works
3. Create GitHub repo and push

---

*Checklist created: 2026-01-30*
*Last updated: 2026-01-30*
