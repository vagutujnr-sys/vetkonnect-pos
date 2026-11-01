# VETKONNECT POS
## Supabase-Backed, Offline-Capable Veterinary POS & Practice Management

Build a production-ready veterinary management application branded as:

**VetKonnect-POS**

Practice name and logo are configured per organization; do not hard-code a clinic brand.

This is NOT a generic POS system.

It is a purpose-built veterinary application combining:

- Patient management
- Owner/client management
- Veterinary consultations
- Services
- Pharmacy
- Medication dispensing
- Vaccinations
- Prescriptions
- Inventory
- Feed and accessories
- POS/sales
- Receipts
- Vaccination certificates
- Printing
- Audit trails
- Supabase-backed online operation
- Bounded offline POS operation and queued synchronization
- Future audio clinical notes and AI transcription

The system is intended to be adopted by real veterinary staff immediately.

The priorities are:

**SPEED → SIMPLICITY → RELIABILITY → CLINICAL USABILITY → PROFESSIONAL DESIGN**

Do not overengineer the UI.

Do not make it look like an AI-generated SaaS dashboard.

---

# 1. TECHNOLOGY

Use:

- Next.js
- TypeScript
- Supabase as the only online database
- Local Next.js APIs/server actions
- PWA capabilities
- Browser-local POS cache and durable sales queue for offline use
- Print-optimized HTML/CSS
- Modular printer service
- UUID primary identifiers
- Secure PIN hashing
- Proper database transactions

Run the application at its configured deployment URL. Do not add Prisma,
SQLite, or another local database. General patient, clinical, inventory, and
administrative features require connectivity; only the agreed POS workflow
uses browser-local data while offline.

---

# 2. FUNDAMENTAL ARCHITECTURE

Supabase is the online source of truth. The installed browser app provides a
bounded offline POS mode using a per-device cache and durable queued sales.

Architecture:

TABLETS / PHONES
        │
        ├── Online → Next.js server → Supabase
        │
        └── Offline → cached POS catalog + IndexedDB sales queue
                         │
                         └── reconnect → idempotent Supabase sync

Keep Supabase service-role credentials on the server only. Offline access is
limited to the signed-in user and cached POS data on that browser/device.
Refresh the catalog each morning and after successful sync. Allow configurable
offline windows of 30 minutes, 1 hour, 4 hours, or 8 hours. Preserve queued
sales after a window expires and require sync before starting the next workday.

---

# 3. DEVICE STRATEGY

THIS IS CRITICAL.

The operational application is primarily designed for:

1. TABLETS
2. MOBILE PHONES

Desktop is primarily for the server-side Super Admin console.

DO NOT design a desktop application and then simply make it responsive.

Design the operational application MOBILE/TABLET FIRST.

Target:

Mobile:
360px – 480px

Tablet:
600px – 1024px

Desktop:
1024px+

Tablet UX is particularly important.

Veterinarians should comfortably carry a tablet during consultations.

---

# 4. PWA

Make the operational application installable as a PWA.

When installed it should:

- open standalone
- use VetKonnect-POS product branding and the configured practice identity
- have an application icon
- have a splash screen
- hide unnecessary browser chrome
- feel like an installed veterinary application

The PWA uses Supabase-backed online data and the bounded browser-local POS
cache and queue when the network is unavailable.

---

# 5. VISUAL DESIGN

Create a premium, clean, professional veterinary interface.

VetKonnect's primary brand direction uses pet-friendly greens.

Use:

- warm white/off-white backgrounds
- restrained veterinary green
- dark charcoal text
- subtle grey borders
- generous but controlled spacing
- clear typography
- clean form controls
- professional icons
- subtle status colours
- very limited shadows

DO NOT USE:

- excessive rounded cards
- giant cards
- excessive gradients
- glassmorphism
- huge headings
- excessive whitespace
- emoji as application icons
- unnecessary animations
- overly colourful dashboards
- generic AI dashboard styling

Corners should be modest.

The application should look like professional clinical software designed by a real product team.

---

# 6. TOUCH EXPERIENCE

Everything must work comfortably with fingers.

Minimum touch targets approximately 44px.

Avoid:

- hover-dependent functionality
- tiny dropdown controls
- right-click actions
- tiny table buttons
- horizontal scrolling
- desktop tables on mobile
- enormous forms

Use:

- bottom sheets
- compact modals
- searchable selectors
- segmented controls
- large primary actions
- contextual actions
- progressive forms

