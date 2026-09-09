# Alegladi Brain — Security Baseline

This repository must never contain production secrets or private operational data.

## Authentication
- Password is only the first step.
- Production login requires password + the explicitly allowed Google account.
- Sessions are random, server-side, revocable and stored only as SHA-256 token hashes.
- Session cookies use the `__Host-` prefix, `Secure`, `HttpOnly` and `SameSite=Strict`.
- Login attempts are persistently rate-limited and audited.

## API protections
- State-changing browser APIs require an authenticated session and same-origin validation.
- Agent/automation APIs require separate bearer credentials.
- Legacy AI proxy is disabled.
- Public health output must never expose secrets, provider configuration or database errors.

## Data and database
- OAuth credentials are encrypted application-side with AES-256-GCM.
- Production application credentials must not use the database owner role.
- Browser/PWA caches must never persist API responses or private operational data.
- Database backups/rollback branches must exist before important migrations.

## Deployment rules
- Production Brain belongs in a dedicated PRIVATE repository with fresh Git history.
- Never import the Git history of `indonesia-travel-os` into the private Brain repository.
- Configure secrets only in the deployment provider's encrypted environment-variable store.
- Do not connect `brain.alegladi.com` until authentication, database, Google integrations, backup/rollback and security checks pass in production.

## Required production secrets
See `.env.example` for variable names only. Real values must never be committed.

## Incident rule
If a credential is suspected to have appeared in source code, Git history, logs, screenshots, chat exports or an unintended deployment, treat it as compromised and rotate it rather than merely deleting the visible copy.
