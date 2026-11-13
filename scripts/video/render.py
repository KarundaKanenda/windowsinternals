"""Render the authored Level 1 briefing locally; no external generation service."""

import argparse
import hashlib
import html
import json
from pathlib import Path
import subprocess
import tempfile
import textwrap
import wave

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
from piper import PiperVoice


ROOT = Path(__file__).resolve().parents[2]
SAMPLE_RATE = 24000
WIDTH, HEIGHT = 1280, 720
DIAGRAMS = {"overview", "program", "processes", "container", "threads", "cpu",
            "address", "isolation", "boundary", "architecture", "loop", "goals"}
BG, CARD, INK, MUTED, MINT = "#152637", "#213b4f", "#f3f8fb", "#a7bdcb", "#80dfc6"


def validate_briefing(briefing):
    chapters = briefing["chapters"]
    if not chapters or briefing["durationSeconds"] <= 0 or chapters[0]["startSeconds"] != 0:
        raise ValueError("A briefing must start at zero and have a positive duration.")
    starts = [chapter["startSeconds"] for chapter in chapters] + [briefing["durationSeconds"]]
    if any(right <= left for left, right in zip(starts, starts[1:])):
        raise ValueError("Chapter times must increase and stay inside the video.")
    for chapter in chapters:
        if chapter["diagram"] not in DIAGRAMS or len(chapter["labels"]) != 3:
            raise ValueError("Each chapter requires a supported diagram and three labels.")
        if len(chapter["narration"]) != 3 or any(not sentence.strip() for sentence in chapter["narration"]):
            raise ValueError("Each three-stage diagram requires three nonempty narration sentences.")


def caption_timestamp(seconds):
    if seconds < 0:
        raise ValueError("Caption time cannot be negative.")
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}"


def make_caption_cues(chapter_start, sentences, durations, slide_duration):
    if len(sentences) != len(durations) or any(duration <= 0 for duration in durations):
        raise ValueError("Every sentence requires a measured positive audio duration.")
    cursor = chapter_start + 0.5
    cues = []
    for sentence, duration in zip(sentences, durations):
        end = round(cursor + duration, 6)
        if end > chapter_start + slide_duration:
            raise ValueError("Narration crosses its chapter boundary; shorten or retime it.")
        cues.append({"start": round(cursor, 6), "end": end, "text": sentence})
        cursor = round(end + 0.2, 6)
    return cues


def write_vtt(cues):
    lines = ["WEBVTT", ""]
    for index, cue in enumerate(cues, 1):
        lines.extend([str(index), f'{caption_timestamp(cue["start"])} --> {caption_timestamp(cue["end"])}',
                      textwrap.fill(html.escape(cue["text"], quote=False), width=68), ""])
    return "\n".join(lines)


