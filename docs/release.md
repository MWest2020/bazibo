# Releasing Bazibo to Google Play and the App Store

Bazibo (repository `MWest2020/bazibo` and package id `work.westerweel.bazibo` since 2026-11-09; the first game and the storage keys keep the name `bubbels`) is one app with several
games (the brand, tagline and the line about the name are in `web/js/brand.js`; issue #2 holds
the name decision, decided: Bazibo). The app lives in `web/`: the shell in `web/js/`, each game
in `web/games/<id>/`. Capacitor wraps it as `android/` and `ios/`; both apps load the same files
from inside the package (no server). The €1 full version is the non-consumable product
`unlock_all`; it opens every game. It is sold through Google Play Billing and Apple StoreKit by
the open-source `cordova-plugin-purchase` (MIT). There is no receipt server and no third-party
SDK. Save data goes through `@capacitor/preferences` in the apps (section 5).

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
3. The version:
   - Android: `fastlane android internal` asks Play for the highest version code and builds with
     the next one. By hand: `./gradlew bundleRelease -PbubbelsVersionCode=<n> -PbubbelsVersionName=<x.y.z>`
     (without them the build is code 1, name 1.0.0).
   - iOS: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in Xcode (target App, General).
4. `npx cap sync` copies `web/` and the plugin into both native projects. The copies are
   gitignored, so a fresh checkout always needs this step.
