# Third-party notices

CutPilot Sync is proprietary (see [LICENSE](LICENSE)), but it is built on and
distributed with third-party software. Those components are **not** covered by
that licence — each remains governed by its own terms, reproduced or linked
below.

---

## FFmpeg — GNU General Public License v3 or later

**This is the one with obligations attached, so it is listed first.**

Every official build of CutPilot Sync bundles an FFmpeg executable, supplied by
the [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static) package
(v5.3.0). The bundled Windows binary reports:

```
ffmpeg version 6.1.1-essentials_build-www.gyan.dev
configuration: --enable-gpl --enable-version3 --enable-libx264 --enable-libx265 ...
```

Because it is configured with `--enable-gpl --enable-version3`, that executable
is licensed under the **GNU General Public License, version 3 or later**, and
anyone who receives a CutPilot Sync build receives the full rights the GPL
grants over it.

**How it is used.** FFmpeg is bundled as a separate, unmodified program and run
as an external process (`child_process.execFile` / `spawn`), communicating only
through command-line arguments and pipes. None of its libraries are linked into
CutPilot Sync. See `src/main/pipeline/ffmpeg.ts`.

**Corresponding source.** The source for the bundled build is available from:

- FFmpeg upstream — <https://ffmpeg.org/download.html> and
  <https://git.ffmpeg.org/ffmpeg.git> (tag `n6.1.1`)
- The build packager — <https://www.gyan.dev/ffmpeg/builds/>
- The npm package that supplies it — <https://github.com/eugeneware/ffmpeg-static>

A copy of the corresponding source can also be requested at
cutpilotsync@gmail.com.

**Licence text.** <https://www.gnu.org/licenses/gpl-3.0.html>

FFmpeg itself incorporates further components under their own terms, including
libx264 and libx265 (GPL) and libmp3lame, libopus and libvorbis (LGPL/BSD). See
the FFmpeg project's own legal page: <https://ffmpeg.org/legal.html>

---

## Runtime and application dependencies

Permissive licences; no redistribution obligations beyond preserving the notices
in the packages themselves, which npm installs alongside each module.

| Component | Version | Licence |
|---|---|---|
| Electron | 31.7.7 | MIT |
| React | 18.3.1 | MIT |
| React DOM | 18.3.1 | MIT |
| `@anthropic-ai/sdk` | 0.98.0 | MIT |
| `@supabase/supabase-js` | 2.106.2 | MIT |
| `@radix-ui/react-progress` | 1.1.8 | MIT |
| `@radix-ui/react-slot` | 1.2.4 | MIT |
| `electron-updater` | 6.8.3 | MIT |
| `axios` | 1.16.1 | MIT |
| `form-data` | 4.0.5 | MIT |
| `clsx` | 2.1.1 | MIT |
| `tailwind-merge` | 3.6.0 | MIT |
| `lucide-react` | 1.16.0 | ISC |
| `class-variance-authority` | 0.7.1 | Apache-2.0 |
| `dotenv` | 16.6.1 | BSD-2-Clause |

Electron embeds Chromium (BSD-3-Clause and others) and Node.js (MIT); their
notices ship inside the Electron distribution.

---

## Fonts

| Font | Licence |
|---|---|
| Bebas Neue | SIL Open Font License 1.1 |
| JetBrains Mono | SIL Open Font License 1.1 |

---

## Third-party services

Used over the network at runtime, not distributed with the app. Each is governed
by its own terms, and CutPilot Sync sends them data as described in the README:

- **Deepgram** — speech-to-text — <https://deepgram.com/terms>
- **Anthropic (Claude)** — edit decisions — <https://www.anthropic.com/legal/commercial-terms>
- **Supabase** — authentication — <https://supabase.com/terms>

---

*Last reviewed: 2026-10-27. Re-check this file whenever a dependency is added
or the bundled FFmpeg build changes.*
