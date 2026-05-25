# Kaal Panchang — Local Testing & Android Play Store Publishing

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Testing in Browser](#local-testing-in-browser)
3. [Testing on Android Emulator](#testing-on-android-emulator)
4. [Testing on Physical Android Device](#testing-on-physical-android-device)
5. [Building a Release APK / AAB](#building-a-release-apk--aab)
6. [Publishing to Google Play Store](#publishing-to-google-play-store)

---

## Prerequisites

Install these before proceeding:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| Android Studio | Latest | https://developer.android.com/studio |
| JDK | 17 | Bundled with Android Studio |

After installing Android Studio:

1. Open Android Studio > **Settings** > **SDK Manager**
2. Install **Android SDK 34** (or latest)
3. Under **SDK Tools**, ensure these are checked:
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools
4. Set environment variables (add to your system PATH):

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\platform-tools
PATH += %ANDROID_HOME%\emulator
```

Verify setup:

```bash
node --version        # Should print v18+
adb --version         # Should print Android Debug Bridge version
```

---

## Local Testing in Browser

This is the fastest way to test during development.

### Start the dev server

```bash
cd C:\xampp\htdocs\kaal
npm run dev
```

Open **http://localhost:5173** in Chrome. You'll see the app running as a PWA.

### What to test

- **Kaal timings** — Verify sunrise/sunset and kaal times appear for the default location (Chennai)
- **Theme toggle** — Click the sun/moon icon in the header. Both dark and light themes should be readable
- **Week view** — Tap the "Week" tab in the bottom nav. A 7-day table should appear
- **City search** — Go to Settings, type a city name. Results should appear after 500ms. Tap one to switch location
- **Countdown** — The countdown timer should tick every second toward the next kaal
- **LIVE badge** — If a kaal is currently active, its card should show a pulsing "LIVE" badge

### Test as mobile

In Chrome DevTools (F12), click the **device toolbar** icon (or press Ctrl+Shift+M) to simulate a mobile viewport. Test with iPhone SE and Pixel 7 presets.

### Test PWA installability

Run a Lighthouse audit in Chrome DevTools:
1. F12 > **Lighthouse** tab
2. Check "Progressive Web App"
3. Click **Analyze page load**

The app should score 90+ on PWA. The "Install" prompt should also appear in Chrome's address bar.

---

## Testing on Android Emulator

### Step 1 — Build the web app

```bash
cd C:\xampp\htdocs\kaal
npm run build
```

This creates the `dist/` folder with production assets.

### Step 2 — Sync to Android project

```bash
npx cap sync android
```

This copies `dist/` into `android/app/src/main/assets/public/` and updates native plugins.

### Step 3 — Open in Android Studio

```bash
npx cap open android
```

Android Studio opens the `android/` project.

### Step 4 — Create an emulator (first time only)

1. In Android Studio, go to **Tools > Device Manager**
2. Click **Create Device**
3. Pick **Pixel 7** (or any phone)
4. Select a system image — use **API 34** (download if needed)
5. Finish and name it

### Step 5 — Run on the emulator

1. Select your emulator from the device dropdown in the top toolbar
2. Click the green **Run** button (or press Shift+F10)
3. Wait for Gradle to build and the app to launch

### What to test on emulator

- **GPS** — The emulator has a location panel (three dots menu > Location). Set coordinates and test "Use Current Location"
- **Notifications** — Go to Settings, set alert to 5 minutes, and click "Save & Schedule". Check the notification shade
- **Offline** — Enable airplane mode in the emulator and reopen the app. Cached timings should still display
- **Orientation** — The app is portrait-locked via Capacitor config, verify it stays portrait

### Quick rebuild cycle

After making code changes:

```bash
npm run build && npx cap sync android
```

Then click Run in Android Studio again. For faster iteration, you can use live reload:

```bash
npx cap run android --livereload --external
```

---

## Testing on Physical Android Device

### Step 1 — Enable Developer Options on your phone

1. Go to **Settings > About Phone**
2. Tap **Build Number** 7 times
3. Go back to **Settings > Developer Options**
4. Enable **USB Debugging**

### Step 2 — Connect via USB

1. Plug your phone into your computer with a USB cable
2. Accept the "Allow USB debugging" prompt on your phone
3. Verify connection:

```bash
adb devices
```

You should see your device listed.

### Step 3 — Build and run

```bash
npm run build && npx cap sync android
npx cap run android
```

Or open Android Studio (`npx cap open android`) and select your physical device from the device dropdown, then click Run.

### Step 4 — Wireless debugging (optional)

To go cable-free after initial USB setup:

```bash
adb tcpip 5555
adb connect <phone-ip>:5555
```

Then unplug the cable. The device stays connected over Wi-Fi.

---

## Building a Release APK / AAB

Google Play requires an **AAB** (Android App Bundle). APKs are for local testing only.

### Step 1 — Generate a signing key (first time only)

```bash
keytool -genkey -v -keystore kaal-release.keystore -alias kaal -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for a password and details. **Save this keystore file and password securely** — you cannot update your app on Play Store without it.

Move the keystore:

```bash
mv kaal-release.keystore android/app/kaal-release.keystore
```

### Step 2 — Configure signing in Gradle

Edit `android/app/build.gradle`. Add inside the `android { }` block:

```groovy
signingConfigs {
    release {
        storeFile file("kaal-release.keystore")
        storePassword "YOUR_KEYSTORE_PASSWORD"
        keyAlias "kaal"
        keyPassword "YOUR_KEY_PASSWORD"
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

> **Security note:** For production, use environment variables or a `keystore.properties` file instead of hardcoding passwords. See [Android docs on signing](https://developer.android.com/studio/publish/app-signing).

### Step 3 — Build the web app and sync

```bash
npm run build && npx cap sync android
```

### Step 4 — Build the AAB

From the project root:

```bash
cd android
./gradlew bundleRelease
```

The signed AAB file will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 5 — Build an APK (optional, for local testing)

```bash
cd android
./gradlew assembleRelease
```

Output at:

```
android/app/build/outputs/apk/release/app-release.apk
```

Install it directly on a device:

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## Publishing to Google Play Store

### Step 1 — Create a Google Play Developer account

1. Go to https://play.google.com/console
2. Pay the one-time **$25 registration fee**
3. Complete **identity verification** (government ID required as of 2025)
4. Verification can take several days

### Step 2 — Create the app listing

1. In Play Console, click **Create app**
2. Fill in:
   - **App name:** Kaal Panchang
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free

### Step 3 — Complete the Store Listing

Go to **Grow > Store presence > Main store listing**:

| Field | Value |
|-------|-------|
| **Short description** | Rahu Kaal, Yamagandam & Gulika Kaal timings with alerts |
| **Full description** | Accurate daily Rahu Kaal, Yamagandam, and Gulika Kaal timings based on your location's sunrise and sunset. Features a live countdown timer, 7-day weekly view, push notification alerts, dark/light theme, and city search. Works offline. |
| **App icon** | 512x512 PNG (use `public/icons/icon-512.png` or a refined version) |
| **Feature graphic** | 1024x500 PNG (create in Figma/Canva — shows app name and a preview) |
| **Screenshots** | At least 2 phone screenshots (take from emulator using the camera button) |
| **Category** | Reference |

### Step 4 — Complete the Content Rating questionnaire

Go to **Policy > App content > Content rating**:

1. Click **Start questionnaire**
2. Select **Utility** category
3. Answer all questions (the app has no violence, gambling, etc.)
4. Submit — you'll get an **Everyone** rating

### Step 5 — Complete the Data Safety form

Go to **Policy > App content > Data safety**:

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | Yes |
| Location data | Collected, not shared. Used for sunrise/sunset calculation. Not stored on any server. |
| Is data encrypted in transit? | Yes (HTTPS) |
| Can users request data deletion? | Yes (clear app data) |

### Step 6 — Set up a Privacy Policy

Google requires a privacy policy URL. Create a simple one and host it (GitHub Pages works). It should state:

- The app collects location data solely for calculating local sunrise/sunset times
- Location data is stored only on the user's device
- No data is sent to any server (except Nominatim for city search, which is anonymous)
- No analytics or tracking

Set the privacy policy URL in **Policy > App content > Privacy policy**.

### Step 7 — Create a release

1. Go to **Release > Production**
2. Click **Create new release**
3. Upload the `app-release.aab` file from Step 4 of the build section
4. Add release notes:

```
Initial release:
- Rahu Kaal, Yamagandam, and Gulika Kaal timings
- Live countdown timer
- 7-day weekly view
- Push notification alerts
- GPS and city search
- Dark and light themes
- Works offline
```

5. Click **Review release**
6. Click **Start rollout to Production**

### Step 8 — Wait for review

- Google's review typically takes **a few hours to 3 days**
- You'll receive an email when the app is approved or if changes are needed
- Common rejection reasons: missing privacy policy, incomplete data safety form, app crashes on launch

---

## Quick Reference Commands

```bash
# Development
npm run dev                          # Start dev server

# Build & sync
npm run build && npx cap sync android  # Build + sync to Android

# Open Android Studio
npx cap open android

# Build release AAB
cd android && ./gradlew bundleRelease

# Build release APK
cd android && ./gradlew assembleRelease

# Install APK on connected device
adb install android/app/build/outputs/apk/release/app-release.apk

# Live reload on device
npx cap run android --livereload --external
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `adb devices` shows nothing | Enable USB Debugging on phone, try a different cable |
| Gradle build fails with SDK error | Open Android Studio > SDK Manager, install the required SDK version |
| App shows blank white screen | Run `npm run build && npx cap sync android` — the web assets may not have synced |
| Notifications don't fire | On Android 13+, the app must request `POST_NOTIFICATIONS` permission at runtime. Check the notification settings in the app |
| Location permission denied | Uninstall and reinstall the app, or go to phone Settings > Apps > Kaal Panchang > Permissions |
| `JAVA_HOME` not set | Android Studio bundles JDK at `C:\Program Files\Android\Android Studio\jbr`. Set `JAVA_HOME` to that path |