5. Build:
   - Android: `cd android && ./gradlew bundleRelease`. This makes
     `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key when
     its properties file is found (step 2.3) and unsigned otherwise. Gradle does not notice when
     only the key file appears or changes; then delete `android/app/build/outputs/bundle` first.
     Check the result with `jarsigner -verify -certs app/build/outputs/bundle/release/app-release.aab`
     and compare the SHA-256 from `keytool -printcert -jarfile <aab>` with the one in step 2.3.
   - iOS: see step 3.
6. The website updates itself: on every merge to `main`, `.github/workflows/ci.yml` runs the tests
   and the fastlane check, then publishes `web/` to GitHub Pages. (The old `gh-pages` branch is no
   longer used.)

Store texts, form answers and screenshots are in `store/` (screenshots per language in
`store/screenshots/nl/` and `store/screenshots/en/`). To regenerate the screenshots and the
feature graphics, run `uv run --with playwright --with pillow python tools/store_shots.py`. To
regenerate the app icons and launch screens, run
`uv run --with playwright --with pillow python tools/make_icons.py --native`.

## 2. Google Play (organisation account)

1. **Account.** Use an organisation developer account with a D-U-N-S number. The name and
   address from the D-U-N-S record are shown in the store. Set up a payments profile (merchant
   account) with the KvK and bank details, or the product cannot be sold. Google's testing
   requirement for new personal accounts (12 testers for 14 days) does not apply to
   organisation accounts. Check the Play Console text when you sign up, because Google changes
   these rules.
2. **Create the app.** Package name `work.westerweel.bazibo`. It is permanent once the first
   build is uploaded and it shows in the Play Store URL. It was changed from
   `work.westerweel.bubbels` on 2026-11-09, before any upload; save data needed no migration,
   because there were no store users yet (Capacitor Preferences are per app). Name "Bazibo: spelen en leren". It is a game and it is
   free (with an in-app purchase).
3. **Signing.** Use Play App Signing: Google keeps the app signing key, and we only hold an
   *upload key*. It exists (made 2026-11-07) and lives outside the repository:
   - keystore: `~/.config/bubbels/upload-keystore.jks` on the agent host (alias `upload`,
     PKCS12, RSA 4096);
   - Gradle properties: `~/.config/bubbels/keystore.properties` (`storeFile`, `storePassword`,
     `keyAlias`, `keyPassword`);
   - backup: OpenBao KV v2 at `kv/bubbels/play-upload` (fields `keystore_b64`, `store_password`,
     `key_alias`, `key_password`), also in the nightly OpenBao snapshot;
   - upload certificate SHA-256:
     `8A:B3:BF:98:4E:80:A4:34:DB:E1:1F:D8:39:04:3F:7A:39:56:2C:76:13:27:5B:F6:2D:97:A6:D2:3E:44:02:02`.

   `android/app/build.gradle` reads the properties file named in `$BUBBELS_KEYSTORE_PROPERTIES`,
   else `~/.config/bubbels/keystore.properties`; a relative `storeFile` is taken relative to that
   file. With neither file it builds unsigned. A `$BUBBELS_KEYSTORE_PROPERTIES` that points nowhere,
   a properties file that lacks one of the four keys, or a missing keystore stops the build with
   a clear message instead of quietly building unsigned; an old `android/keystore.properties` is
   not read and gives a warning. Never commit the keystore or the properties file
   (`*.jks` and `keystore.properties` are gitignored). On a new machine, restore both from
   OpenBao into `~/.config/bubbels/`.

   If the upload key is lost or leaks, ask for an *upload key reset* in Play Console (Setup ›
   App signing › Request upload key reset) with a new key's certificate. The app signing key
   stays with Google, so installed apps keep updating.
4. **First upload, by hand.** Build with `fastlane android build` (or `./gradlew bundleRelease`)
   and upload the AAB in Play Console to the *Internal testing* track. The Play API cannot create
   an app or make its first release, so this one is manual; every later one is automatic
   (section 6). Play only lets you create in-app products after a build with the BILLING
   permission has been uploaded.
5. **Product.** Go to Monetise › Products › In-app products. Create a product with ID
   `unlock_all`, the name and description from `store/listing-nl.md` (English in
   `store/listing-en.md`), and price € 1,00. Then activate it.
6. **Test purchases.** Add your Google account under Settings › License testing, and as a tester
   on the internal track. Install the app from the testing link. Buy and restore with test cards;
   no money moves. Check that:
   - Bubbels level 11, the locked Dogudoku and Picturedoku puzzles, the hard computer in Vier op een rij and the locked Slangetje levels open after buying (and the offer after level 10 leads to the purchase);
   - the app restarts unlocked, also with the phone offline;
   - "Aankoop herstellen" works after reinstalling;
   - progress survives an app update (section 5).
7. **Forms.** Fill in Target audience (Families), Content rating, Data safety, Ads and App access
   from `store/forms.md`. Fill in the store listing from `store/listing-nl.md` and add the English
   translation from `store/listing-en.md`. Upload the screenshots per language
   (`store/screenshots/nl/`, `store/screenshots/en/`), the feature graphics
   (`feature-graphic-1024x500.png`, `feature-graphic-en-1024x500.png`) and the 512 px icon.
8. **Release.** Promote the build from internal testing to production and send it for review.
   Apps for children get a stricter review, which can take several days.
9. **API access for the automation.** Play Console › Setup › API access: link a Google Cloud
   project, create a service account, download its JSON key, and in Users and permissions give
   that account release rights for this app (Release to production, Manage testing tracks, Edit
   store listing). Put the JSON at `~/.config/bubbels/play-service-account.json` on the release
   machine (or point `PLAY_JSON_KEY` at it), and keep a copy in OpenBao next to the upload key.
   Never commit it.

## 3. Apple App Store

1. **Account.** Join the Apple Developer Program (€ 99 a year).
   - Enrolling as an organisation needs a legal entity with a D-U-N-S number.
   - Apple enrols sole proprietors (eenmanszaak) as an *individual*; the seller name in the store
     is then your own name. Check which applies when you enrol.
   - Sign the Paid Apps agreement and fill in tax and bank details in App Store Connect. Without
     them the in-app purchase does not work, not even in TestFlight.
2. **App ID.** Under Certificates, Identifiers & Profiles, register the bundle ID
   `work.westerweel.bazibo` with the *In-App Purchase* capability.
3. **App record.** In App Store Connect, create a new app with bundle ID
   `work.westerweel.bazibo`, name "Bazibo: spelen en leren" (English localization "Bazibo:
   play and learn") and primary language Dutch.
4. **Product.** Under In-App Purchases, create a Non-Consumable with product ID `unlock_all`,
   price € 1 and the texts from the listings. It goes to review together with the first build.
5. **Build, option A: your Mac.**
   ```sh
   git clone https://github.com/MWest2020/bazibo && cd bazibo
   npm ci && npx cap sync ios && npx cap open ios
   ```
   Xcode opens. Then:
   - Under target App › Signing & Capabilities, choose your team. Automatic signing is fine.
   - Check that *In-App Purchase* is listed as a capability.
   - Run the app on a simulator or your phone to try it. Xcode resolves the Swift packages
     (Capacitor, Preferences) on the first build.
   - Product › Archive, then Distribute App › App Store Connect › Upload.
6. **Build, option B: GitHub Actions on a macOS runner.**
   - `docs/ci/ios-build.yml.example` is a ready workflow. Copy it to `.github/workflows/ios-build.yml`.
     The token on the agent host lacks the `workflow` scope, so you have to push that file
     yourself.
   - Add the four secrets it lists: an App Store Connect API key (key ID, issuer ID, the .p8
     file in base64) and your team ID.
   - Run it from the Actions tab. It archives the app and uploads it to TestFlight.
7. **Test.** In TestFlight, buy with a sandbox account (App Store Connect › Users and Access ›
   Sandbox). Check buying, restarting, "Aankoop herstellen" and progress after an update, as
   for Play.
8. **Forms and listing.** Fill in App Privacy ("Data Not Collected"), the age rating, Kids
   category and export compliance from `store/forms.md`, and the listing from
   `store/listing-*.md`. Upload the screenshots for iPhone 6.9" and iPad 13" per language. Put
   the parental-gate hint from `store/forms.md` in the review notes.
9. **Submit.** Send the version together with the in-app purchase for review.

## 4. How the purchase works (for reviewers and future changes)

- One purchase opens every game. Each game declares its free part in `web/games/<id>/meta.js`
  (Bubbels: `free: 10` levels; Dogudoku and Picturedoku: the 10 puzzles marked `free: true` in their `puzzles.json`, a few of every size; Vier op een rij: playing together and the easy and medium computer, `freeLevels` in its `meta.js`; Slangetje: the 10 levels marked `free: true` in its `levels.json`); the offer appears at the end of a free part and in Settings.
- `web/js/unlock.js` holds the purchase state:
  - it only becomes "owned" when the store says so;
  - the last answer is cached for offline play;
  - a "not owned" answer from the store (a refund, or a restore that finds nothing) clears the
    cache.

  On the web there is no store, so nothing can be bought.
- `web/js/billing-native.js` is the adapter on `cordova-plugin-purchase`. After a purchase it
  calls `finish()`, which on Google Play acknowledges the purchase (required within 3 days).
- `web/js/parental-gate.js` sits in front of buying and restoring. It asks a multiplication
  written in words (Dutch or English, following the app's language) with a typed answer, gives a
  new question after each wrong answer, and closes after 3 wrong answers.
- On iOS the plugin uses StoreKit 1 by default. Apple still supports it for non-consumables. The
  plugin's StoreKit 2 extension can be added later without changing the game code.
- Not verified on this host: there is no emulator (no KVM) and no Mac. The first real run of
  the purchase flow is the internal testing track (Play) or TestFlight (Apple).

## 5. Save data

- Progress, settings and the purchase cache are one versioned document,
  `{version, games: {bubbels: {...}}, settings: {...}, purchase: {...}}`, under the key
  `bubbels.save` (`web/js/storage.js`). A new game adds its own section under `games`; a change
  to the format raises `version` and adds a step to `migrate()`.
- In the apps it lives in Capacitor Preferences (Android SharedPreferences, iOS UserDefaults),
  not in the WebView's localStorage, which iOS may clear when space runs low. On the web it
  stays in localStorage.
- First app start after this change: the old localStorage keys (`bubbels.v1`,
  `bubbels.settings.v1`, `bubbels.full.v1`) are copied in once, the document records
  `migrated: {from, at}`, and the old keys are left alone.
- A document from a newer app version is never wiped: this version reads what it knows and
  writes back only its own fields. A corrupt value is kept aside as `bubbels.save.corrupt` and
  the app starts from the old keys or from scratch. If that copy cannot be written, nothing is
  written at all.
- A read that fails or hangs (3 tries, 3 s each) never counts as "nothing stored": the session
  plays from memory and writes nothing. The read is tried again on the next save and when the app
  comes back to the front; once it works, the session is merged in (best stars per level, the
  full version if either side has it, settings only if the child changed them) and saving starts.
- A failed write is retried with the latest save on the next save or when the app comes back.
- It stays on the device and nothing goes to us. It is part of the phone's own backup: Android
  Auto Backup and, on Android 12+, the phone-to-phone transfer (`android:allowBackup="true"` with
  explicit rules that include the `sharedpref` domain, where Capacitor Preferences keeps the save:
  `res/xml/backup_rules.xml` for Android 6-11 and `res/xml/data_extraction_rules.xml` with
  `cloud-backup` and `device-transfer` for 12+; `tests/native.test.js` checks all of it) and the
  iPhone's iCloud or computer backup. Android makes the cloud backup about once a day (charging,
  on Wi-Fi), so the last day's progress can be missing after a restore. So progress
  moves to a new phone without an account. The store answers stay "no data collected"
  (`store/forms.md`).

## 6. Release automation (fastlane)

`fastlane/Fastfile` holds the lanes; `Gemfile` pins fastlane to an exact version (2.241.2), because
there is no `Gemfile.lock` yet (no Ruby on the agent host); bump it on purpose. Install once with
Ruby 3.3: `bundle install`. Usage reporting to fastlane is off (`opt_out_usage`). CI (`.github/workflows/ci.yml`) installs it on every push and checks that the
lanes load, that the store texts fit the limits, and that an upload lane without a Play key
stops with "No Play key yet".

| Lane | Does | Needs |
| --- | --- | --- |
| `fastlane android check` | writes `fastlane/metadata/` from `store/` (`tools/store-to-fastlane.mjs`), checks the store limits, says which keys are present | nothing |
| `fastlane android build` | `npx cap sync android`, signed release AAB, stops the Gradle daemon | the upload key (section 2.3) |
| `fastlane android internal` | asks Play for the highest version code, builds the next one, uploads it to *Internal testing* (`status:draft` until the app is published) | upload key + Play key (2.9) |
| `fastlane android promote` | internal → production, staged: `rollout:0.2` is 20 %, `rollout:1` everyone; `version_code:` to pick one | Play key |
| `fastlane android metadata` | texts, screenshots, feature graphic and icon, NL and EN, from `store/` (`validate_only:true` to try) | Play key |
| `fastlane ios beta` | (Mac with Xcode) sync, next build number, archive, upload to TestFlight | App Store Connect API key: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_B64` |
| `fastlane ios metadata` | App Store texts and screenshots from `store/` | the same key |

