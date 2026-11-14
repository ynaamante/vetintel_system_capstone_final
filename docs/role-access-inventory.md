# Owner, doctor and receptionist access inventory

This inventory describes the current code and a proposed configuration. The suggested defaults below are not a dump of the database's saved permissions. No role permissions were changed to produce this inventory.

## Suggested role access

| Area | Clinic owner | Doctor | Receptionist |
|---|---|---|---|
| Clinic overview and settings | Manage own clinic | View relevant clinic information | View relevant clinic information |
| Users, staff activation and role assignment | Manage approved clinic staff | No | No |
| Roles and permissions | Configure approved staff roles in own clinic | No | No |
| Appointments and walk-ins | View and manage | View own schedule, complete clinical visits | Create, approve, reschedule, cancel, queue and track no-shows |
| Client contact information | View, create and edit | View information needed for care | View, create and edit for registration/contact |
| Patient demographic records | View, create and edit | View, create and edit | Register patients and edit demographic details |
| Patient intake and queue | View | Review clinical intakes and assigned patients | Register and manage queue |
| Consultations and medical history | View for clinic oversight | View, create and edit clinical records | Limited visit/status information |
| Diagnoses | View | Create/edit, classify, finalize and correct diagnoses | No diagnosis editing or confirmation |
| Prescriptions and treatment plans | View | Create and manage | View administrative instructions if needed |
| Laboratory tests and results | View | Order, review, enter and verify results | Administrative status only |
| Vaccination records | View | Record clinical administration and manage records | Schedule visits; no clinical administration entry |
| Inpatient care | View | Admit, record observations/medications and discharge | Administrative admission/status information only |
| Inventory | View, add, edit, restock, archive and review movements | View and request restock | View; stock actions only if specifically delegated |
| Billing and payments | Manage, review revenue and financial reports | View relevant billing if granted | Create invoices and process payments |
| Service catalog and prices | View, create, edit and activate/deactivate | View | View |
| Disease Intelligence dashboard | View protected aggregates | View protected aggregates | Off by default |
| Disease and risk monitoring | View protected aggregates | View protected aggregates | Off by default |
| Community analytics and surveillance reports | View/export if granted | View/export if granted | Off by default |
| Due dates and follow-ups | Clinic oversight access if implemented | Manage clinical follow-ups | Manage scheduling/reminders if granted |
| Shared inbox | View, send and manage clinic conversations | View/send appropriate clinical messages | View/send administrative messages |
| Notifications | Manage clinic notifications/history | Receive/send permitted notifications | Receive/send permitted administrative notifications |
| Audit history | View clinic audit history | Off by default, or clinical read-only access | Off by default |

An owner who also practices as a veterinarian needs separately verified clinical authority. Administrative ownership alone should not enable diagnosis confirmation, prescriptions or result verification. All records stay within the originating clinic; shared surveillance exposes only the protected aggregates.

## Current permission catalog (82 controls)

Source: data/permissionCatalog.json. The editor shows only the controls applicable to the selected staff role.

| Group | Controls |
|---|---|
| User Management (5) | View Users; Create Users; Edit Users; Deactivate Users; Assign Roles |
| Role Management (4) | View Roles; Create Roles; Edit Roles; Assign Permissions |
| Appointments (12) | View Appointments; View Own Schedule; Create Appointment; Approve Appointment; Reschedule Appointment; Cancel Appointment; Complete Appointment; Manage Walk-ins; Manage Follow-ups; Manage No-shows; View Patient Queue; Manage Patient Queue |
| Client Management (4) | View Clients; Create Client; Edit Client; View Client History |
| Patient / Pet Records (7) | View Pet Records; Create Pet Records; Edit Pet Records; View Medical History; View Patient Intakes; Manage Patient Intakes; Archive Pet Records |
| Medical Workflow (18) | Create Consultation; Edit Consultation; Create Prescription; Manage Vaccination Records; View Laboratory Results; View Diagnoses; Create Diagnosis; Edit Diagnosis; Finalize Diagnosis; Confirm Diagnosis; Order Laboratory Tests; Record Laboratory Results; Verify Laboratory Results; Manage Laboratory Reports; View Treatment Plans; Manage Treatment Plans; View Inpatient Care; Manage Inpatient Care |
| Inventory (7) | View Inventory; Add Inventory; Edit Inventory; Restock Inventory; Archive Inventory; Request Restock; View Stock Movement |
| Billing & Financial (5) | View Billing; Create Invoice; Process Payment; View Financial Reports; View Revenue |
| Services (4) | View Services; Create Services; Edit Services; Activate / Deactivate Services |
| Disease Intelligence (10) | View Intelligence Dashboard; View Disease Monitoring; View Risk Monitoring; View Community Analytics; View Reports; Export Reports; View Data Sync Status; Generate Reports; Alert Clinics; Flag for Follow-up |
| Communication (5) | View Pet Owner Messages; Send Pet Owner Messages; Manage Conversations; Send Notifications; View Notification History |
| Audit (1) | View Audit Trail |