---

# 7. USER TYPES

There are ONLY TWO operational roles:

## ADMIN

Admin doubles as Reception.

Admin can access:

- Dashboard
- Owners
- Patients
- Patient registration
- New Visit/check-in
- POS
- Payments
- Receipts
- Inventory
- Stock receiving
- Feed & accessories
- Sales
- Reports
- Client information
- Operational administration

## VET

Vet has access to ALL operational functionality.

Including:

- Patients
- Owners
- Consultations
- Diagnosis
- Clinical records
- Vaccinations
- Vaccination certificates
- Prescriptions
- Pharmacy
- Medication dispensing
- Inventory
- Stock taking
- Stock adjustment
- Feed/accessories
- POS
- Payments
- Receipts
- Reports
- Patient histories

Vets must not need to switch accounts to perform pharmacy or stock functions.

---

# 8. SUPER ADMIN

Super Admin is primarily used from the SERVER/DESKTOP.

This is separate conceptually from normal operational Admin.

Route:

/admin

Super Admin manages:

- Users
- Clinic configuration
- Printers
- Backups
- Synchronization
- Audit logs
- Inventory administration
- Reports
- Services
- Products
- Suppliers
- Database/system information

Do not expose dangerous server/system configuration to ordinary tablet users.

---

# 9. LOGIN

Every staff member receives their own account.

Each user has:

- Name
- Role
- Unique 4-digit PIN
- Active status

PIN must be hashed.

Never store plain-text PINs.

Tablet login:

VETKONNECT-POS
Veterinary Surgery

Who's using this device?

Dr. Moyo
Veterinarian

Lloyd
Admin

Select user.

Then show:

Enter your PIN

● ● ● ●

Use a large custom numeric keypad.

Provide quick LOCK functionality.

After configurable inactivity, lock the application rather than destroying the working session.

Every important action records the actual user.

---

# 10. MOBILE NAVIGATION

Use bottom navigation.

Primary navigation:

HOME
PATIENTS
+ VISIT
PHARMACY
MORE

NEW VISIT should be prominent.

Do not use a permanent sidebar on mobile.

Tablet landscape may use a compact navigation rail where appropriate.

---

# 11. HOME

Do NOT make Home primarily an analytics dashboard.

It is an ACTION screen.

Example:

Good morning, Dr. Moyo

[ + NEW VISIT ]

QUICK ACTIONS

[ Find Patient ]
[ Vaccination ]

[ POS Sale ]
[ Pharmacy ]

TODAY

12 Patients
7 Vaccinations
$240 Sales

ATTENTION

Rabies Vaccine
4 doses remaining

Amoxicillin
Expires soon

The user should be able to start working within seconds.

---

# 12. OWNERS / CLIENTS

Separate OWNER from PATIENT.

OWNER fields:

- UUID
- Full name
- Mobile
- Alternative mobile
- Email optional
- Address
- Notes
- created_at
- updated_at

One owner can have multiple animals.

Example:

JOHN MOYO
   ├── Bruno
   ├── Max
   └── Bella

Do not duplicate owners for each pet.

---

# 13. PATIENT

Patient fields:

- UUID
- Patient number
- Owner ID
- Name
- Species
- Breed
- Sex
- DOB
- Estimated age if DOB unknown
- Colour
- Weight
- Microchip
- Spayed/neutered status
- Identifying marks
- Photograph
- Allergies
- Clinical alerts
- Notes
- Active/deceased status
- created_at
- updated_at

---

# 14. PATIENT PROFILE

Mobile profile example:

BRUNO

German Shepherd
Male • 4 yrs • 31.2kg

Owner
John Moyo
07XXXXXXXX

[ NEW VISIT ]

[ VACCINATE ] [ PRESCRIPTION ]

OVERVIEW | HISTORY | VACCINES

Clinical alerts must be immediately visible.

Avoid huge cards.

---

# 15. PATIENT SEARCH

Search by:

- Pet name
- Owner
- Mobile number
- Patient number
- Microchip

Results should be compact touch-friendly rows.

Do not use desktop tables on mobile.

---

# 16. NEW VISIT

This is the most important workflow.

Flow:

PATIENT
↓
SERVICE
↓
EXAMINATION
↓
TREATMENT
↓
MEDICATION
↓
PAYMENT
↓
COMPLETE

Autosave visit drafts LOCALLY.

Allow backward navigation without losing information.

Do NOT present one enormous clinical form.

---

