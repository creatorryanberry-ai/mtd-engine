# Email Receipt Capture

Email Receipt Capture lets each MTD account receive receipts, invoices, CIS vouchers, and landlord statements by email. Mail is only another way in: we store the attachments in that user’s Inbox. We do not auto-process them into the books. The user opens Inbox, chooses the document type, and completes the same scan-and-edit flow they already use for camera and upload.

## What the user sees

Each signed-in account gets one unique inbound address, shown under Settings → Your MTD email. The address looks like `abcdefghijkl@inbox.straightup.tax`: a 12-character token, then the inbound domain. They can copy it and share it with bookkeepers, suppliers, or themselves as a forward-from-Gmail address. Regenerating the address retires the old one; mail to the previous address is no longer accepted.

Waiting items appear on Records as Inbox, with a count. Opening that row goes to Inbox (`/home/inbox`). When a new attachment is stored, the API notifies the signed-in app so Records and Inbox refresh without a pull. Each item can be ignored or processed. Process opens the document with no type selected: the user must choose Receipt (expense), Invoice (income), CIS, or Landlord (when available) before the edit form appears and Save is available. Category is not shown separately: that Process as choice already decides expense vs income. After they save, the inbox item is marked processed and linked to the `mtdTransaction` that was created. Nothing in this path files a return or talks to HMRC by itself.

## What we accept

Inbound mail can carry PDFs and common photos (JPEG, PNG, WebP, HEIC/HEIF). Attachments smaller than 8 KB or larger than 10 MB are dropped, as are typical junk files (logos, signatures, social icons, spacers). Emails with no usable attachment still return success to Postmark so they are not retried; they simply do not create Inbox rows. The same file sent twice while it is already waiting is kept as one Inbox row. After it has been processed or ignored, sending it again creates a new waiting item. Settings → Testing → Clear transactions also deletes that user’s inbox documents and inbound emails (the MTD address stays). Testing tools are shown in local demo mode and when the app is talking to staging.

## Architecture

Postmark owns the mailbox. DNS MX for the inbound domain (`inbox.straightup.tax`, from `INBOUND_EMAIL_DOMAIN`) points at `inbound.postmarkapp.com`. That domain is registered on the Postmark inbound stream. Anyone can send to `token@inbox.straightup.tax`; Postmark receives it, then HTTP POSTs a JSON payload to our API.

The webhook is `POST /api/inbound-email/postmark` on the API host (staging `https://staging-api.straightup.tax`, production `https://api.straightup.tax`). Postmark authenticates with HTTP Basic by embedding the user and password in the webhook URL: `https://USER:PASSWORD@host/api/inbound-email/postmark`. Those values are `POSTMARK_INBOUND_WEBHOOK_USER` and `POSTMARK_INBOUND_WEBHOOK_PASSWORD`. If they are missing, the endpoint returns 503. If they are wrong, 401. We do not ask Postmark to include the raw email body.

The handler does not run OCR and does not create transactions. It parses the recipient, finds the account, stores files, and inserts inbox rows.

```mermaid
flowchart LR
  sender[Sender] --> mx[MX inbox.straightup.tax]
  mx --> postmark[Postmark inbound]
  postmark --> webhook["POST /api/inbound-email/postmark"]
  webhook --> token[Match 12-char token to user]
  token --> store[Private object storage]
  store --> inbox[inboxDocument]
  inbox --> app[Records then Inbox]
  app --> process[User picks type]
  process --> scan[On-device scan and edit]
  scan --> txn[mtdTransaction]
```

Recipient matching only accepts `token@` plus the current `INBOUND_EMAIL_DOMAIN`. The token must be 12 lowercase letters or digits and must exist as an active `inboundEmailAddress` for some `userId`. Unknown or revoked addresses return HTTP 200 with no inbox item. That is deliberate: Postmark retries on non-200, and we do not want retries (or a bounce loop) for mail that will never belong to an account. The same 200-on-unknown behaviour means Postmark Activity can show Processed while Inbox is empty — the webhook succeeded, we chose not to keep the message.

Attachments go through the private receipt store (`uploadPrivateReceipt`): Google Cloud Storage in staging and production, MinIO locally. Object keys are under `inbox/{userId}/email/…`. The database keeps an `mtd-receipt:` ref, not a public URL. List and detail APIs mint a short-lived signed URL only for the owning user.

Processing is client-side and native. Inbox downloads the file, then reuses `scanReceiptFromAsset`, `scanCisVoucherFromAsset`, and `scanLandlordStatementFromAsset` (PDF to JPEG, on-device OCR) and the existing edit screens. The server’s job stops at “file is waiting”.

## Data model

Three tables, all scoped by `userId` with forced row-level security like the rest of customer tax data.

`inboundEmailAddress` is the live mailbox: token, full email, active flag. At most one active address per user. Regenerating sets `isActive` false and `revokedAt`, then inserts a new row.

`inboundEmail` is one Postmark message (provider `postmark`, unique `providerMessageId`). Statuses include Received, Processed, PartiallyProcessed, NoValidDocuments, and Failed. “Processed” here means attachments were stored, not that the user has booked the document.

`inboxDocument` is what Inbox lists: source (Email today; Upload/Camera reserved), filename, mime, size, storage path, SHA-256, and status (New, Duplicate, Ignored, Processed, and so on). When the user finishes Process, we set `mtdTransactionId` and Processed.

Code lives under `src/features/inbox/`. Routes: `app/api/inbound-email/postmark+api.ts` (public, Basic auth) and authenticated `GET /api/inbox`, `GET /api/inbox/{id}`, `POST /api/inbox/{id}/ignore`, `POST /api/inbox/{id}/processed`, `GET /api/inbox/address`, `POST /api/inbox/address/regenerate`.

## Environments

The webhook host and the app’s API must be the same environment. Staging mail must be sent to an address created while the app is talking to `staging-api.straightup.tax`. A local `APP_VARIANT=preview bun ios` address pointed at the local API is stored in local Postgres; Postmark still posts to staging, which will log an unknown token and return 200. Local testing of the webhook itself needs a public tunnel to the dev API, with the Postmark inbound URL pointed at that tunnel.

`INBOUND_EMAIL_DOMAIN` is read at runtime. Changing it does not rewrite addresses already in the database. After a domain change, users (or testers) must regenerate so the stored address uses the new host. The webhook only accepts recipients on the domain the API currently has configured.

## What this is not

It is not an unattended bookkeeping pipeline. We do not guess receipt vs invoice vs CIS vs landlord. We do not run server-side OCR. We do not submit to HMRC from this path. Email is capture only; the user still confirms the numbers in the app.
