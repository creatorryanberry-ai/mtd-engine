# Create a ticket via CuratorOS product API key
# POST http://localhost:3000/api/tickets
# Auth: Authorization: Bearer <api-key>
#   (or header X-Curator-Ticket-Api-Key: <api-key>)
# productSource must match the product this key was issued for.
#
# Required: productSource, title
# Optional fields and allowed values are noted in comments below.

curl -X POST 'http://localhost:3000/api/tickets' \
  -H 'Authorization: Bearer cos_tk_signing_in_system_xx0C11DuzPqgHQp_eUsFY0dCYYd0x0qN' \
  -H 'Content-Type: application/json' \
  -d '{
  "productSource": "signing_in_system",
  "title": "Export fails for large CSVs",
  "description": "Steps to reproduce…\nExpected vs actual…",
  "priority": "high",
  "ticketKind": "bug",
  "senderName": "Jane Doe",
  "senderEmail": "jane@example.com",
  "requesterType": "user",
  "requesterId": "FIREBASE_USER_UID_OR_CONTACT_ID",
  "linkedEntityType": "company",
  "linkedEntityId": "CRM_COMPANY_OR_CONTACT_ID",
  "assigneeUserId": "ASSIGNEE_FIREBASE_UID_OR_NULL"
}'

# --- Field reference ---
# productSource   string   required  Product slug (this product: signing_in_system)
# title           string   required  Ticket title
# description     string   optional  Body; seeded as first public comment
# priority        string   optional  low | normal | high | urgent  (default: normal)
# ticketKind      string   optional  bug | feature_request | improvement  (default: bug)
# senderName      string   optional  Display name of requester
# senderEmail     string   optional  Email of requester
# requesterType   string   optional  user | contact
# requesterId     string   optional  User uid or CRM contact id
# linkedEntityType string  optional  contact | company
# linkedEntityId  string   optional  Linked CRM entity id
# assigneeUserId  string   optional  Override product owner; omit to use Admin owner
#
# Success: 201 { "id": "<ticketId>" }