# 17. SERVICES

Configurable services.

Seed examples:

- General Consultation
- Follow-up
- Rabies Vaccination
- Puppy Vaccination
- Deworming
- Wound Treatment
- Nail Clipping
- Surgery
- Laboratory Test
- Hospitalisation
- Other

Fields:

- UUID
- Name
- Category
- Price
- Tax status
- Active
- Default duration
- Notes

A service may have suggested medications.

Example:

Rabies Vaccination
→ Rabies Vaccine

However:

DO NOT deduct medication simply because a service was selected.

The Vet confirms what was actually administered.

---

# 18. CONSULTATION

Consultation must support:

- Presenting complaint
- History
- Weight
- Temperature
- Examination
- Diagnosis
- Treatment
- Medication
- Clinical notes
- Follow-up date
- Veterinarian

Support multiple treatments/diagnoses where appropriate.

Always record the responsible veterinarian.

---

# 19. PHARMACY

Medication fields:

- UUID
- Medicine name
- Generic name
- Category
- Manufacturer
- Formulation
- Strength
- Unit
- Pack size
- Cost price
- Selling price
- Reorder level
- Supplier
- Prescription required
- Active

Stock must be calculated through stock movements.

---

# 20. MEDICATION BATCHES

Medication MUST support batches.

Example:

RABIES VACCINE

Batch RV2026A
Expiry 03/2027
12 doses

Batch RV2026B
Expiry 08/2027
20 doses

Use FEFO:

FIRST EXPIRY
FIRST OUT

Track:

- Batch/Lot
- Expiry
- Quantity
- Supplier
- Date received

Warn for:

LOW STOCK
EXPIRING
EXPIRED
OUT OF STOCK

Expired medication must not be silently dispensed.

---

# 21. STOCK MOVEMENTS

NEVER merely overwrite stock quantities.

Use:

+50 STOCK RECEIVED
-1 DISPENSED
-2 SOLD
-1 DAMAGED
+3 ADJUSTMENT

Every movement records:

- Item
- Batch where applicable
- Quantity
- Type
- Related transaction
- User
- Date/time
- Reason

---

# 22. FEED & ACCESSORIES

Separate retail inventory categories.

Examples:

- Dog Food
- Cat Food
- Leads
- Collars
- Bowls
- Toys
- Grooming
- Supplements
- Other

Fields:

- SKU
- Barcode optional
- Product
- Brand
- Category
- Cost
- Price
- Quantity
- Reorder level
- Supplier

These can be sold without a patient consultation.

---

# 23. POS

Make POS extremely fast.

Allow:

- Services
- Medication
- Feed
- Accessories

Search:

[ Search service/product... ]

Touch-friendly results.

Cart should preferably use a bottom sheet on mobile.

Example:

Bruno / John Moyo

Consultation          $15
Rabies Vaccine         $8
Dewormer               $4

TOTAL                  $27

[ PAY $27 ]

---

# 24. PAYMENT

Support configurable methods.

Seed:

- Cash
- EcoCash
- Card
- Bank Transfer
- Other

For cash:

TOTAL
$27

RECEIVED
$30

CHANGE
$3

[ COMPLETE PAYMENT ]

A completed transaction must be committed before printing.

Printing failure must NEVER destroy the transaction.

---

# 25. RECEIPTS

Generate:

1. Thermal receipt
2. Standard/A4 receipt

Receipt includes the practice name configured by the organization:

Receipt number
Date/time
Owner where applicable
Patient where applicable
Items/services
Quantities
Prices
Total
Payment method
Amount received
Change
Staff member

Provide:

PRINT RECEIPT
REPRINT

Reprint must NOT create another sale.

---

# 26. PRINT SERVICE

Create a centralized printing abstraction.

DOCUMENT
   ↓
PRINT SERVICE
   ├── Standard Printer Adapter
   └── ESC/POS Adapter

Initially support browser/system printing.

Prepare architecture for direct server-side printing.

---

# 27. REMOTE PRINTING FROM TABLET

The veterinarian should be able to press PRINT from a tablet.

Tablet
   ↓
Local Wi-Fi
   ↓
Next.js Server
   ↓
Print Service
   ↓
Configured Printer

Prepare routes/actions conceptually such as:

POST /api/print/receipt

POST /api/print/prescription

POST /api/print/vaccination-certificate

Printer mapping:

RECEIPT
→ Thermal Printer

PRESCRIPTION
→ A4 Printer

