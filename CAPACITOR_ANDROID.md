# Android APK preparation

The project is prepared for Capacitor 8 and Android API 24+.

## Local APK build

1. Install Node.js 22+, pnpm, Android Studio, Android SDK Platform 35, Android SDK Build-Tools, and Java 21.
2. Set `ANDROID_HOME`/`ANDROID_SDK_ROOT` and ensure `adb` is on `PATH`.
3. Copy `.env.example` to `.env.production` and set `VITE_SOCKET_URL` to the public Socket.io server URL.
4. Build and sync web assets:

```bash
pnpm install
pnpm build
pnpm exec cap sync android
```

5. Open the native project:

```bash
pnpm exec cap open android
```

In Android Studio, choose **Build → Generate App Bundle(s) or APK(s) → Generate APK(s)**. For a phone test, the debug APK is enough. It is usually written to `android/app/build/outputs/apk/debug/app-debug.apk`.

Command-line debug build:

```bash
cd android
./gradlew assembleDebug
```

Install on a USB-debugging-enabled phone:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Important multiplayer setting

A bundled Capacitor app loads from `https://localhost`, so the client cannot infer the remote Node server from `window.location.origin`. Set `VITE_SOCKET_URL` before `pnpm build`, for example:

```bash
VITE_SOCKET_URL=https://your-socket-server.example.com pnpm build
pnpm exec cap sync android
```

The current project does **not** enable persistent hosting. The production server still defaults to its normal 60-second hiding and 180-second seeking timers.

## Temporary/free multiplayer test

For a short demo, deploy `dist/`/the Node server as a Render **Free Web Service**. Render supports inbound WebSockets, but Free services sleep after 15 minutes without inbound traffic and can take about a minute to wake. The service also has a monthly 750 free-instance-hour allowance and is not suitable for always-on production. Use the Render public URL as `VITE_SOCKET_URL`, then rebuild/sync the APK.

Recommended Render settings:

- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Environment: `NODE_ENV=production`
- Web service port: use Render's `PORT` environment variable (the server already reads it)

For an even simpler local phone test, keep the Node server running on a computer reachable on the same Wi-Fi and set `VITE_SOCKET_URL` to `http://<computer-lan-ip>:3000`; HTTPS/TLS is recommended for anything beyond a local test.
