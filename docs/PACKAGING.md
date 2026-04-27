# Windows Packaging Plan

## Development

```powershell
npm install
npm run dev
```

## Production Build

```powershell
npm run build
npm run package:win
```

`package:win` uses electron-builder with an NSIS installer. The installer is configured for:

- Assisted install flow.
- User-selectable installation directory.
- Desktop and Start Menu shortcuts.
- `.brain` file association.
- Bundled schema resources.
- AESCION launcher icon from `src/ic_launcher.png` and `build/icon.ico`.

The starter disables executable signing/editing for unsigned local packaging because this workspace does not include a code-signing certificate. For commercial release builds, set `win.signAndEditExecutable` back to `true`, provide a valid Windows code-signing certificate, and run the release build from an environment that can create the helper symlinks electron-builder needs.

## Release Hardening

- Replace the development icon with final signed brand assets when marketing is ready.
- Add code signing certificate and `CSC_LINK` / `CSC_KEY_PASSWORD`.
- Add update feed after signing is in place.
- Add migration smoke tests before packaging.
- Verify install, uninstall, file association, and vault recovery on a clean Windows VM.