VACCINATION CERTIFICATE
→ A4 Printer

The user should not normally select the printer every time.

---

# 28. PRESCRIPTIONS

Prescription contains:

- Prescription number
- Date
- Owner
- Patient
- Veterinarian
- Medication
- Strength
- Dose
- Route
- Frequency
- Duration
- Quantity
- Instructions
- Repeats where applicable

Generate professional printable A4 prescription.

Store permanently in patient history.

---

# 29. VACCINATIONS

Vaccination workflow:

Patient
→ Vaccine
→ Batch
→ Expiry
→ Dose
→ Date
→ Next Due
→ Veterinarian
→ Confirm

Confirmation must:

1. Create vaccination record
2. Create medication stock movement
3. Update patient timeline
4. Record veterinarian
5. Add audit entry
6. Queue future cloud sync

Do this transactionally.

---

# 30. VACCINATION CERTIFICATE

Generate a professional A4 vaccination certificate.

This must be useful when the owner visits another veterinary practice.

Include:

PRACTICE NAME

VACCINATION CERTIFICATE

OWNER

Name
Phone
Address

PATIENT

Name
Patient number
Species
Breed
Sex
Colour
DOB/Age
Microchip
Identifying marks

VACCINATION HISTORY

Date
Vaccine
Disease
Batch/Lot
Expiry
Next Due
Veterinarian

Include:

Veterinarian name
Professional registration number if configured
Signature area
Clinic stamp area

Do NOT overwrite historical vaccinations.

Allow external vaccination records:

Administered elsewhere: YES

Clinic:
Veterinarian:
Date:
Vaccine:
Batch:
Next Due:

---

# 31. PATIENT TIMELINE

Maintain chronological patient history.

Example:

01 OCT 2026
Rabies Vaccination
Dr. Moyo

15 SEP 2026
Consultation
Diagnosis: Dermatitis

03 AUG 2026
Deworming

Timeline may contain:

- Visits
- Diagnoses
- Treatments
- Vaccinations
- Prescriptions
- Clinical notes
- Medication
- Procedures
- Audio notes in future

---

# 32. FUTURE AUDIO CLINICAL RECORDS

IMPORTANT:

Prepare the architecture for AUDIO CLINICAL NOTES but DO NOT implement transcription functionality today.

The feature should be visible but INACTIVE.

The future workflow is:

Vet opens patient.

Vet taps:

🎙 RECORD CLINICAL NOTE

Vet speaks naturally.

Example concept:

"Bruno presented today with reduced appetite for approximately three days. Temperature 39.2. Mild dehydration noted..."

The system will eventually:

AUDIO
↓
Speech-to-text
↓
Clinical transcription
↓
Structured information
↓
Vet review
↓
Save to patient record

The ORIGINAL AUDIO must also be capable of being retained as part of the patient's medical history, subject to future storage/configuration decisions.

Architecture should anticipate:

audio_notes

Fields conceptually:

- id
- patient_id
- visit_id
- veterinarian_id
- local_audio_path
- duration
- transcript
- processing_status
- created_at
- synced_at

Possible processing statuses:

RECORDED
PENDING_TRANSCRIPTION
TRANSCRIBING
READY
FAILED

DO NOT activate this functionality today.

---

# 33. FUTURE AUDIO PRESCRIPTION

Prepare for future voice-driven prescription creation.

Future workflow:

Vet taps:

🎙 DICTATE PRESCRIPTION

Example:

"Amoxicillin 250 milligrams, one capsule twice daily for seven days."

Future transcription system:

Audio
↓
Transcript
↓
Extract medication information
↓
Generate DRAFT prescription
↓
Vet reviews
↓
Vet confirms
↓
Prescription saved/printed

CRITICAL FUTURE SAFETY PRINCIPLE:

AI/transcription must NEVER automatically finalize a prescription.

It produces a DRAFT.

The veterinarian must review and confirm it.

---

# 34. FUTURE AUDIO RECEIPT / SERVICE ENTRY

Also prepare architecture for future voice-assisted transaction entry where appropriate.

Example:

"General consultation, rabies vaccination and one deworming tablet."

The future system may interpret this and prepare a DRAFT transaction.

The user must confirm it before payment or stock deduction.

Do NOT implement this today.

---

# 35. AUDIO UI TODAY

The architecture must recognize the future functionality, but do not waste today's development time building speech recognition.

Where appropriate, show a subtle disabled control:

