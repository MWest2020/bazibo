# Releasing Bubbels to Google Play and the App Store

The game lives in `web/`. Capacitor wraps it as `android/` and `ios/`; both apps load the same
files from inside the package (no server). The €1 full version is the non-consumable product
`unlock_all`, sold through Google Play Billing and Apple StoreKit by the open-source
`cordova-plugin-purchase` (MIT). There is no receipt server and no third-party SDK.

## 0. Tools

| What | Version | On this host |
| --- | --- | --- |
| Node | 22+ (Capacitor 8 needs it) | `~/.local/opt/node22` |
| JDK | 21 | `~/.local/opt/jdk21` |
| Android SDK | platform 36, build-tools 36.0.0 | `~/.local/opt/android-sdk` |
| Xcode | 16 or newer, on a Mac | not here |

On this host, `. ~/.local/opt/android-env.sh` puts all of these on the `PATH`. Elsewhere,
Android Studio brings the JDK and the SDK.

## 1. Every release

1. `npm test` and `uv run --with playwright python tests/smoke.py` pass.
2. After changing anything under `web/`, run `npm run stamp`.
3. Bump the version in two places:
   - Android: `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
   - iOS: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in Xcode (target App, General).
4. `npx cap sync` copies `web/` and the plugin into both native projects. The copies are
   gitignored, so a fresh checkout always needs this step.
5. Build:
   - Android: `cd android && ./gradlew bundleRelease`. This makes
     `android/app/build/outputs/bundle/release/app-release.aab`, signed if
     `android/keystore.properties` exists (step 2.3) and unsigned otherwise.
   - iOS: see step 3.
6. After merging to `main`, publish the web version: `npm test && git subtree push --prefix web origin gh-pages`.

Store texts, form answers and screenshots are in `store/`. To regenerate the screenshots and the
feature graphic, run `uv run --with playwright --with pillow python tools/store_shots.py`. To
regenerate the app icons and launch screens, run
`uv run --with playwright --with pillow python tools/make_icons.py --native`.

## 2. Google Play (organisation account)

1. **Account.** Use an organisation developer account with a D-U-N-S number. The name and
   address from the D-U-N-S record are shown in the store. Set up a payments profile (merchant
   account) with the KvK and bank details, or the product cannot be sold. Google's testing
   requirement for new personal accounts (12 testers for 14 days) does not apply to
   organisation accounts. Check the Play Console text when you sign up, because Google changes
   these rules.
2. **Create the app.** Package name `work.westerweel.bubbels`. It is a game and it is free
   (with an in-app purchase).
3. **Signing.** Use Play App Signing: Google keeps the app signing key, and you only hold an
   *upload key*. Create it once, outside the repository, and back it up somewhere safe (a
   password manager or OpenBao):
   ```sh
   keytool -genkeypair -v -keystore ~/keys/bubbels-upload.jks -alias upload \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
   Then write `android/keystore.properties` (gitignored, never commit it):
   ```properties
   storeFile=/home/<you>/keys/bubbels-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   If the upload key is ever lost, Play support can reset it. The app signing key stays safe
   with Google.
4. **First upload.** Build with `./gradlew bundleRelease` and upload the AAB to the *Internal
   testing* track. Play only lets you create in-app products after a build with the BILLING
   permission has been uploaded.
5. **Product.** Go to Monetise › Products › In-app products. Create a product with ID
   `unlock_all`, the name and description from `store/listing-nl.md`, and price € 1,00. Then
   activate it.
6. **Test purchases.** Add your Google account under Settings › License testing, and as a tester
   on the internal track. Install the app from the testing link. Buy and restore with test cards;
   no money moves. Check that:
   - level 11 opens after buying;
   - the app restarts unlocked;
   - "Aankoop herstellen" works after reinstalling.
7. **Forms.** Fill in Target audience (Families), Content rating, Data safety, Ads and App access
   from `store/forms.md`. Fill in the store listing from `store/listing-nl.md` and add the English
   translation from `store/listing-en.md`. Upload the screenshots, the feature graphic and the
   512 px icon from `store/`.
8. **Release.** Promote the build from internal testing to production and send it for review.
   Apps for children get a stricter review, which can take several days.

## 3. Apple App Store

1. **Account.** Join the Apple Developer Program (€ 99 a year).
   - Enrolling as an organisation needs a legal entity with a D-U-N-S number.
   - Apple enrols sole proprietors (eenmanszaak) as an *individual*; the seller name in the store
     is then your own name. Check which applies when you enrol.
   - Sign the Paid Apps agreement and fill in tax and bank details in App Store Connect. Without
     them the in-app purchase does not work, not even in TestFlight.
2. **App ID.** Under Certificates, Identifiers & Profiles, register the bundle ID
   `work.westerweel.bubbels` with the *In-App Purchase* capability.
3. **App record.** In App Store Connect, create a new app with bundle ID
   `work.westerweel.bubbels`, name "Bubbels: bubble shooter" and primary language Dutch.
4. **Product.** Under In-App Purchases, create a Non-Consumable with product ID `unlock_all`,
   price € 1 and the texts from the listings. It goes to review together with the first build.
5. **Build, option A: your Mac.**
   ```sh
   git clone https://github.com/MWest2020/bubbels && cd bubbels
   npm ci && npx cap sync ios && npx cap open ios
   ```
   Xcode opens. Then:
   - Under target App › Signing & Capabilities, choose your team. Automatic signing is fine.
   - Check that *In-App Purchase* is listed as a capability.
   - Run the app on a simulator or your phone to try it.
   - Product › Archive, then Distribute App › App Store Connect › Upload.
6. **Build, option B: GitHub Actions on a macOS runner.**
   - `docs/ci/ios-build.yml.example` is a ready workflow. Copy it to `.github/workflows/ios-build.yml`.
     The token on the agent host lacks the `workflow` scope, so you have to push that file
     yourself.
   - Add the four secrets it lists: an App Store Connect API key (key ID, issuer ID, the .p8
     file in base64) and your team ID.
   - Run it from the Actions tab. It archives the app and uploads it to TestFlight.
7. **Test.** In TestFlight, buy with a sandbox account (App Store Connect › Users and Access ›
   Sandbox). Check buying, restarting and "Aankoop herstellen", as for Play.
8. **Forms and listing.** Fill in App Privacy ("Data Not Collected"), the age rating, Kids
   category and export compliance from `store/forms.md`, and the listing from
   `store/listing-*.md`. Upload the screenshots for iPhone 6.9" and iPad 13". Put the
   parental-gate hint from `store/forms.md` in the review notes.
9. **Submit.** Send the version together with the in-app purchase for review.

## 4. How the purchase works (for reviewers and future changes)

- `web/js/unlock.js` holds the purchase state:
  - it only becomes "owned" when the store says so;
  - the last answer is cached for offline play;
  - a "not owned" answer from the store (a refund, or a restore that finds nothing) clears the
    cache.

  On the web there is no store, so nothing can be bought.
- `web/js/billing-native.js` is the adapter on `cordova-plugin-purchase`. After a purchase it
  calls `finish()`, which on Google Play acknowledges the purchase (required within 3 days).
- `web/js/parental-gate.js` sits in front of buying and restoring. It asks a multiplication
  written in Dutch words with a typed answer, gives a new question after each wrong answer, and
  closes after 3 wrong answers.
- On iOS the plugin uses StoreKit 1 by default. Apple still supports it for non-consumables. The
  plugin's StoreKit 2 extension can be added later without changing the game code.
- Not verified on this host: there is no emulator (no KVM) and no Mac. The first real run of
  the purchase flow is the internal testing track (Play) or TestFlight (Apple).
