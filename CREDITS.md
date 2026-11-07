# Credits

The web game (`web/`) ships no third-party code, fonts, images or sounds. The Android and iOS
apps add the native wrapper and the store plugin listed under "Apps only".

| Asset | Author | Licence | Source |
|---|---|---|---|
| Game code, bubble drawing, icons (`web/icons/*.png`, rendered by `tools/make_icons.py`) | MWest2020 (with Claude Code) | MIT | this repository |
| Sounds | synthesised at runtime with the Web Audio API in `web/js/audio.js`; no sound files | MIT | this repository |
| UI icons (inline SVG paths in `web/index.html` and `web/js/main.js`) | MWest2020 (with Claude Code) | MIT | this repository |
| Bubble colours | based on the Okabe-Ito colour-blind-safe palette (Masataka Okabe and Kei Ito, "Color Universal Design", 2002), brightened | colour values, not copyrightable | https://jfly.uni-koeln.de/color/ |
| Font | none bundled; the device's own system font is used | n/a | n/a |

Apps only (`android/`, `ios/`, through npm; nothing of this is loaded on the website):

| Component | Licence | Source |
|---|---|---|
| Capacitor (`@capacitor/core`, `/android`, `/ios`, `/cli`) | MIT | https://github.com/ionic-team/capacitor |
| cordova-plugin-purchase (Google Play Billing and StoreKit bridge) | MIT | https://github.com/j3k0/cordova-plugin-purchase |
| `@capacitor/preferences` (save data in SharedPreferences / UserDefaults) | MIT | https://github.com/ionic-team/capacitor-plugins |
| `@capacitor/app` (the Android back button) | MIT | https://github.com/ionic-team/capacitor-plugins |
| Cordova Android/iOS runtime, as bundled by Capacitor | Apache-2.0 | https://github.com/apache/cordova-android |
| Google Play Billing Library (pulled in by the plugin on Android) | Android SDK licence (Google) | https://developer.android.com/google/play/billing |

Development only (not shipped in `web/`):

| Tool | Licence | Source |
|---|---|---|
| Playwright (smoke test, icon rendering) | Apache-2.0 | https://github.com/microsoft/playwright-python |
| Node.js test runner (`node --test`) | MIT | https://nodejs.org |
| fastlane (release automation, `fastlane/Fastfile`; usage reporting switched off) | MIT | https://github.com/fastlane/fastlane |

Any asset added later must be CC0, MIT, BSD or Apache-2.0 and must get a row here. The one
exception is the store's own billing library, which the stores require.
