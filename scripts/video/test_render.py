import importlib.util
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("video_render", Path(__file__).with_name("render.py"))
render = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(render)


class VideoBriefingTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("PIPER_TEST_MODEL"), "Set PIPER_TEST_MODEL for real narration integration.")
    def test_piper_narration_renders_video_and_records_actual_model_provenance(self):
        model = Path(os.environ["PIPER_TEST_MODEL"])
        briefing = json.loads((ROOT / "src/briefing/level1.json").read_text())
        briefing["chapters"] = briefing["chapters"][:1]
        briefing["chapters"][0]["narration"] = ["A program.", "A process.", "A thread."]
        briefing["durationSeconds"] = 5
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "source.json"
            source.write_text(json.dumps(briefing))
            output = directory / "output"
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("render.py")),
                 "--source", str(source), "--output", str(output), "--model", str(model)],
                text=True, capture_output=True, timeout=120,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            production = json.loads((output / "production.json").read_text())
            self.assertEqual(production["voiceModelSha256"], hashlib.sha256(model.read_bytes()).hexdigest())
            self.assertGreater((output / "intro.mp4").stat().st_size, 1000)
            captions = (output / "captions.vtt").read_text()
            self.assertIn("A program.", captions)
            self.assertEqual(captions.count(" --> "), 3)

    def test_caption_times_roll_over_after_rounding(self):
        self.assertEqual(render.caption_timestamp(59.9996), "00:01:00.000")
        self.assertEqual(render.caption_timestamp(300), "00:05:00.000")
        with self.assertRaises(ValueError):
            render.caption_timestamp(-1)

    def test_cues_follow_measured_sentence_audio_without_crossing_chapters(self):
        cues = render.make_caption_cues(25, ["First.", "Second.", "Third."], [2, 3, 4], 25)
        self.assertEqual([(cue["start"], cue["end"]) for cue in cues], [(25.5, 27.5), (27.7, 30.7), (30.9, 34.9)])
        vtt = render.write_vtt(cues)
        self.assertTrue(vtt.startswith("WEBVTT\n"))
        self.assertIn("00:00:25.500 --> 00:00:27.500", vtt)
        self.assertIn("Third.", vtt)
        with self.assertRaises(ValueError):
            render.make_caption_cues(25, ["Too long."], [30], 25)

    def test_invalid_timing_and_empty_narration_are_rejected(self):
        briefing = json.loads((ROOT / "src/briefing/level1.json").read_text())
        render.validate_briefing(briefing)
        briefing["chapters"][1]["startSeconds"] = 0
        with self.assertRaises(ValueError):
            render.validate_briefing(briefing)
        briefing = json.loads((ROOT / "src/briefing/level1.json").read_text())
        briefing["chapters"][0]["narration"][0] = ""
        with self.assertRaises(ValueError):
            render.validate_briefing(briefing)

    def test_slide_renderer_handles_each_actual_diagram_without_missing_visuals(self):
        briefing = json.loads((ROOT / "src/briefing/level1.json").read_text())
        for index, chapter in enumerate(briefing["chapters"]):
            image = render.render_slide(briefing, chapter, index, 1)
            self.assertEqual(image.size, (1280, 720))
            self.assertGreater(len(image.getcolors(2_000_000)), 100)
        chapter = {**briefing["chapters"][0], "diagram": "unsupported"}
        with self.assertRaises(ValueError):
            render.render_slide(briefing, chapter, 0, 1)


if __name__ == "__main__":
    unittest.main()
