# Alegladi Brain — Production Security Checklist

## Must be true before DNS
- [x] Database production isolated on `alegladi-brain-production` / `brain`
- [x] Core + Boost Engine schema applied and verified
- [x] Rollback branch after schema migration
- [x] Rollback branch after security hardening
- [x] Password login throttled and audited
- [x] Password step required before Google authentication
- [x] Google account allowlist enforced server-side
- [x] OAuth PKCE + random state
- [x] Session tokens random and stored server-side only as hashes
- [x] `__Host-`, Secure, HttpOnly, SameSite cookies
- [x] CSRF/same-origin protection on browser writes
- [x] Legacy unauthenticated AI proxy disabled
- [x] Legacy state API placed behind Brain session
- [x] Public health output redacted
- [x] OAuth tokens encrypted with AES-256-GCM in application storage design
- [x] `.gitignore` blocks env/secrets/backups
- [x] `.env.example` contains names only
- [x] Brain security baseline documented
- [ ] Dedicated private GitHub repository with fresh history
- [ ] Move Brain-only files to private repository without importing old Git history
- [ ] Verify/rotate any secret that may ever have appeared in the public repository/history
- [ ] Create native DB runtime credential that is NOT member of `neon_superuser`
- [ ] Configure Vercel encrypted environment variables
- [ ] Configure production Google OAuth redirect URIs
- [ ] Run production negative tests (401/403/429, CSRF, expired session, revoked session)
- [ ] Verify Google personal + work integrations with read-only scopes
- [ ] Verify Drive live access
- [ ] Configure uptime/watchdog secret and schedule
- [ ] Final security review, then DNS `brain.alegladi.com`

## Clean repository allowlist
Copy only these Brain components into the new private repository unless later reviewed:
- `brain/`
- Brain-specific files under `api/` (exclude legacy Travel OS endpoints)
- `lib/brain-*`
- `lib/token-vault.js`
- `database/brain-schema.sql`
- `database/boost-engine-schema.sql`
- `database/security-hardening.sql`
- `package.json`
- `vercel.json`
- `.gitignore`
- `.env.example`
- `SECURITY.md`

Do not copy the original repository `.git` directory or commit history.
