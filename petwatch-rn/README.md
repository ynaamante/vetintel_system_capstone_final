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
