#!/usr/bin/env bash
# Builds an Android debug APK and copies it to dist-apk/marchia-debug-<git short sha>.apk.
# Usage: bash tools/build-apk.sh [--skip-web]
#   --skip-web  do not run `npm run build`; package whatever is already in dist/.
# Needs: JDK 21, Android SDK in $ANDROID_HOME (default /opt/android-sdk;
#        install with `npm run setup:android`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SKIP_WEB=0
for arg in "$@"; do
  case "$arg" in
    --skip-web) SKIP_WEB=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "error: Android SDK not found in $ANDROID_HOME — run: npm run setup:android" >&2
  exit 1
fi

if [[ $SKIP_WEB -eq 0 ]]; then
  echo "==> npm run build"
  npm run build
fi
if [[ ! -f dist/index.html ]]; then
  echo "error: dist/index.html missing — build the web app first (or drop --skip-web)" >&2
  exit 1
fi

echo "==> npx cap sync android"
npx cap sync android

echo "==> gradlew assembleDebug"
# First run downloads AGP + deps; Maven Central sometimes answers 429, so retry.
for attempt in 1 2 3; do
  if (cd android && ./gradlew --no-daemon assembleDebug); then break; fi
  if [[ $attempt -eq 3 ]]; then echo "error: gradle build failed" >&2; exit 1; fi
  echo "==> gradle failed (attempt $attempt), retrying in 20 s"; sleep 20
done

SRC="android/app/build/outputs/apk/debug/app-debug.apk"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
mkdir -p dist-apk
OUT="dist-apk/marchia-debug-${SHA}.apk"
cp "$SRC" "$OUT"
echo "==> APK: $ROOT/$OUT ($(du -h "$OUT" | cut -f1))"
