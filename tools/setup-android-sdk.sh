#!/usr/bin/env bash
# Installs the Android SDK (command-line tools, platform-tools, android-36 platform,
# build-tools 36.x) into $ANDROID_HOME (default /opt/android-sdk). Idempotent: re-running
# only installs what is missing. Needs a JDK 17+ on PATH (JDK 21 recommended for AGP 8.x).
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
CMDLINE_TOOLS_BUILD="${CMDLINE_TOOLS_BUILD:-16111833}"   # commandlinetools-linux-<build>_latest.zip
PLATFORM="${ANDROID_PLATFORM:-platforms;android-36}"
BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-build-tools;36.1.0}"

if ! command -v java >/dev/null 2>&1; then
  echo "error: java not found. Install a JDK 21 (e.g. apt-get install -y openjdk-21-jdk-headless)." >&2
  exit 1
fi

SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [[ ! -x "$SDKMANAGER" ]]; then
  echo "==> Installing Android command-line tools ($CMDLINE_TOOLS_BUILD) into $ANDROID_HOME"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL -o "$tmp/clt.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_BUILD}_latest.zip"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$tmp/clt.zip" -d "$tmp/x"
  else
    python3 -I -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$tmp/clt.zip" "$tmp/x"
    chmod +x "$tmp"/x/cmdline-tools/bin/*
  fi
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/x/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

# sdkmanager is a JVM tool: it honours -Dhttps.proxyHost/Port from JAVA_TOOL_OPTIONS.
# If that is not set but HTTPS_PROXY is, pass the proxy explicitly.
proxy_args=()
if [[ "${JAVA_TOOL_OPTIONS:-}" != *https.proxyHost* && -n "${HTTPS_PROXY:-${https_proxy:-}}" ]]; then
  p="${HTTPS_PROXY:-${https_proxy:-}}"; p="${p#*://}"; p="${p%/}"
  proxy_args=(--proxy=http "--proxy_host=${p%:*}" "--proxy_port=${p##*:}")
fi

echo "==> Accepting licences"
yes | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" "${proxy_args[@]}" --licenses >/dev/null || true

echo "==> Installing platform-tools, $PLATFORM, $BUILD_TOOLS"
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" "${proxy_args[@]}" \
  "platform-tools" "$PLATFORM" "$BUILD_TOOLS"

echo "==> Installed packages:"
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" "${proxy_args[@]}" --list_installed 2>/dev/null | sed -n '/Installed packages/,$p'
echo "ANDROID_HOME=$ANDROID_HOME"
