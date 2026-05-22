#!/usr/bin/env bash
# Fetch Noto Sans + Noto Sans Ethiopic TTFs into app/assets/fonts/.
# Run once locally (`bash backend/scripts/download_fonts.sh`) or during a
# Docker build (see Dockerfile). Skips fonts that are already present.
#
# Source: https://github.com/notofonts/notofonts.github.io  (SIL OFL)

set -euo pipefail

DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/app/assets/fonts"
mkdir -p "$DEST_DIR"

BASE="https://github.com/notofonts/notofonts.github.io/raw/main/fonts"

declare -a FONTS=(
  "NotoSans/hinted/ttf/NotoSans-Regular.ttf"
  "NotoSans/hinted/ttf/NotoSans-Bold.ttf"
  "NotoSansEthiopic/hinted/ttf/NotoSansEthiopic-Regular.ttf"
  "NotoSansEthiopic/hinted/ttf/NotoSansEthiopic-Bold.ttf"
)

for path in "${FONTS[@]}"; do
  name="$(basename "$path")"
  out="$DEST_DIR/$name"
  if [[ -s "$out" ]]; then
    echo "skip  $name (already present)"
    continue
  fi
  echo "fetch $name"
  curl -fsSL --retry 3 --retry-delay 2 -o "$out" "$BASE/$path"
done

echo "done. Fonts at: $DEST_DIR"