**After the one-time steps** (2.1–2.9: account, app, first upload by hand, product, forms, API
access), a release is:

    fastlane android internal        # test it from the internal testing link
    fastlane android promote         # 20 % of users, then: fastlane android promote rollout:1

Store texts or screenshots changed: `fastlane android metadata`.

**Later, in CI:** a tag push (`v1.2.0`) runs `fastlane android internal` in GitHub Actions with
the upload key and the Play key as repository secrets. That job is not written yet, on purpose:
it can only be tested once the Play key exists.

The iOS lanes are a skeleton until there is a Mac or the macOS job from
`docs/ci/ios-build.yml.example`.

## 7. Websites

The web build (`web/`) is served in two places:

- **https://bazibo.nl/** (canonical; used as the store website and privacy URL). Hosting is
  Yourhosting's Plesk (Basic Web + Mail). A GitHub push webhook makes Plesk pull `main` into
  `~/bazibo-repo` on the hosting and the site's document root is `bazibo-repo/web`, so only
  `web/` is reachable. Let's Encrypt (Plesk "SSL It!") covers bazibo.nl, www and mail, and
  renews itself 30 days before expiry. HTTP and www redirect (301) to https://bazibo.nl/.
- **https://mwest2020.github.io/bazibo/** (GitHub Pages, deployed by `.github/workflows/ci.yml`).

Contact for the stores and the privacy pages: **hallo@bazibo.nl** (a Plesk forwarder to
Mark's mailbox). Where everything lives, the credentials' OpenBao paths and how to roll back:
homelab runbook `docusaurus/docs/runbooks/bazibo-nl.md`.
