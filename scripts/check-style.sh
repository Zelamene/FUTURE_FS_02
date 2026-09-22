#!/usr/bin/env bash
# Mechanical style enforcement for Phase 6.
# brand-style.html remains the single source of truth; this script only
# catches the mechanical violations that grep can find.
# Run manually before each commit. Not wired into a git hook.
set -e
FAIL=0

PATTERNS=(
  'bg-gradient-'
  'from-purple-|to-purple-|via-purple-'
  'from-violet-|from-indigo-|from-fuchsia-'
  'bg-clip-text'
  'backdrop-blur-'
  'shadow-xl|shadow-2xl'
  'rounded-2xl|rounded-3xl'
  'animate-bounce|animate-ping'
  'hover:scale-|hover:-translate-y-|hover:rotate-'
  'duration-500|duration-700|duration-1000'
)

for p in "${PATTERNS[@]}"; do
  if grep -rEn "$p" client/src/; then
    echo "Banned pattern: $p"
    FAIL=1
  fi
done

if grep -rEn 'logo-spin' client/src/ --include='*.css' --include='*.tsx' --include='*.ts' --include='*.html'; then
  echo "Vite template remnants found"
  FAIL=1
fi

# CSS-only: the JS matchMedia("(prefers-color-scheme…)") API in useTheme.ts
# is legitimate and excluded by scoping to *.css.
if grep -rEn '@media \(prefers-color-scheme' client/src/ --include='*.css'; then
  echo "Vite template CSS remnants found"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "Style check passed."
fi

exit $FAIL
