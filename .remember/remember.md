# Handoff

## State
- All changes local, NOT yet committed/tagged. Pending release as v0.0.8 (or higher — check package.json).
- Major work this session: visual design uplift (index.css glows/shimmer/breathe, Onboarding 2-col layout, header redesign), macOS traffic light padding fix (App.tsx `isMac`), delete-account fetch fix (no Supabase WS), dev protocol handler fix (`app.getAppPath()`), FFmpeg bundled via `ffmpeg-static` + `asarUnpack`, UX improvements (dynamic CTA text, FFmpeg banner, loading state, prefers-reduced-motion).
- Key files changed: `src/renderer/src/App.tsx`, `src/renderer/src/index.css`, `src/renderer/src/components/Onboarding/Onboarding.tsx`, `src/renderer/src/components/StepUpload/StepUpload.tsx`, `src/renderer/src/components/StepDone/StepDone.tsx`, `src/renderer/src/components/StepProcess/StepProcess.tsx`, `src/main/index.ts`, `src/main/pipeline/ffmpeg.ts` (new), `src/main/pipeline/transcribe.ts`, `src/main/pipeline/render.ts`, `src/renderer/src/i18n/pt.ts`, `package.json`.

## Next
1. Commit all pending changes and release (bump version in package.json if needed, `git tag vX.X.X && git push origin main --tags`)
2. Build landing page in new repo `cutpilot-sync-website` (Netlify, single page, GitHub API for dynamic download links)
3. Update GitHub Secrets with prod Supabase keys if not done yet

## Context
- `ffmpeg-static` adds ~65MB to installer — expected and acceptable.
- macOS Gatekeeper: only `xattr -cr /Applications/CutPilot\ Sync.app` works for unsigned app; document on landing page.
- Apple Developer cert ($99/yr) needed for seamless macOS install — deferred by user.
- Onboarding is 2-col layout (title left, steps right), fluid width with `clamp()` font sizing.
