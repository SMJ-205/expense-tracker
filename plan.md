Build a low-cost expense tracker that integrates WhatsApp Cloud API with Google Sheets.

Goal:
When a user sends a bill photo to my WhatsApp number, the system should automatically:

1. receive the image via webhook,
2. download the media,
3. run OCR on the bill image,
4. extract structured expense fields,
5. append a row into Google Sheets,
6. reply back to the user on WhatsApp with the parsed result and a short confirmation message.

Primary constraints:

- Must be suitable for low monthly volume and free-tier friendly.
- Prefer Google-native services and minimal infrastructure.
- Avoid paid SaaS automation tools.
- Use a simple architecture that I can maintain myself.
- Design for reliability, idempotency, and clear error handling.
- Keep secrets out of source code.

Recommended stack:

- WhatsApp Cloud API from Meta
- Google Apps Script as the webhook server
- Google Sheets as the expense database
- Google Drive for raw image backups
- Google Cloud Vision OCR for image text extraction
- Apps Script PropertiesService for secrets/config

Deliverables:

1. Architecture overview
2. Step-by-step setup checklist
3. Google Apps Script code
4. Google Sheet schema
5. Webhook verification flow
6. Media download flow
7. OCR integration
8. Parsing logic
9. Duplicate detection
10. Logging and error handling
11. Deployment instructions
12. Test plan with sample payloads
13. README for setup and maintenance

Functional requirements:

- Handle WhatsApp webhook verification GET request.
- Handle WhatsApp message POST webhook events.
- Detect image messages and ignore non-image messages gracefully.
- Fetch the media URL from WhatsApp Graph API.
- Download and store the image in a Drive folder.
- Send the image to OCR.
- Parse the OCR result into:
  - transaction_date
  - merchant_name
  - total_amount
  - tax_amount
  - service_charge
  - category
  - payment_method if available
  - notes
  - confidence_score
  - raw_ocr_text
  - source_message_id
  - image_file_url
  - created_at
- Append a single row to Google Sheets.
- Avoid duplicate inserts by using message ID or media ID.
- Reply to the user in WhatsApp with the extracted fields.
- If confidence is low or total amount is ambiguous, ask for confirmation before writing the final row.
- Make the sheet-friendly and easy to export later.

Non-functional requirements:

- Code should be modular and readable.
- Use environment-like config via Script Properties.
- Include retry/backoff where appropriate.
- Include basic validation and defensive parsing.
- Log failures clearly.
- Keep the system lightweight enough to run on free-tier usage.

Google Sheet columns:
timestamp, source_message_id, wa_sender, merchant_name, transaction_date, total_amount, tax_amount, service_charge, category, notes, confidence_score, raw_ocr_text, image_file_url, status

Parsing rules:

- Prefer extracting total amount from explicit labels like TOTAL, AMOUNT DUE, GRAND TOTAL.
- If multiple amounts are found, choose the most likely final payable total.
- Normalize dates into ISO format.
- Normalize currency values into plain numbers.
- Preserve raw OCR text for auditability.
- When uncertain, mark status as NEEDS_REVIEW instead of guessing.

Security:

- Store tokens in PropertiesService only.
- Do not hardcode secrets.
- Validate webhook requests where possible.
- Do not expose sensitive tokens in logs.
- Add a simple allowlist for sender phone numbers if helpful.

Please generate:

- the Apps Script project structure,
- the code for each file,
- the sheet setup steps,
- and a concise deployment guide.

Before coding, first propose the architecture and ask me to approve the design choices only if there is a genuine technical tradeoff.
