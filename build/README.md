# build resources

electron-builder reads packaging assets from this folder (`buildResources`).

- **`icon.png`** — add a square PNG, at least 512×512 (1024×1024 recommended).
  electron-builder derives `icon.ico` (Windows) and `icon.icns` (macOS) from it.
  A source mark is at [`../public/reconcilex.svg`](../public/reconcilex.svg) — export it to PNG.
- Optional: `entitlements.mac.plist`, `installerIcon.ico`, `background.png` (dmg).

Nothing here is required to run `npm run dev`; it only affects `npm run build`
(the `electron-builder` step).