[ 🎙 AUDIO NOTE ]
Coming Soon

or:

Audio Clinical Notes
Coming Soon

Do not make the disabled feature prominent enough to interfere with today's workflow.

Create clean component boundaries so transcription can later be added without redesigning consultations/prescriptions.

---

# 36. INVENTORY

Inventory should include:

Item
Category
Batch
Expiry
Stock
Reorder level
Cost
Price
Status

Filters:

ALL
MEDICATION
FEED
ACCESSORIES

Status:

IN STOCK
LOW
OUT
EXPIRING
EXPIRED

---

# 37. STOCK TAKING

Vet must have full stock-taking capability.

Allow:

Expected Quantity
Actual Quantity
Variance

Require reason where appropriate.

Example:

Rabies Vaccine

Expected: 12
Actual: 11

Variance: -1

Reason:
[ Damaged dose ]

Confirmed by:
Dr. Moyo

Create stock adjustment movement.

Never silently overwrite inventory.

---

# 38. SUPPLIERS

Fields:

- Name/company
- Contact
- Phone
- Email
- Address
- Notes

Stock receiving should identify supplier and batch information.

---

# 39. REPORTS

Implement useful reports:

- Daily Sales
- Sales by Staff
- Sales by Service
- Payments by Method
- Consultations
- Vaccinations
- Medication usage
- Stock
- Low Stock
- Expiring Medication
- Stock Adjustments

Reports must work locally.

---

# 40. AUDIT LOG

Record important actions.

Examples:

LOGIN
SALE
REFUND
STOCK ADJUSTMENT
PATIENT CREATED
PATIENT EDITED
CONSULTATION
VACCINATION
PRESCRIPTION
REPRINT
SETTINGS CHANGE

Store:

- user
- action
- entity
- entity ID
- timestamp
- details

Ordinary users cannot modify audit history.

---

# 41. LOCAL FILE STORAGE

Prepare a structured local storage area for:

- Patient images
- Generated documents
- Future audio
- Backups

Do not store large binary files directly inside SQLite unless there is a strong technical reason.

Store references/paths in the database.

---

# 42. SUPABASE SYNC

Prepare a reliable synchronization layer.

Local records use UUIDs.

Create sync queue:

- id
- entity_type
- entity_id
- operation
- status
- retry_count
- created_at
- synced_at
- last_error

Statuses:

PENDING
SYNCING
SYNCED
FAILED

When internet exists:

LOCAL
↓
SYNC WORKER
↓
SUPABASE

When internet disappears:

CONTINUE LOCALLY.

Never block staff because Supabase is unreachable.

---

# 43. CONFLICT SAFETY

Design synchronization anticipating multiple installations eventually.

Include:

organization_id
branch_id
created_at
updated_at

Avoid simplistic synchronization based only on numeric IDs.

Do not allow retries to duplicate:

- Sales
- Payments
- Vaccinations
- Stock movements

Synchronization must eventually be idempotent.

---

# 44. CONNECTION STATUS

Mobile UI should show:

● LOCAL

This means the local server is reachable.

Do NOT prominently display:

NO INTERNET

Internet is optional.

Cloud status can appear under:

MORE → SYNC STATUS

Example:

LOCAL SERVER
Connected

CLOUD
Offline

Last sync:
10:42

Pending:
17

This is normal operational information, not a critical failure.

Only display a major warning if the LOCAL SERVER becomes unreachable.

---

# 45. DATABASE TRANSACTIONS

Critical workflows must use database transactions.

For example, vaccination confirmation should atomically:

- create vaccination
- create treatment/visit relationship
- create stock movement
- create audit event
- create sync event

POS completion should atomically:

- create sale
- create sale items
- create payment
- create stock movements
- create audit event
- create sync events

Avoid partially completed transactions.

---

# 46. DESKTOP SUPER ADMIN UI

Desktop can use a compact professional sidebar.

Suggested:

OVERVIEW

PATIENTS
CONSULTATIONS
SALES

PHARMACY
INVENTORY
SUPPLIERS

VACCINATIONS
PRESCRIPTIONS

REPORTS

STAFF
AUDIT LOG

PRINTERS
SYNC
BACKUPS
SETTINGS

Desktop may use proper data tables with:

- Search
- Filters
- Pagination
- Clear Filters
- Actions

Keep tables professional.

Avoid rounded-card table designs.

---

# 47. MOBILE DATA PRESENTATION

DO NOT squeeze desktop tables onto mobile.