def font(size, bold=False):
    candidates = (
        ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold else
        ["/System/Library/Fonts/Supplemental/Arial.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    path = next((path for path in candidates if Path(path).is_file()), None)
    if path is None:
        raise FileNotFoundError("Install Arial or DejaVu Sans to render the briefing.")
    return ImageFont.truetype(path, size)


def text(draw, position, value, size=24, color=INK, width=1100, bold=False):
    face = font(size, bold)
    x, y = position
    lines, current = [], ""
    for word in value.split():
        trial = f"{current} {word}".strip()
        if current and draw.textlength(trial, font=face) > width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    for line in lines:
        draw.text((x, y), line, font=face, fill=color)
        y += size + 7
    return y


def box(draw, bounds, label, active=False, number=None):
    x, y, right, bottom = bounds
    draw.rounded_rectangle(bounds, radius=18, fill="#294f59" if active else CARD,
                           outline=MINT if active else "#3b5668", width=3 if active else 2)
    top = y + 21
    if number is not None:
        draw.ellipse((x + 22, top, x + 55, top + 33), fill=MINT if active else "#39576c")
        text(draw, (x + 32, top + 5), str(number), 17, BG if active else INK)
        top += 48
    text(draw, (x + 23, top), label, 24, INK, right - x - 46, True)


def connector(draw, start, end):
    draw.line((start, end), fill=MINT, width=3)
    x, y = end
    if end[0] > start[0]:
        draw.polygon([(x, y), (x - 10, y - 6), (x - 10, y + 6)], fill=MINT)
    else:
        draw.polygon([(x, y), (x - 6, y - 10), (x + 6, y - 10)], fill=MINT)


def render_slide(briefing, chapter, index, active):
    kind = chapter["diagram"]
    if kind not in DIAGRAMS:
        raise ValueError(f"Unsupported diagram: {kind}")
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    for x in range(40, WIDTH, 40):
        draw.line((x, 230, x, 515), fill="#1a3042")
    text(draw, (65, 38), f'INSIDE THE MACHINE  /  LEVEL {briefing["level"]:02}', 19, MINT, bold=True)
    text(draw, (65, 91), chapter["title"], 45, width=1140, bold=True)
    text(draw, (65, 202), "A small model. An observable result. A mechanism you can explain.", 21, MUTED)
    labels = chapter["labels"]

    if kind == "processes":
        box(draw, (435, 250, 845, 335), labels[0], active == 0)
        draw.line((640, 335, 640, 365), fill=MINT, width=3)
        draw.line((320, 365, 960, 365), fill=MINT, width=3)
        connector(draw, (320, 365), (320, 390))
        connector(draw, (960, 365), (960, 390))
        box(draw, (105, 390, 535, 505), labels[1], active == 1)
        box(draw, (745, 390, 1175, 505), labels[2], active == 2)
    elif kind in {"container", "threads"}:
        draw.rounded_rectangle((65, 250, 1215, 515), radius=24, fill="#1b3245",
                               outline=MINT if active == 2 else "#446376", width=2)
        outer = labels[2] if kind == "threads" else "One process: context and resource ownership"
        text(draw, (95, 271), outer, 24, MINT, bold=True)
        if kind == "threads":
            for i, x in enumerate([105, 680]):
                box(draw, (x, 335, x + 495, 475), labels[i], active == i, i + 1)
        else:
            for i, x in enumerate([90, 475, 860]):
                box(draw, (x, 335, x + 330, 475), labels[i], active == i)
    elif kind in {"address", "isolation"}:
        for i, x in enumerate([80, 690]):
            box(draw, (x, 255, x + 510, 355), labels[i], active == i)
            connector(draw, (x + 255, 355), (x + 255, 395))
            box(draw, (x + 100, 395, x + 410, 465), f'Draft {"A" if i == 0 else "B"}: separate backing', active == i)
        text(draw, (155, 485), labels[2], 23, MINT if active == 2 else MUTED, bold=True)
    elif kind == "architecture":
        for i, y in enumerate([245, 340, 435]):
            box(draw, (215, y, 1065, y + 72), labels[i], active == i)
            if i < 2:
                draw.line((640, y + 74, 640, y + 94), fill=MUTED, width=3)
    else:
        for i, x in enumerate([65, 460, 855]):
            box(draw, (x, 285, x + 360, 460), labels[i], active == i, i + 1)
            if i < 2 and kind not in {"program", "goals"}:
                connector(draw, (x + 362, 370), (x + 390, 370))
        if kind == "cpu":
            text(draw, (150, 488), "One logical processor  /  waiting needs an event or resource", 23, MINT)
        elif kind == "boundary":
            text(draw, (230, 488), "Selected service path  /  same calling process and thread", 23, MINT)
        elif kind == "loop":
            text(draw, (245, 488), "New conditions test understanding, not repeated clicks.", 23, MINT)

    text(draw, (65, 546), chapter["takeaway"], 24, MINT, width=1150, bold=True)
    draw.rounded_rectangle((65, 682, 1215, 687), radius=2, fill="#385064")
    progress = (index + (active + 1) / 3) / len(briefing["chapters"])
    draw.rounded_rectangle((65, 682, 65 + 1150 * progress, 687), radius=2, fill=MINT)
    text(draw, (65, 695), "AI-authored teaching illustrations / synthetic narration / not live Windows", 13, MUTED)
    text(draw, (1100, 695), f'{index + 1:02} / {len(briefing["chapters"]):02}', 13, MUTED)
    return image


def run(command):
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f'Command failed ({result.returncode}): {command[0]}\n{result.stderr}')


def read_wave(path):
    with wave.open(str(path), "rb") as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 2, SAMPLE_RATE):
            raise ValueError("Narration must be mono 16-bit PCM at 24 kHz.")
        return audio.readframes(audio.getnframes())


