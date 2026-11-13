# Inside the Machine

A self-paced Windows internals learning game built with React and TypeScript.
Explore five levels through **predict → experiment → evidence → explain →
transfer**, then investigate four workstation-rescue scenarios.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Existing installations can skip
`npm install`.

```sh
npm test
npm run build
npm run lint
```

## Play

Start with **First Contact**. Each scene introduces a small concept, lets you
change a bounded model, and asks you to explain the observed mechanism with
selected evidence. A changed scenario checks that you can apply the concept,
not just repeat a button sequence.

Level 1 also includes an optional **five-minute video briefing** with original
AI-authored diagrams and synthetic narration. Select **Watch Level 1 briefing**
on the chapter overview. It includes English captions, playback-speed controls,
chapter seeking, and a transcript. Watching never awards or gates mastery.
This is a Level 1 pilot; videos for the remaining levels are not produced yet.

- 36 core scenes across operating-system foundations, execution, kernel
  coordination, memory, and I/O/security.
- Four capstone variants: waits, retained memory, delayed I/O, and access denial.
- Sequential mastery unlocks; locked briefings remain readable.
- Optional hints and deeper explanations, no timer or penalty for mistakes.
- Replay and practice reset retain mastery; the notebook collects learned
  concepts.
- First Contact also offers the original free-launch process sandbox. New
  mastery is earned through the campaign investigation, not that sandbox.

Progress is stored in this browser under `windows-internals.campaign.v1`.
Existing `windows-internals.first-contact.v1` completion is preserved.
Experiment state is deliberately reset when you leave a scene. Storage failures
show a notice; corrupt or unsupported records are not silently overwritten.
Progress is not synchronized across browsers.
If a write fails, use **Retry saving mastery** once browser storage is available.

## Models, not live Windows

All core gameplay runs in the browser on macOS, Linux, or Windows. **No VM
creation is required.** Scenes use deterministic, explicitly simplified state
graphs and prepared evidence, not a full Windows emulator or live host data.
Each scene links to Microsoft references and states its limitations.

VM setup, actual Windows tools, kernel debugging, and driver development belong
to separate optional advanced scenes. These practical labs are not implemented
or validated by this browser campaign. Never disable host protections or
experiment on production systems.

## Code organization

`src/scenes/types.ts` defines the shared content contract; `levels12.ts`,
`levels34.ts`, and `level5.ts` author the scene graphs. `sceneEngine.ts`
enforces assessment gates, `ScenePlayer.tsx` renders experiments, `progress.ts`
handles migration and unlocks, and `App.tsx` provides campaign navigation.
`simulation.ts` and `FirstContact.tsx` retain the original process sandbox.

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the curriculum, approved design,
implementation milestones, and deferred real-Windows validation.

## Rebuild the Level 1 video

The included MP4 plays cross-platform. Narration is synthesized locally with
Piper's `en_US-ljspeech-medium` voice, trained on the public-domain LJ Speech
dataset; the model repository declares MIT licensing. See
`public/media/level-1/VOICE_PROVENANCE.txt` for sources and provenance.
No paid or external AI video service is called, and no macOS System Voice
recording is included.

Use Python 3.11-3.14; ONNX Runtime currently has no Python 3.15 wheel.
Rendering requires Arial (macOS) or DejaVu Sans (Linux).

```sh
python3 -m venv .video-venv
.video-venv/bin/python -m pip install -r scripts/video/requirements.txt
.video-venv/bin/python -m piper.download_voices --download-dir .video-venv/voices en_US-ljspeech-medium
.video-venv/bin/python -m scripts.video.render --model .video-venv/voices/en_US-ljspeech-medium.onnx
PIPER_TEST_MODEL=.video-venv/voices/en_US-ljspeech-medium.onnx \
  .video-venv/bin/python -m unittest discover -s scripts/video -p 'test_*.py'
```

The single source, `src/briefing/level1.json`, supplies the narration,
transcript, chapter times, and presentation content. The renderer creates
`public/media/level-1/intro.mp4`, its poster, timed WebVTT captions, a text
transcript, and production metadata. Captions use measured sentence-audio
durations, and generation fails rather than silently cutting speech.

## Run on a Linux VM with Docker

The public image targets **linux/amd64** and serves the complete browser
campaign and Level 1 video on port **8080**. It needs no Windows guest VM,
database, or narration tools.

```sh
docker pull karunda/windowsinternals:latest
docker run -d --name windowsinternals --restart unless-stopped \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  -p 8080:8080 karunda/windowsinternals:latest
```

Open `http://YOUR_VM_IP:8080`. Allow inbound TCP 8080 in the VM's firewall
and cloud network rules. For public HTTPS, use your existing TLS reverse
proxy. Progress remains in each player's browser, not the container;
restarting or replacing the container does not erase browser mastery.

Build locally from the included sources and pre-rendered media:

```sh
docker buildx build --platform linux/amd64 --load \
  -t karunda/windowsinternals:latest .
```

The multi-stage build uses Node only to compile the static portal. Runtime
is unprivileged Nginx with a `/healthz` endpoint, SPA fallback, caption MIME
support, and video byte-range serving. Missing media and asset URLs return
404 rather than the application HTML. The allow-listed build context
excludes local environments, credentials, and unrelated files.