Convert records into compact rows/cards.

Example:

RABIES VACCINE

Batch RV2026A
12 doses

Expires Mar 2027

[ VIEW ]

Keep information dense but readable.

---

# 48. SEED DATA

Provide clearly labeled, generic VetKonnect demo data. Do not use a real
practice's identity or data.

Create:

- Super Admin
- Admin
- Multiple example Vets

Example owners/patients.

Example services.

Example medication:

- Rabies Vaccine
- Dewormer
- Amoxicillin
- Anti-inflammatory

Example batches.

Example feed/accessories.

Mark seed/demo information so it can be removed before live use.

---

# 49. DO NOT BUILD FAKE FEATURES

A button that displays "Coming Soon" is acceptable ONLY for explicitly future functionality such as Audio Transcription.

Core functionality must actually work.

Do not create UI screens backed only by mock data and then claim the feature is complete.

Connect completed features to SQLite.

---

# 50. DEVELOPMENT ORDER

WE INTEND TO USE THIS APPLICATION TODAY.

Prioritize accordingly.

PHASE 1
Project architecture
SQLite
Authentication
PIN login
LAN operation

PHASE 2
Owners
Patients
Patient search

PHASE 3
Services
New Visit
Consultation

PHASE 4
Pharmacy
Batches
Stock movements

PHASE 5
POS
Payment
Receipts

PHASE 6
Prescriptions
Printing

PHASE 7
Vaccinations
Vaccination certificates

PHASE 8
Feed/accessories
Stock taking

PHASE 9
Reports
Audit

PHASE 10
Desktop Super Admin

PHASE 11
Supabase sync

PHASE 12
PWA refinements
Printer refinements

FUTURE PHASE
Audio recording
Speech-to-text
Clinical transcription
Voice prescription drafting
Voice-assisted transaction entry

DO NOT implement the FUTURE AUDIO PHASE today.

Only prepare the schema/components/interfaces needed to integrate it cleanly later.

---

# 51. VERIFY EACH PHASE

After meaningful development stages:

- run TypeScript checks
- run lint
- run database migrations
- test database operations
- test responsive UI
- run build where appropriate
- fix errors before continuing

Do not accumulate unresolved TypeScript errors.

---

# 52. TODAY'S REQUIRED ACCEPTANCE TEST

Before saying the system is ready, physically test this workflow:

1. Start server on laptop.
2. Confirm server listens on LAN.
3. Open application from tablet/phone connected to same Wi-Fi.
4. Turn internet/mobile data off.
5. Confirm application still operates.
6. Select Dr. Moyo.
7. Enter 4-digit PIN.
8. Search patients.
9. Register owner John Moyo.
10. Register Bruno.
11. Start new visit.
12. Record weight.
13. Select Rabies Vaccination.
14. Select Rabies Vaccine.
15. Select actual vaccine batch.
16. Confirm vaccination.
17. Confirm one dose deducted.
18. Complete payment.
19. Generate receipt.
20. Preview/print receipt.
21. Generate vaccination certificate.
22. Preview/print certificate.
23. Open Bruno's profile.
24. Confirm vaccination appears in timeline.
25. Confirm vaccine batch appears in vaccination record.
26. Confirm responsible veterinarian is recorded.
27. Perform a stock take.
28. Confirm adjustment creates stock movement.
29. Confirm audit records exist.
30. Confirm Audio Clinical Note is visible as an INACTIVE/FUTURE feature only.
31. Restore internet.
32. Test Supabase synchronization when implemented.
33. Verify retry does not duplicate records.

Do not claim success merely because pages render.

Test actual data persistence.

---

# 53. FINAL PRODUCT PHILOSOPHY

When making implementation decisions, remember:

This system will be used while:

- clients are waiting
- animals are being treated
- vets are moving between rooms
- reception is accepting payments
- medication is being dispensed
- internet may be unavailable

Therefore:

Every unnecessary click matters.

Every unnecessary form field matters.

Every confusing screen matters.

Every lost transaction matters.

The operational application should feel like a veterinary tool, not accounting software.

A new practice employee should be able to understand the basic workflow within minutes.

The veterinarian should spend more time looking at the animal and owner than looking at the tablet.

Build for that reality.

Start implementation now.

First inspect the current project if one exists.

Then configure Supabase migrations, authentication and the mobile/tablet shell.

Do not spend time redesigning completed working functionality unnecessarily.

Work phase-by-phase and verify functionality before proceeding.