def render(briefing_path, output, model):
    briefing = json.loads(briefing_path.read_text())
    validate_briefing(briefing)
    voice = PiperVoice.load(model)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="inside-machine-video-") as temporary:
        work = Path(temporary)
        frames, cues = [], []
        with wave.open(str(work / "narration.wav"), "wb") as combined:
            combined.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
            for index, chapter in enumerate(briefing["chapters"]):
                start = chapter["startSeconds"]
                next_start = (briefing["chapters"][index + 1]["startSeconds"]
                              if index + 1 < len(briefing["chapters"]) else briefing["durationSeconds"])
                duration = next_start - start
                sentence_paths, sentence_audio = [], []
                for sentence_index, sentence in enumerate(chapter["narration"]):
                    stem = work / f"voice-{index}-{sentence_index}"
                    with wave.open(str(stem.with_suffix(".source.wav")), "wb") as audio:
                        voice.synthesize_wav(sentence, audio)
                    path = stem.with_suffix(".wav")
                    run([ffmpeg, "-v", "error", "-y", "-i", str(stem.with_suffix(".source.wav")),
                         "-ar", str(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_s16le", str(path)])
                    sentence_paths.append(path)
                    sentence_audio.append(read_wave(path))
                speech_seconds = sum(len(audio) / (2 * SAMPLE_RATE) for audio in sentence_audio)
                available = duration - 0.6 - 0.2 * (len(sentence_audio) - 1)
                tempo = max(1, speech_seconds / available)
                if tempo > 1.25:
                    raise ValueError(f'Chapter "{chapter["title"]}" has {speech_seconds:.1f}s of speech for '
                                     f'{available:.1f}s available; shorten its narration.')
                if tempo > 1:
                    sentence_audio = []
                    for path in sentence_paths:
                        adjusted = path.with_name(f"{path.stem}-fit.wav")
                        run([ffmpeg, "-v", "error", "-y", "-i", str(path), "-af", f"atempo={tempo:.8f}",
                             "-ar", str(SAMPLE_RATE), str(adjusted)])
                        sentence_audio.append(read_wave(adjusted))
                measured = [len(audio) / (2 * SAMPLE_RATE) for audio in sentence_audio]
                chapter_cues = make_caption_cues(start, chapter["narration"], measured, duration)
                cues.extend(chapter_cues)
                audio = b"\0" * SAMPLE_RATE
                for sentence_index, sentence in enumerate(sentence_audio):
                    if sentence_index:
                        audio += b"\0" * round(0.2 * SAMPLE_RATE) * 2
                    audio += sentence
                remaining = round(duration * SAMPLE_RATE) - len(audio) // 2
                if remaining < 0:
                    raise ValueError("Narration does not fit; no speech has been silently truncated.")
                combined.writeframes(audio + b"\0" * remaining * 2)

                boundaries = [0, chapter_cues[0]["end"] - start + 0.1,
                              chapter_cues[1]["end"] - start + 0.1, duration]
                for active in range(3):
                    path = work / f"slide-{index}-{active}.png"
                    render_slide(briefing, chapter, index, active).save(path)
                    frames.extend([f"file '{path}'", f"duration {boundaries[active + 1] - boundaries[active]:.6f}"])
                print(f'Prepared {index + 1}/{len(briefing["chapters"])}: {chapter["title"]}', flush=True)
        last_frame = work / f"slide-{len(briefing['chapters']) - 1}-2.png"
        frames.append(f"file '{last_frame}'")
        (work / "frames.txt").write_text("\n".join(frames))
        run([ffmpeg, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(work / "frames.txt"),
             "-i", str(work / "narration.wav"), "-vf", "fps=12,format=yuv420p",
             "-c:v", "libx264", "-profile:v", "main", "-preset", "veryfast", "-crf", "22",
             "-c:a", "aac", "-b:a", "96k", "-t", str(briefing["durationSeconds"]),
             "-movflags", "+faststart", str(work / "intro.mp4")])
        render_slide(briefing, briefing["chapters"][0], 0, 0).save(work / "poster.jpg", quality=90)
        (work / "captions.vtt").write_text(write_vtt(cues))
        transcript = [briefing["title"], briefing["production"], ""]
        for chapter in briefing["chapters"]:
            transcript.extend([f'{caption_timestamp(chapter["startSeconds"])[:8]}  {chapter["title"]}',
                               " ".join(chapter["narration"]), ""])
        transcript.extend(["References"] + [f'{source["label"]}: {source["url"]}' for source in briefing["sources"]])
        (work / "transcript.txt").write_text("\n".join(transcript))
        (work / "production.json").write_text(json.dumps({
            "sourceSha256": hashlib.sha256(briefing_path.read_bytes()).hexdigest(),
            "durationSeconds": briefing["durationSeconds"], "width": WIDTH, "height": HEIGHT,
            "voice": model.stem, "voiceEngine": "Piper",
            "voiceModelSha256": hashlib.sha256(model.read_bytes()).hexdigest(),
            "captionCues": len(cues),
            "production": briefing["production"],
        }, indent=2) + "\n")
        for filename in ["intro.mp4", "poster.jpg", "captions.vtt", "transcript.txt", "production.json"]:
            (work / filename).replace(output / filename)
    print(f'Rendered {briefing["durationSeconds"]} seconds at {output}', flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "src/briefing/level1.json")
    parser.add_argument("--output", type=Path, default=ROOT / "public/media/level-1")
    parser.add_argument("--model", type=Path, required=True, help="Path to a licensed Piper ONNX voice and adjacent JSON config.")
    args = parser.parse_args()
    render(args.source, args.output, args.model)
