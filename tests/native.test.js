import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Android keeps save data in the phone backup and in a phone-to-phone transfer', () => {
  // Capacitor Preferences lives in shared_prefs/CapacitorStorage.xml: it must be in the Auto Backup
  // of Android 6-11 (fullBackupContent) and, on Android 12+, in both the cloud backup and the
  // device transfer (dataExtractionRules)
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="true"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  const sharedPref = /<include\s+domain="sharedpref"\s+path="\."\s*\/>/;
  const full = read('android/app/src/main/res/xml/backup_rules.xml');
  assert.match(full, /<full-backup-content>[\s\S]*<\/full-backup-content>/);
  assert.match(full, sharedPref);
  const rules = read('android/app/src/main/res/xml/data_extraction_rules.xml');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = rules.match(new RegExp(`<${section}[^>]*>([\\s\\S]*?)</${section}>`));
    assert.ok(body, `${section} is missing`);
    assert.match(body[1], sharedPref, `${section} leaves out shared_prefs`);
    assert.doesNotMatch(body[1], /<exclude\s+domain="sharedpref"/, `${section} excludes shared_prefs`);
  }
  assert.doesNotMatch(full, /<exclude\s+domain="sharedpref"/);
});

test('both apps ship the Preferences plugin the save data uses', () => {
  assert.ok(JSON.parse(read('package.json')).dependencies['@capacitor/preferences']);
  assert.match(read('android/capacitor.settings.gradle'), /:capacitor-preferences/);
  assert.match(read('ios/App/CapApp-SPM/Package.swift'), /CapacitorPreferences/);
});

// Voortgang overzetten: the camera, declared honestly and not required
test('the camera permission for scanning a progress code is declared, optional, and explained on iOS', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(manifest, /android\.hardware\.camera" android:required="false"/);
  assert.match(manifest, /android\.hardware\.camera\.autofocus" android:required="false"/);
  const plist = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
  assert.match(plist, /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*QR[^<]*<\/string>/);
});
