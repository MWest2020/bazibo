# Save data

One versioned document (`web/js/storage.js`): in the apps in Capacitor Preferences, so it is
part of the phone's own backup and survives a new phone (Android: Auto Backup and, from Android 12,
the phone-to-phone transfer, through explicit rules that include `shared_prefs`); on the web in
localStorage. Older save
data is migrated once and kept. Details in `docs/release.md`, section 5.

## Voortgang overzetten (move progress)

Settings › Voortgang overzetten, behind the parental gate. One device shows its progress (the
games' sections and the settings, never the purchase) as QR codes; the other scans them with the
camera or takes the code as pasted text. No server and no internet.

- `web/js/transfer.js` (pure, tested in `tests/transfer.test.js`): the save as JSON, deflated
  (`CompressionStream` where there is one; unpacked with `DecompressionStream` or, on iOS before
  16.4, the vendored fflate), with a format byte and a CRC-32, in base45 (so the QR
  codes use alphanumeric mode), split into parts of 600 characters `BZ1<set><i><n>:…` (QR version 13, level L), at most
  30. The receiver collects the parts of one set in any order, checks size (at most 512 kB
  unpacked), checksum and the shape of every value before anything touches the save. Merge keeps
  the best of both (stars and counts the higher value, colouring pages per region, how-to cards
  seen stay seen); replace takes the code's progress and settings. The purchase stays the
  device's own either way. When a code would need more than 30 QR codes, the sender offers one
  without colouring pages.
- `web/js/transfer-ui.js`: the screen. QR codes are drawn with qrcode-generator, read with the
  browser's `BarcodeDetector` or, without it, jsQR (both vendored in `web/vendor/`). The camera
  runs only while the Receive tab is open. Android declares `CAMERA` (not required), iOS
  `NSCameraUsageDescription`.
- `storage.applyTransfer()` stores the result, only when the save could be read at startup.
