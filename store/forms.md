# Store forms: what to answer

These answers match what the app does today: no data collected, no ads, no accounts, no network
requests by the game, one non-consumable purchase behind a parental gate. If the app changes,
check these again. The store forms change wording now and then; the answers below are the facts
to map onto them.

## Google Play Console

### Target audience and content (Families)

- Target age groups: **5 and under** and **6-8**. Optionally 9-12. Choosing ages under 13
  puts the app under the Families policy, which it meets: no ads, no third-party SDKs, no data
  collected, purchase behind a parental gate.
- Could the app unintentionally appeal to children? Not applicable (it is meant for children).
- Ads: **No, my app does not contain ads.**
- Teacher Approved: optional, may be left off.

### Content rating (IARC questionnaire)

- Category: **Game**.
- Violence, fear, sexuality, nudity, language, controlled substances, crude humour: **No** to all.
- Gambling or simulated gambling: **No**. Real-money gambling: **No**.
- Users can interact or exchange content: **No**. Shares the user's location: **No**.
- In-app purchases or digital goods: **Yes**.
- Expected result: PEGI 3 / ESRB Everyone / USK 0, with the "In-app purchases" notice.

### Data safety

- Does your app collect or share any of the required user data types? **No.**
- That ends the form. The app has no account, so no account-deletion URL is needed.
- About Google Play Billing: the app only learns on the device whether `unlock_all` is owned.
  The payment itself is Google's. Check Play's current help text on billing data when filling
  this in; as of writing it does not ask developers to declare data that only Google Play's
  own billing system collects.
- About save data: progress, settings and the purchase cache stay on the device, in Capacitor
  Preferences (SharedPreferences). Android Auto Backup copies them to the user's own Google
  account backup; the developer never receives them. Play's Data safety help treats data that
  only leaves the device through the user's own Android backup as not collected; check the
  current wording when filling the form in.

### App access, ads, government apps, financial features, health

- App access: **All functionality is available without special access.**
- Ads: **No.** Government app: **No.** Financial features: **None.** Health: **None.**

### Privacy policy URL

https://bazibo.nl/privacy/

## Apple App Store Connect

### App Privacy (the "nutrition label")

- Do you or your third-party partners collect data from this app? **No, we do not collect data
  from this app.**
- The label then reads **Data Not Collected**. Purchases are handled by Apple and do not count
  as collection by the developer. Save data sits in UserDefaults on the device and is part of the
  user's own iCloud or computer backup, which the developer never sees.
- Privacy policy URL: https://bazibo.nl/privacy/en.html

### Age rating

- Answer **None / No** to every content question: violence, horror, mature themes, medical,
  alcohol and drugs, gambling, contests, sexual content, profanity.
- Unrestricted web access: **No**. User-generated content, messaging or chat: **No**.
- In-app purchases: declared through the product, not the questionnaire.
- Expected result: **4+**.

### Kids category

- Made for Kids: **Yes**, age band **5 and Under** or **6-8**.
- The guidelines for Kids apps are met:
  - no third-party analytics or ads;
  - purchases and any link out of the app sit behind a parental gate (`web/js/parental-gate.js`);
  - no data is collected.
- The app has no links that leave it. The privacy page inside the app is a local page, and its
  email address is plain text, not a link.

### Export compliance

- The app uses no encryption of its own. `ITSAppUsesNonExemptEncryption` is `false` in
  `ios/App/App/Info.plist`, so App Store Connect does not ask on every build.

### In-app purchase

- Type: **Non-Consumable**. Product ID: `unlock_all`. Price tier: € 1 (Tier 1 in the EU
  storefronts; check the current tier table).
- One purchase opens every game in the app. Each game has a free part (Bubbels: levels 1-10; Dogudoku: 10 of its 60 puzzles; Picturedoku: 10 of its 60 puzzles; Vier op een rij: playing together and the easy and medium computer, the hard computer is in the full version; Slangetje: 10 of its 30 levels).
- The review screenshot for the purchase: `store/screenshots/en/appstore-iphone-6.9-1290x2796/2-levels.png`
  shows where the full version sits. Review notes: "Open Bubble Shooter, tap a locked level (11+),
  then 'For parents: buy'. The parental gate asks a multiplication written in words, for example
  'seven times eight' = 56 (in Dutch: 'zeven keer acht'). The same offer is in Settings, 'More about
  the full version'. The app follows the device language (Dutch or English); Settings switches it."

## Screenshots and graphics

`uv run --with playwright --with pillow python tools/store_shots.py` regenerates:

| File | Use |
| --- | --- |
| `store/screenshots/<nl\|en>/play-phone-1080x1920/*.png` | Play phone screenshots (2-8 needed), per language |
| `store/screenshots/<nl\|en>/appstore-iphone-6.9-1290x2796/*.png` | App Store iPhone 6.9" (required), per language |
| `store/screenshots/<nl\|en>/appstore-ipad-13-2064x2752/*.png` | App Store iPad 13" (required while the app runs on iPad), per language |
| `store/feature-graphic-1024x500.png`, `store/feature-graphic-en-1024x500.png` | Play feature graphic (required), Dutch and English |
| `store/play-icon-512.png` | Play app icon (512x512, no alpha) |
