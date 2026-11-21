# PetWatch (React Native / Expo)

A comprehensive React Native application (built with Expo and TypeScript) for managing pet health: appointments, reports, clinics, and pet profiles.

## Prerequisites

- Node.js 22.13+ or 24.3+ (the project includes a local Node 22 runtime for Expo commands)
- npm or yarn
- Expo CLI (optional globally) — or use `npx expo` / `npm run` scripts
- Google Chrome for the PC browser preview, or a physical device or simulator (Android Studio / Xcode) for the mobile app

## Installation & Setup

Navigate to the petwatch-rn directory and install dependencies:

```bash
cd petwatch-rn
npm install
```

The application targets Expo SDK 58, React Native 0.88, and React 19.3. Native package versions are aligned with Expo; see `package.json` for exact versions.

## Running the Application

### Open PetWatch on Your PC (Windows)

If the preview server is already running:

1. Open **Google Chrome** on your PC.
2. Click the address bar at the top.
3. Type **http://localhost:8081** and press **Enter**.
4. Wait for PetWatch to load.

If Chrome says **"This site can't be reached"**, start the preview server:

1. Open the project in **VS Code**.
2. Select **Terminal > New Terminal**.
3. Paste this command and press **Enter**:

   ```powershell
   cd C:\Users\User\Desktop\capstone_vet\vetintel_system_capstone_final\petwatch-rn
   ```

   If your project is in a different location, use its `petwatch-rn` folder path instead.

4. Run:

   ```powershell
   npm.cmd run web
   ```

5. Keep the terminal open. If Chrome does not open automatically, open the **localhost address printed in the terminal**. Expo may use another port if `8081` is already occupied.

For a first-time setup, run `npm.cmd install` in the same folder before starting the preview. No phone, QR code, or Android emulator is needed for the browser preview. Sign-in and live data require the backend server to be running; the default local API address is `http://localhost:3000/api`.

### Start Development Server (SDK 58)

```bash
npm start
```

This launches Expo SDK 58 and displays a QR code. On Android, open the SDK 58-compatible Expo Go app and scan the code. Keep the phone and computer on the same Wi-Fi, or use the tunnel command below. The npm scripts use the project-local Node runtime, so no system-wide Node change is needed.

### Connect a Physical Device to the Backend

On the same Wi-Fi, the app can detect the computer's LAN address from the Expo bundle URL. The backend must be running on port 3000 and reachable from the phone. An explicit `EXPO_PUBLIC_API_URL` in `petwatch-rn/.env` takes precedence; update it if your computer's Wi-Fi address changes. Restart Expo after editing this file. Never use `localhost` as the backend address on a physical phone.

Expo's tunnel exposes the Metro development server so your phone can load the app. It does not expose the backend API. To use API features from a physical device, start the backend and expose its port separately with ngrok:

```bash
# In the repository root, with the backend running on port 3000:
ngrok http 3000
```

Copy the HTTPS forwarding URL printed by ngrok, then create `petwatch-rn/.env`:

```env
EXPO_PUBLIC_API_URL=https://your-backend-tunnel.ngrok-free.app/api
```

Replace the example URL with your actual ngrok URL and keep the `/api` suffix. Restart Expo after changing the environment file, then start the app tunnel:

```bash
npm.cmd start -- --tunnel
```

For local web or iOS simulator development, the API URL defaults to `http://localhost:3000/api`. Android emulators typically need `http://10.0.2.2:3000/api`. A physical phone cannot use the computer's `localhost` address to reach the backend.

### Run on Android

```bash
npm run android
```

Requires Android emulator or connected device.

### Run on iOS

```bash
npm run ios
```

Requires Xcode and macOS.

### Building for Production

To create optimized builds for app stores:

```bash
# For iOS
eas build --platform ios

# For Android
eas build --platform android
```

## Project Structure

