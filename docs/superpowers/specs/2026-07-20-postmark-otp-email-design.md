# Postmark OTP email

## Goal

Send email OTP codes via Postmark so staging/production signup works. Magic-link stays a stub.

## Decisions

- Shared `sendEmail` helper under `src/features/email/server/`
- Wire only `emailOTP.sendVerificationOTP` for now
- From address via `POSTMARK_FROM_EMAIL` (default `gez@curatormtd.co.uk` for Postmark test mode; switch to `noreply@` later)
- Token via existing `POSTMARK_SERVER_TOKEN`
- Always log + `storeOTP` for local/testing; send when token is set
- Throw on send failure so auth does not pretend the email was delivered
- Plain-text body (no HTML template yet)

## Non-goals

- Magic-link / SMS delivery
- Queued/retry email worker
- Fancy templates
