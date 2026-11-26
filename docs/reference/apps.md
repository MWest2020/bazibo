# Apps

```sh
. ~/.local/opt/android-env.sh       # on the agent host: Node 22, JDK 21, Android SDK
npm ci && npx cap sync              # copy web/ and the plugin into android/ and ios/
cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew bundleRelease    # app/build/outputs/bundle/release/app-release.aab, signed if the upload key is set up
```

iOS needs a Mac with Xcode, or the GitHub Actions example in `docs/ci/`. The full release steps
for both stores, including signing, are in `docs/release.md`.