- [App.tsx](App.tsx) — app entry point
- [app.json](app.json) — Expo configuration
- [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx#L1) — navigation setup
- [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L1) — authentication context
- [src/screens](src/screens) — screen implementations (Home, Login, Register, etc.)
  - [HomeScreen.tsx](src/screens/HomeScreen.tsx#L1)
  - [PetDetailsScreen.tsx](src/screens/PetDetailsScreen.tsx#L1)
  - [BookAppointmentScreen.tsx](src/screens/BookAppointmentScreen.tsx#L1)
- [src/data/mockData.ts](src/data/mockData.ts#L1) — mock data used by screens
- [src/theme/colors.ts](src/theme/colors.ts#L1) — color constants

Explore the `src/screens` folder for additional screen implementations.

## Configuration Files

- `tsconfig.json` — TypeScript configuration
- `app.json` — Expo configuration (app name, version, icon, etc.)
- `babel.config.js` — Babel configuration with Expo preset
- `package.json` — Dependencies and scripts

## Notes

- This app uses TypeScript for type safety
- Navigation is implemented with React Navigation (Bottom Tab + Stack Navigator)
- App-wide state can be managed using React Context (see AuthContext.tsx)
- Build system uses Expo for simplified React Native development
- Animations use React Native Reanimated for performance

## Troubleshooting

If you encounter issues:

1. Clear cache: `expo start -c`
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check Expo CLI: `npx expo --version`
4. Update Expo: `npm install -g expo@latest`

Clone with HTTPS:

```bash
git clone https://github.com/<owner>/<repo>.git
```

Or clone with SSH:

```bash
git clone git@github.com:<owner>/<repo>.git
```

Then change into the project folder:

```bash
cd petwatch-rn
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start the Expo dev server:

```bash
npm start
# or
yarn start
# or explicitly
npx expo start
```

4. Run on a device/emulator:

```bash
npm run android   # open on Android (uses expo start --android)
npm run ios       # open on iOS simulator (uses expo start --ios)
```

Notes:
- If prompted to install missing native dependencies, follow the CLI prompts or run `expo install <package>` for Expo-managed compatible versions.
- For real device testing, install the Expo Go app and scan the QR code from the dev server.

## Dependencies

These are the primary dependencies declared in `package.json`:

- @expo/vector-icons
- @react-native-async-storage/async-storage
- @react-navigation/bottom-tabs
- @react-navigation/native
- @react-navigation/native-stack
- date-fns
- expo
- expo-status-bar
- react
- react-native
- react-native-qrcode-svg
- react-native-safe-area-context
- react-native-screens
- react-native-svg
- react-native-toast-message
- typescript

Dev dependencies:

- @babel/core

Refer to [package.json](package.json) for exact versions.

## Notes for contributors

### Owner home and clinic connection

- Home reads personal pets from `/owner/pets`, clinic patients and appointments from `/owner/care`, and clinic-approved shared records from `/owner/shared-records`.
- Tap the pet photo or camera badge on Pet Profile to choose and crop a photo. Images are resized to 800 pixels and stored through owner-scoped photo endpoints. Clinic-linked photos use the same attachments as the doctor app; personal photos use `pet_owner_pets.photo_url`. Restart the backend for the additive photo-column migration. Custom native builds must be rebuilt after adding the image-picker and image-manipulator modules; Expo Go users can restart Expo.
- Owners can edit clinic-linked basic profiles directly through `/owner/clinic-pets/:id` without clinic approval. Name, breed, birth date, sex, weight, and color are editable; ownership and clinical metadata are preserved.
- Clinic patients are linked through the verified account email matching the clinic's client email. Personal pet IDs and clinic patient IDs are separate; no name-based merging is performed.
- Booking uses `/owner/appointments` and requires a pet already registered at the selected clinic. Requests are saved in the clinic's existing appointments table using its `pending_confirmation` workflow. Reception confirms them; doctors see the pending appointment in their schedule.
- Requested times are preferences, not a live availability calendar. Clinic staff assign the veterinarian. For appointment changes or cancellations, contact the clinic.
- Home and Appointments refresh on focus and every 30 seconds while focused, with pull-to-refresh. Clinic reminders use the existing owner notifications provider. Only records explicitly shared by the clinic are displayed.
- The clinic directory uses real database clinics. Health tips remain the app's built-in general care content. The home screen uses pet icons where no real pet photo is available.
- Restart the backend after adding the owner routes. Run `node scripts/test_owner_care.cjs` from the backend directory for the database integration check; it rolls back all test changes. Run `npm run type-check` and `npm run export:web` in `petwatch-rn` for mobile source and bundle validation.

- The app is written in TypeScript; keep types consistent when adding new modules.
- Use existing Context providers for cross-cutting state (see [src/context](src/context)).
- Add new navigation routes in [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx#L1).

## Troubleshooting

- If the Metro bundler shows a native module error, run `expo doctor` to detect common issues.
- Clear cache if you get stale builds:

```bash
npx expo start -c
```

## Next steps (suggested)

- Add unit or integration tests (Jest + React Native Testing Library).
- Add CI workflow to run linting and tests on PRs.

---

> Why do I have a folder named ".expo" in my project?
The ".expo" folder is created when an Expo project is started using "expo start" command.
> What do the files contain?
- "devices.json": contains information about devices that have recently opened this project. This is used to populate the "Development sessions" list in your development builds.
- "settings.json": contains the server configuration that is used to serve the application manifest.
> Should I commit the ".expo" folder?
No, you should not share the ".expo" folder. It does not contain any information that is relevant for other developers working on the project, it is specific to your machine.
Upon project creation, the ".expo" folder is already added to your ".gitignore" file.

### Medical-history QR and owner consent

Clinic-linked pet profiles can issue an opaque QR valid for five minutes. A signed-in veterinarian opens Patient Records > Scan Pet QR in the admin app and scans with a camera, uploads a QR image, or pastes the QR value. Browser camera access requires HTTPS or localhost.

Scanning creates a ten-minute access request. With PetWatch open, the owner receives an in-app permission dialog and an Alerts entry identifying the doctor and requesting clinic. Allow grants thirty minutes of read-only access to that pet's vaccinations, completed consultation summaries, finalized diagnoses, treatment records, and prescriptions. Decline, expiry, or Revoke in Alerts blocks subsequent reads. Draft diagnoses, internal consultation notes, billing, and owner contact details are excluded. The QR contains no medical history. Requests are tied to the requesting doctor's account and current clinic.

Owner notifications refresh every five seconds while active. Remote push notifications when the app is closed are not configured. Personal pets must first have a clinic-linked patient record before medical-history QR sharing is available.

The additive schema is in `scripts/pet_sharing_schema.sql`, applied at backend startup. From the backend root, `node scripts/test_pet_sharing.cjs` exercises consent, doctor isolation, and expiry inside a rollback-only fixture transaction.
### Owner archive and restore

Long-press a pet card on Home to show a named archive confirmation. A normal tap opens Pet Profile. Home includes Archived pets beside Add pet; the archived list restores pets without deleting medical history. Archive state is scoped to the signed-in owner and the separate account/clinic pet identity in `owner_pet_archives`. Clinic clinical archive status, history, shared records, and appointments are preserved. Active owner pet lists exclude archived pets. The backend startup applies `scripts/owner_pet_archives_schema.sql`. Run `node scripts/test_owner_pet_archive.cjs` for rollback-only database tests of archive/restore and owner isolation.
### Owner Health Report

View Complete Health Report opens the dedicated medical activity screen. It reads live owner-visible clinic records from `/owner/clinic-pets/:id/medical-activity`, scoped by the authenticated owner email and clinic patient ID; personal pet IDs are not matched to clinic IDs or names. Completed visits, finalized diagnoses, saved treatment plans and procedures, verified lab results and vaccinations, and prescriptions appear automatically. Internal notes, billing data, draft records, and unverified results are excluded. Explicit doctor updates remain included. Canonical clinic records use their current saved values rather than stale manually shared snapshots. Search and category filters apply to both the displayed list and exported report, and record rows open the shared details. Status labels use saved status or explicit verification; missing statuses are shown as Shared.

Download creates a PDF and opens the device's save/share sheet; web uses the browser print/save-to-PDF dialog. Empty reports cannot be exported. No records are sent to a veterinarian automatically. Custom native builds need rebuilding for expo-print and expo-sharing; Expo Go supports both modules. The report-data checks run with `node scripts/test_medical_activity.cjs` from the backend root.
The Medical Activity report refreshes on focus, on pull-to-refresh, and every fifteen seconds while focused. Pet Profile Overview and History also use the live activity endpoint. Run `node scripts/test_owner_medical_activity.cjs` for a rollback-only database test of live doctor updates, filtering, and owner isolation.
### Clinic-first owner account flow

1. The clinic registers the owner and pet, using the email supplied by the owner.
2. The owner creates a mobile account with that same email. New registration requires an existing owner email at an active clinic; unmatched emails receive an instruction to check with the clinic. Matching ignores letter case and surrounding whitespace.
3. The owner verifies the emailed code before receiving an authenticated session. Verification opens Home rather than requiring a duplicate personal pet.
4. Existing clinic patients, owner-visible medical activity, and doctor-shared updates are linked through the verified email. A different email does not receive those records.

Run `node scripts/test_clinic_owner_link.cjs` for the rollback-only registration-to-sharing integration test; it stubs mail delivery and sends no real emails.
### Saved session recovery

The mobile app validates a saved login through `/me` before opening Home and checks it again when returning to the foreground. Expired or invalid tokens return `401 SESSION_INVALID` and send the owner back to sign-in with a clear message. Old backend `Forbidden` responses on owner endpoints are also recognized as invalid sessions. Role-based permission errors remain distinct. Changing AUTH_SECRET invalidates previous logins; sign in again rather than creating another account. Temporary network failures retain the saved session for retry.
### Forgot password

Login includes Forgot password? beneath the password field. Owners request a six-digit code using their account email, enter that code, and choose and confirm a new password. The mailer uses the configured Brevo/SMTP transport with a password-reset subject and message. Codes are HMAC-hashed, expire after ten minutes, permit five incorrect attempts, and are single-use. Requests have a sixty-second resend cooldown and a five-email-per-hour limit per account. Responses do not disclose whether an email belongs to an account. Successful reset changes the password hash and reset marker, invalidating older sessions; owners sign in again with the new password. The additive schema is applied at backend startup. `node scripts/test_owner_password_reset.cjs` exercises the recovery flow in a rollback-only transaction with mail delivery stubbed.