## Implemented owner-side RBAC

The catalog in `data/permissionCatalog.json` now supplies both the owner editor and effective access checks. Doctor configuration includes clinical actions; receptionist configuration excludes diagnosis, prescription, verification and inpatient clinical authority. Administrative staff/role management, service editing and stock editing remain owner functions, matching the existing controllers.

Owner saves write `clinic_role_permissions`, keyed by clinic and normalized role name, rather than changing shared `roles` rows. Saving a group toggles only that group. Select All respects role capabilities. Failed API saves no longer display a success notification. Clinical roles are shown without requiring a new role request just to configure an existing doctor or receptionist role.

Protected API requests reload the current user, active status, role and clinic-specific permissions from the database. Existing tokens cannot retain revoked permissions or an old role. The sidebar, application page guards and clinic tabs honor the effective permissions; role identity remains an additional boundary for dedicated workflows. Diagnosis, laboratory, appointment and billing controls use individual action checks. Staff cannot update roles or manage users, and owner staff updates cannot target another clinic or elevate a staff account to owner/super admin.

`middleware/clinicRbac.js` maps clinic endpoints and appointment/visit sub-actions to permissions. Clinical record endpoints still enforce their existing patient/clinic checks and veterinarian qualification rules. The frontend refreshes permissions on focus, live permission events and every 15 seconds. A user with all access removed retains account settings and logout.

Install with `node scripts/migrate_clinic_rbac.js` and restart the backend. Startup also installs the additive schema. Existing users and global role data are preserved. `node scripts/test_clinic_rbac.js` tests actual HTTP routes and database-backed role saves in a transaction that is rolled back.
## Requirements for reliable RBAC

Use one permission catalog and schema for the editor, sidebar, page buttons and backend authorization. Enforce clinic ownership and permissions on every relevant API operation; hiding a button is insufficient. Preserve clinical qualification checks independently of administrative delegation. Validate permission dependencies, prevent owners escalating to super admin, audit changes, and refresh active users' effective permissions after changes. Test allowed and denied API calls for all three roles and cross-clinic access.

Platform role approval and super-admin powers remain platform-level. An owner configures only permitted roles and staff within their own clinic.

## Disease Intelligence actions

Disease Intelligence is available only to owner/clinic-owner and veterinarian profiles (plus platform super admins). A receptionist cannot receive its view or action privileges even through a crafted permission save. The editor omits that group for receptionists.

Viewing, Generate Reports and Export Reports are independent controls. Report generation uses `/disease-intelligence/report-data`; export/download checks `/disease-intelligence/export-data`. Both are authorized server-side against current clinic permissions. A user may generate a report without downloading it, or export existing report data without generating a new report. Viewing filters depend on view access, not export access.

Alert Clinics and Flag for Follow-up have separate configurable capability definitions and fail-closed action authorization rules. No working alert-send or follow-up-flag button/handler was found in the current Disease Intelligence pages. These capability definitions do not implement those missing workflows, send notifications, or declare outbreaks. Their eventual handlers must require the matching action and preserve the existing privacy rules.