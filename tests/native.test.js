import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Android keeps save data in the phone backup (Auto Backup includes shared_prefs)', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="true"/);
  // custom backup rules could leave out Capacitor Preferences (shared_prefs/CapacitorStorage.xml)
  assert.doesNotMatch(manifest, /fullBackupContent|dataExtractionRules/, 'add shared_prefs to any backup rules before adding them');
});

test('both apps ship the Preferences plugin the save data uses', () => {
  assert.ok(JSON.parse(read('package.json')).dependencies['@capacitor/preferences']);
  assert.match(read('android/capacitor.settings.gradle'), /:capacitor-preferences/);
  assert.match(read('ios/App/CapApp-SPM/Package.swift'), /CapacitorPreferences/);
});
