#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
OUTPUT_DIR="$PROJECT_DIR/wizard-of-iv-v2-handoff"
ZIP_FILE="$PROJECT_DIR/wizard-of-iv-v2-handoff.zip"

echo "=== Building Wizard of IV v2 Handoff Package ==="

# Clean previous output
rm -rf "$OUTPUT_DIR" "$ZIP_FILE"
mkdir -p "$OUTPUT_DIR/wordpress-plugin"
mkdir -p "$OUTPUT_DIR/embed"

# Build the wizard if dist doesn't exist
if [ ! -f "$PROJECT_DIR/dist/wizard.js" ]; then
  echo "Building wizard..."
  cd "$PROJECT_DIR"
  npm run build
fi

# Copy files
echo "Assembling package..."

# README and guides
cp "$PROJECT_DIR/handoff/README.txt" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/handoff/admin-dashboard.txt" "$OUTPUT_DIR/"

# WordPress plugin
cp "$PROJECT_DIR/wordpress/wizard-of-iv.php" "$OUTPUT_DIR/wordpress-plugin/"
cp "$PROJECT_DIR/wordpress/treatment-sync.js" "$OUTPUT_DIR/wordpress-plugin/"

# Embed files (for non-WP sites)
cp "$PROJECT_DIR/dist/wizard.js" "$OUTPUT_DIR/embed/"
cp "$PROJECT_DIR/dist/wizard.css" "$OUTPUT_DIR/embed/"
cp "$PROJECT_DIR/wordpress/treatment-sync.js" "$OUTPUT_DIR/embed/"

# Demo page
cp "$PROJECT_DIR/demo.html" "$OUTPUT_DIR/"

# Create zip
echo "Creating zip..."
cd "$PROJECT_DIR"
zip -r "$ZIP_FILE" "wizard-of-iv-v2-handoff/" -x "*.DS_Store"

# Clean up the unzipped folder
rm -rf "$OUTPUT_DIR"

echo ""
echo "=== Done ==="
echo "Handoff package: $ZIP_FILE"
echo ""
ls -lh "$ZIP_FILE"
