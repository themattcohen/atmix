#!/usr/bin/env python3
"""
Audio Transcription Helper
==========================
Transcribes podcast audio files using OpenAI Whisper API or local Whisper.

Usage:
    # Using OpenAI API (requires OPENAI_API_KEY)
    python transcribe_audio.py --api /path/to/audio.mp3

    # Using local Whisper (slower but free)
    python transcribe_audio.py --local /path/to/audio.mp3

    # Batch process directory
    python transcribe_audio.py --batch /path/to/audio/dir --api
"""

import os
import json
import argparse
from pathlib import Path
from datetime import datetime


def transcribe_with_api(audio_path: str, output_dir: str = "./transcripts") -> dict:
    """
    Transcribe using OpenAI Whisper API.
    Requires: pip install openai
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("OpenAI not installed. Run: pip install openai")
        return {}
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY environment variable not set")
        return {}
    
    client = OpenAI(api_key=api_key)
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"Transcribing: {audio_path}")
    
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json"
        )
    
    result = {
        "source_file": audio_path,
        "text": transcript.text,
        "duration": transcript.duration,
        "language": transcript.language,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text
            }
            for seg in transcript.segments
        ] if hasattr(transcript, 'segments') else [],
        "transcribed_at": datetime.now().isoformat()
    }
    
    # Save transcript
    base_name = Path(audio_path).stem
    output_path = Path(output_dir) / f"{base_name}_transcript.json"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Saved: {output_path}")
    print(f"Duration: {result['duration']:.1f}s, Words: {len(result['text'].split())}")
    
    return result


def transcribe_with_local_whisper(audio_path: str, output_dir: str = "./transcripts", model_size: str = "base") -> dict:
    """
    Transcribe using local Whisper model.
    Requires: pip install openai-whisper
    
    Model sizes: tiny, base, small, medium, large
    - tiny: fastest, least accurate
    - base: good balance (recommended)
    - small: better accuracy
    - medium: high accuracy
    - large: best accuracy, slowest, needs GPU
    """
    try:
        import whisper
    except ImportError:
        print("Whisper not installed. Run: pip install openai-whisper")
        return {}
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"Loading Whisper model: {model_size}")
    model = whisper.load_model(model_size)
    
    print(f"Transcribing: {audio_path}")
    result = model.transcribe(audio_path, verbose=True)
    
    output = {
        "source_file": audio_path,
        "text": result["text"],
        "language": result["language"],
        "segments": [
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"]
            }
            for seg in result["segments"]
        ],
        "model": model_size,
        "transcribed_at": datetime.now().isoformat()
    }
    
    # Save transcript
    base_name = Path(audio_path).stem
    output_path = Path(output_dir) / f"{base_name}_transcript.json"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Saved: {output_path}")
    print(f"Words: {len(output['text'].split())}")
    
    return output


def download_podcast_audio(url: str, output_dir: str = "./audio") -> str:
    """
    Download audio from podcast URL using yt-dlp.
    Works with YouTube, Spotify embeds, direct MP3 links, etc.
    """
    import subprocess
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading: {url}")
    
    result = subprocess.run([
        "yt-dlp",
        "-x",  # Extract audio
        "--audio-format", "mp3",
        "--audio-quality", "0",  # Best quality
        "-o", f"{output_dir}/%(title)s.%(ext)s",
        url
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error downloading: {result.stderr}")
        return ""
    
    # Find the downloaded file
    for f in Path(output_dir).glob("*.mp3"):
        if f.stat().st_mtime > datetime.now().timestamp() - 60:
            return str(f)
    
    return ""


def batch_transcribe(
    audio_dir: str,
    output_dir: str = "./transcripts",
    use_api: bool = True,
    model_size: str = "base"
) -> list[dict]:
    """
    Batch transcribe all audio files in a directory.
    """
    results = []
    audio_extensions = {'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.webm'}
    
    audio_files = [
        f for f in Path(audio_dir).iterdir()
        if f.suffix.lower() in audio_extensions
    ]
    
    print(f"Found {len(audio_files)} audio files")
    
    for i, audio_file in enumerate(audio_files):
        print(f"\n[{i+1}/{len(audio_files)}] {audio_file.name}")
        
        if use_api:
            result = transcribe_with_api(str(audio_file), output_dir)
        else:
            result = transcribe_with_local_whisper(str(audio_file), output_dir, model_size)
        
        if result:
            results.append(result)
    
    # Save combined results
    combined_path = Path(output_dir) / "all_transcripts.json"
    with open(combined_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\nCompleted {len(results)} transcriptions")
    print(f"Combined file: {combined_path}")
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio files using Whisper"
    )
    
    parser.add_argument('audio', nargs='?', help='Audio file or directory path')
    parser.add_argument('--api', action='store_true', help='Use OpenAI Whisper API')
    parser.add_argument('--local', action='store_true', help='Use local Whisper model')
    parser.add_argument('--batch', action='store_true', help='Process directory of files')
    parser.add_argument('--model', default='base', 
                        choices=['tiny', 'base', 'small', 'medium', 'large'],
                        help='Whisper model size for local transcription')
    parser.add_argument('--output', default='./transcripts', help='Output directory')
    parser.add_argument('--download', type=str, help='Download audio from URL first')
    
    args = parser.parse_args()
    
    # Download if URL provided
    if args.download:
        audio_path = download_podcast_audio(args.download)
        if not audio_path:
            return
        args.audio = audio_path
    
    if not args.audio:
        parser.print_help()
        return
    
    # Determine transcription method
    use_api = args.api or (not args.local)
    
    if args.batch or Path(args.audio).is_dir():
        batch_transcribe(args.audio, args.output, use_api, args.model)
    else:
        if use_api:
            transcribe_with_api(args.audio, args.output)
        else:
            transcribe_with_local_whisper(args.audio, args.output, args.model)


if __name__ == "__main__":
    main()
