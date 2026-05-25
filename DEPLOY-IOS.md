# Kaal Panchang — Local Testing & iOS App Store Publishing

## Table of Contents

1. [Important: macOS Requirement](#important-macos-requirement)
2. [Prerequisites](#prerequisites)
3. [Local Testing in Browser (Safari)](#local-testing-in-browser-safari)
4. [Testing on iOS Simulator](#testing-on-ios-simulator)
5. [Testing on Physical iPhone/iPad](#testing-on-physical-iphoneipad)
6. [Building a Release Archive](#building-a-release-archive)
7. [Publishing to the App Store](#publishing-to-the-app-store)
8. [Cloud Build Alternative (No Mac)](#cloud-build-alternative-no-mac)

---

## Important: macOS Requirement

iOS apps **cannot be built on Windows or Linux**. You need one of the following:

| Option | Details |
|--------|---------|
| **Mac hardware** | Any Mac running macOS 14 Sonoma or later |
| **Mac Mini** | Cheapest option (~$599) if you need dedicated hardware |
| **Cloud CI/CD** | GitHub Actions macOS runners, Codemagic, or Bitrise (see [Cloud Build Alternative](#cloud-build-alternative-no-mac)) |
| **Rent a Mac** | Services like MacStadium or AWS EC2 Mac instances |

The rest of this guide assumes you have access to macOS.

---

## Prerequisites

Install these on your Mac:

| Tool | Version | How to Install |
|------|---------|----------------|
| Xcode | 15+ | Mac App Store (free, ~12 GB download) |
| Xcode Command Line Tools | Latest | `xcode-select --install` |
| Node.js | 18+ | https://nodejs.org or `brew install node` |
| CocoaPods | Latest | `sudo gem install cocoapods` |
| Apple Developer Account | — | https://developer.apple.com ($99/year) |

After installing Xcode:

1. Open Xcode once and accept the license agreement
2. Go to **Xcode > Settings > Platforms** and ensure **iOS 17** (or latest) simulator is downloaded
3. Go to **Xcode > Settings > Accounts** and sign in with your Apple ID

Verify setup:

```bash
node --version          # Should print v18+
xcodebuild -version     # Should print Xcode 15+ and Build version
pod --version           # Should print 1.x
```

---

## Local Testing in Browser (Safari)

Before touching Xcode, test the web app in Safari to catch iOS-specific rendering issues.

### Start the dev server

```bash
cd /path/to/kaal
npm run dev
```

Open **http://localhost:5173** in Safari.

### What to test in Safari specifically

- **Safe area insets** — Enable the Safari Responsive Design Mode (Develop > Enter Responsive Design Mode) and select an iPhone with a notch. The header and bottom nav should not overlap the notch or home indicator
- **CSS backdrop-filter** — Verify any blur effects render (Safari handles these differently)
- **-webkit-appearance** — Check that the toggle switches and select dropdowns render properly
- **Touch scrolling** — Verify smooth scrolling on the week table view
- **PWA Add to Home Screen** — In Safari on a real iPhone, tap Share > Add to Home Screen. The app should launch in standalone mode with the correct icon and splash color

---

## Testing on iOS Simulator

### Step 1 — Build the web app

```bash
cd /path/to/kaal
npm run build
```

### Step 2 — Sync to iOS project

```bash
npx cap sync ios
```

This copies `dist/` into `ios/App/App/public/` and updates native plugins.

### Step 3 — Open in Xcode

```bash
npx cap open ios
```

Xcode opens the `ios/App/` workspace.

### Step 4 — Select a simulator

1. In Xcode's top toolbar, click the device selector (next to the play/stop buttons)
2. Choose a simulator, e.g. **iPhone 15 Pro**
3. Click the **Run** button (or press Cmd+R)
4. The simulator launches and the app opens

### What to test on simulator

- **Location** — In the simulator menu: **Features > Location > Custom Location**. Enter coordinates (e.g. 12.97, 77.59 for Bengaluru) and test "Use Current Location"
- **Notifications** — The simulator supports local notifications. Set alert to 5 minutes in Settings and tap "Save & Schedule". A notification should appear
- **Dark Mode** — In simulator: **Settings > Developer > Dark Appearance**. The app should follow the system theme if configured, or use its own toggle
- **Orientation lock** — Rotate the simulator (Cmd+Left/Right). The app should stay portrait
- **Notch/Dynamic Island** — Test on both notched (iPhone 14) and Dynamic Island (iPhone 15 Pro) simulators. Content should not be obscured
- **Offline** — Not directly testable in simulator. Test offline via Safari or on a physical device

### Quick rebuild cycle

After code changes:

```bash
npm run build && npx cap sync ios
```

Then press Cmd+R in Xcode. For faster iteration:

```bash
npx cap run ios --livereload --external
```

---

## Testing on Physical iPhone/iPad

### Step 1 — Apple Developer account

You need a **paid Apple Developer account** ($99/year) to install apps on a physical device for more than 7 days. A free Apple ID allows 7-day provisioning for testing.

Enroll at: https://developer.apple.com/programs/enroll

### Step 2 — Register your device

Option A — Automatic (recommended):

1. Plug your iPhone into your Mac with a USB/Lightning cable
2. Open Xcode, your device appears in the device selector
3. Xcode automatically registers the device when you first run on it

Option B — Manual:

1. On your iPhone: **Settings > General > About**. Copy the **UDID**
2. Go to https://developer.apple.com/account/resources/devices
3. Click **+** and add your device UDID

### Step 3 — Configure signing in Xcode

1. Open the project: `npx cap open ios`
2. In Xcode, select the **App** target in the left sidebar
3. Go to the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** (your Apple Developer account)
6. Xcode generates a provisioning profile automatically

If you see a signing error:
- Ensure your Apple ID is added in **Xcode > Settings > Accounts**
- The Bundle Identifier must be unique: `com.kaalpanchang.app`

### Step 4 — Add required privacy descriptions

iOS requires user-facing descriptions for location and notification permissions. Edit `ios/App/App/Info.plist` and ensure these keys exist:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Kaal Panchang needs your location to calculate accurate sunrise/sunset times for your area.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Kaal Panchang uses your location to provide accurate kaal timings.</string>
```

Capacitor's geolocation plugin usually adds these, but verify they're present.

### Step 5 — Build and run

1. Select your physical device from Xcode's device selector
2. Press Cmd+R (or click Run)
3. On first install, your iPhone will show **"Untrusted Developer"**
4. On your iPhone: **Settings > General > VPN & Device Management** > tap your developer certificate > **Trust**
5. Run again from Xcode

### Step 6 — Test on device

- **GPS accuracy** — Walk outside and test real GPS coordinates
- **Notifications** — Set a short alert time and lock the phone. Notification should appear on lock screen
- **Home screen icon** — The app icon should appear correctly (not a blank or default icon)
- **App switching** — Double-tap home/swipe up to enter app switcher. Return to app and verify state is preserved
- **Kill and relaunch** — Force-quit the app and reopen. Saved location and theme should persist

---

## Building a Release Archive

### Step 1 — Build the web app

```bash
npm run build && npx cap sync ios
```

### Step 2 — Set the version number

In Xcode, select the **App** target:

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 (shown to users on the App Store) |
| **Build** | 1 (increment this for each upload) |

Or edit `ios/App/App/Info.plist`:

```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

### Step 3 — Set build configuration to Release

1. In Xcode: **Product > Scheme > Edit Scheme**
2. Select **Run** on the left
3. Set **Build Configuration** to **Release**
4. Close the dialog

### Step 4 — Archive the app

1. Select **Any iOS Device (arm64)** as the build target (not a simulator)
2. Go to **Product > Archive**
3. Xcode compiles the app and opens the **Organizer** when done
4. The archive appears in the list with the date and version

If the archive fails:
- Check that signing is configured correctly (Step 3 of physical device section)
- Ensure the build target is a real device, not a simulator
- Check for build errors in the Issue navigator (Cmd+5)

### Step 5 — Validate the archive (optional but recommended)

1. In the Organizer, select your archive
2. Click **Validate App**
3. Follow the prompts — Xcode checks for common issues
4. Fix any reported errors before uploading

---

## Publishing to the App Store

### Step 1 — Create an App Store Connect listing

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps > +** > **New App**
3. Fill in:

| Field | Value |
|-------|-------|
| **Platform** | iOS |
| **Name** | Kaal Panchang |
| **Primary Language** | English |
| **Bundle ID** | com.kaalpanchang.app (must match Xcode) |
| **SKU** | kaalpanchang001 (any unique string) |

### Step 2 — Complete the App Information

Go to **App Information**:

| Field | Value |
|-------|-------|
| **Category** | Reference |
| **Secondary Category** | Lifestyle (optional) |
| **Content Rights** | Does not contain third-party content that requires rights |
| **Age Rating** | Complete the questionnaire — all answers "No" → rated 4+ |

### Step 3 — Prepare the Store Listing

Go to **App Store > iOS App > your version**:

| Field | Value |
|-------|-------|
| **Screenshots** | Required for 6.7" (iPhone 15 Pro Max) and 6.5" (iPhone 11 Pro Max). Take from simulator: Cmd+S |
| **Promotional Text** | Accurate Rahu Kaal, Yamagandam & Gulika Kaal timings (optional, can change anytime) |
| **Description** | Accurate daily Rahu Kaal, Yamagandam, and Gulika Kaal timings based on your location's sunrise and sunset. Features a live countdown timer, 7-day weekly view, push notification alerts, dark/light theme, and city search. Works fully offline. |
| **Keywords** | rahu kaal, yamagandam, gulika, panchang, hindu calendar, auspicious time, inauspicious, sunrise, sunset |
| **Support URL** | Your website or GitHub repository URL |
| **Privacy Policy URL** | Required — host a privacy policy page (see below) |

### Step 4 — Screenshots

Capture screenshots from the iOS simulator:

```bash
# Run on specific simulators for each required size
xcrun simctl boot "iPhone 15 Pro Max"    # 6.7 inch
xcrun simctl boot "iPhone 15 Pro"        # 6.1 inch (optional)
```

In the simulator, press **Cmd+S** to save a screenshot. You need:

| Size | Device | Required |
|------|--------|----------|
| 6.7" | iPhone 15 Pro Max | Yes (at least 2 screenshots) |
| 6.5" | iPhone 11 Pro Max | Yes (can reuse 6.7" in most cases) |
| 5.5" | iPhone 8 Plus | Only if supporting older devices |
| 12.9" iPad | iPad Pro 12.9" | Only if targeting iPad |

Recommended screenshots:
1. Today view showing all three kaal cards
2. Today view with a LIVE kaal
3. Week view table
4. Settings view with city search
5. Dark and light theme comparison

### Step 5 — Privacy Policy

Apple requires a publicly accessible privacy policy URL. Create one stating:

- The app collects location data solely to calculate local sunrise/sunset times
- Location data is stored only on the device and never transmitted to any server
- City search queries are sent to OpenStreetMap Nominatim (anonymous, no tracking)
- No personal data is collected, stored, or shared
- No analytics or advertising SDKs are used
- Contact information for privacy questions

Host it on GitHub Pages, your own website, or a free static host.

### Step 6 — Upload the build

From Xcode's Organizer:

1. Select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Choose **Upload**
5. Follow the prompts (signing, bitcode, symbols)
6. Click **Upload**

The build takes a few minutes to process. Check status in App Store Connect under **TestFlight** or **Activity**.

### Step 7 — TestFlight (recommended before public release)

TestFlight lets you distribute beta builds to testers before going live.

1. In App Store Connect, go to **TestFlight**
2. Your uploaded build appears after processing (5–30 minutes)
3. Click the build and answer the export compliance question:
   - "Does your app use encryption?" → **No** (the app doesn't implement custom encryption; HTTPS is handled by the OS)
4. **Internal testing** (up to 100 people in your team):
   - Add testers under **Internal Group**
   - They receive a TestFlight invite email
5. **External testing** (up to 10,000 people):
   - Create an external group
   - Submit for Beta App Review (usually approved in <24 hours)
   - Share the public TestFlight link

### Step 8 — Submit for App Review

1. In App Store Connect, go to your app version
2. Select the uploaded build
3. Fill in the **App Review Information**:
   - Contact info (name, email, phone)
   - Sign-in not required (the app has no login)
   - Notes: "This app calculates Hindu astrological timings (Rahu Kaal, Yamagandam, Gulika Kaal) based on sunrise/sunset. Allow location access when prompted to see timings for your city."
4. Click **Submit for Review**

### Step 9 — Wait for review

- Apple review typically takes **24 hours to 3 days** (first submissions may take longer)
- You'll receive an email with the result
- Status changes visible in App Store Connect

### Common rejection reasons and how to avoid them

| Rejection Reason | How to Avoid |
|-----------------|--------------|
| **4.2 — Minimum Functionality** | Apple may reject if the app feels like a simple website. Mitigate by: adding smooth CSS animations, ensuring native splash screen works, proper safe-area handling, responsive touch targets |
| **5.1.1 — Data Collection** | Ensure the privacy policy URL is valid and accurately describes location data usage |
| **2.1 — Crashes** | Test thoroughly on real devices. Check edge cases: no GPS, no internet, extreme latitudes |
| **2.3.3 — Screenshots** | Screenshots must accurately show the app. Don't use mockups or add misleading content |
| **5.1.2 — Location Usage** | The location permission string must clearly explain why location is needed. Vague descriptions like "to improve your experience" get rejected |

If rejected, read the rejection reason in Resolution Center, fix the issue, increment the Build number, re-archive, upload, and resubmit.

---

## Cloud Build Alternative (No Mac)

If you don't have access to a Mac, these services can build and sign your iOS app in the cloud.

### Option 1 — Codemagic (Recommended)

1. Sign up at https://codemagic.io (free tier: 500 build minutes/month)
2. Connect your Git repository (GitHub, GitLab, Bitbucket)
3. Add a `codemagic.yaml` to your project root:

```yaml
workflows:
  ios-release:
    name: iOS Release
    max_build_duration: 30
    instance_type: mac_mini_m2
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.kaalpanchang.app
      vars:
        XCODE_WORKSPACE: "ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"
      node: 18
    scripts:
      - name: Install dependencies
        script: npm ci
      - name: Build web app
        script: npm run build
      - name: Sync Capacitor
        script: npx cap sync ios
      - name: Install CocoaPods
        script: cd ios/App && pod install
      - name: Build iOS
        script: |
          xcode-project build-ipa \
            --workspace "$XCODE_WORKSPACE" \
            --scheme "$XCODE_SCHEME"
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
```

4. Configure iOS signing in Codemagic dashboard (upload your certificates and provisioning profiles)
5. Push to your repo — Codemagic builds and optionally uploads to App Store Connect

### Option 2 — GitHub Actions

Add `.github/workflows/ios.yml`:

```yaml
name: iOS Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npx cap sync ios
      - run: cd ios/App && pod install
      - name: Build archive
        run: |
          xcodebuild archive \
            -workspace ios/App/App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath build/App.xcarchive \
            -destination "generic/platform=iOS" \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO
```

Note: Full signing and upload requires additional setup with certificates stored as GitHub Secrets.

### Option 3 — Rent a Mac

| Service | Price | Notes |
|---------|-------|-------|
| MacStadium | ~$50/month | Dedicated Mac Mini in the cloud |
| AWS EC2 Mac | ~$1/hour | On-demand, minimum 24-hour allocation |
| MacinCloud | ~$20/month | Pay-as-you-go cloud Mac |

---

## Quick Reference Commands

```bash
# Development
npm run dev                        # Start dev server

# Build & sync
npm run build && npx cap sync ios  # Build + sync to iOS

# Open Xcode
npx cap open ios

# Live reload on simulator
npx cap run ios --livereload --external

# Run on specific simulator
npx cap run ios --target "iPhone 15 Pro"

# List available simulators
xcrun simctl list devices available
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No signing certificate" error | Add your Apple ID in Xcode > Settings > Accounts. Enable Automatic Signing |
| Pod install fails | Run `cd ios/App && pod repo update && pod install` |
| White screen on simulator | Run `npm run build && npx cap sync ios`. Web assets may not have synced |
| "Untrusted Developer" on device | On iPhone: Settings > General > VPN & Device Management > Trust your certificate |
| App rejected for 4.2 Minimum Functionality | Add animations, haptic feedback, proper splash screen. Avoid purely web-like feel |
| Archive option greyed out | Select "Any iOS Device (arm64)" as build target, not a simulator |
| Build fails with "module not found" | Run `npx cap sync ios` to ensure plugins are linked, then `pod install` |
| Location not working on device | Verify `NSLocationWhenInUseUsageDescription` exists in Info.plist |
| TestFlight build not appearing | Wait 5–30 minutes for processing. Check Activity tab in App Store Connect |
| Export compliance question | Answer "No" — the app does not use custom encryption. HTTPS is OS-level |
