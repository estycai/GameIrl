// Builds the release APK with the local Gradle wrapper.
//
// A node script rather than a shell one-liner: npm runs scripts through cmd on
// Windows, where the current directory is not on PATH, so a bare `gradlew.bat`
// is not found — and the `.\` that fixes that in cmd breaks under Git Bash.
// Spawning with an explicit cwd sidesteps the difference entirely.
//
// The SDK path and the JDK path come from android/local.properties and
// android/gradle.properties, so no environment setup is required.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_DIR = join(APP_DIR, 'android');
const APK = join(
  ANDROID_DIR,
  'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk',
);

if (!existsSync(ANDROID_DIR)) {
  console.error(
    'build-apk: android/ is missing. Run `npm run prebuild` first.',
  );
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const wrapper = join(ANDROID_DIR, isWindows ? 'gradlew.bat' : 'gradlew');

const task = process.argv[2] ?? 'assembleRelease';

// A .bat file can only be spawned through a shell on Windows, and this repo
// lives under a path containing spaces, so the command has to be quoted.
const command = isWindows ? `"${wrapper}"` : wrapper;

const child = spawn(command, [task, '--no-daemon'], {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  shell: isWindows,
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nbuild-apk: gradle exited with code ${code}`);
    process.exit(code ?? 1);
  }
  if (!existsSync(APK)) {
    console.error(
      `\nbuild-apk: gradle reported success but ${APK} does not exist`,
    );
    process.exit(1);
  }
  console.log(`\nbuild-apk: ${APK}`);
});
