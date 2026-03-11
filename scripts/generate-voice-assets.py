import argparse
import asyncio
from pathlib import Path

import edge_tts
from edge_tts.exceptions import NoAudioReceived
import yaml


ZH_FALLBACK_VOICES = [
    "en-US-AvaMultilingualNeural",
    "en-US-EmmaMultilingualNeural",
]


def build_voice_candidates(configured_voice: str, language: str | None) -> list[str]:
    candidates = [configured_voice]
    if (language or "").lower().startswith("chinese") or configured_voice.lower().startswith("zh-"):
        for voice in ZH_FALLBACK_VOICES:
            if voice not in candidates:
                candidates.append(voice)
    return candidates


async def save_with_edge_tts(text: str, voice: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    await edge_tts.Communicate(text=text, voice=voice).save(str(output_path))


def generate_voice_asset(text: str, voices: list[str], output_path: Path) -> str:
    last_error: Exception | None = None
    for voice in voices:
        try:
            asyncio.run(save_with_edge_tts(text, voice, output_path))
            return voice
        except NoAudioReceived as exc:
            last_error = exc
            if output_path.exists():
                output_path.unlink()
            continue
    if last_error is not None:
        raise last_error
    raise RuntimeError("No candidate voices were provided for edge-tts generation.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate psyflow-style voice assets for an H task from config/config.yaml using edge-tts."
    )
    parser.add_argument("task_dir", help="Path to the H task directory, e.g. H000006-mid")
    parser.add_argument(
        "--labels",
        nargs="+",
        default=["instruction_text"],
        help="Stimulus labels to convert to voice assets."
    )
    parser.add_argument("--voice", help="Override configured edge-tts voice name.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing MP3 assets.")
    args = parser.parse_args()

    task_dir = Path(args.task_dir).resolve()
    config_path = task_dir / "config" / "config.yaml"
    if not config_path.is_file():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    stimuli = config.get("stimuli", {})
    task_config = config.get("task", {})
    configured_voice = str(args.voice or task_config.get("voice_name") or "en-US-AvaMultilingualNeural")
    language = str(task_config.get("language") or "")
    voices = build_voice_candidates(configured_voice, language)

    for label in args.labels:
        stim = stimuli.get(label)
        if not isinstance(stim, dict) or not isinstance(stim.get("text"), str):
            raise ValueError(f"Stimulus '{label}' is missing or has no text field in {config_path}.")
        output_path = task_dir / "assets" / f"{label}_voice.mp3"
        if output_path.exists() and not args.overwrite:
            continue
        used_voice = generate_voice_asset(stim["text"], voices, output_path)
        print(f"{label}: {used_voice} -> {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
