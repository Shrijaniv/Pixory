"""
PhotoSort — main entry point.

Mobile (Kivy):   python main.py
CLI pipeline:    python main.py --cli --folder /path/to/photos [--skip-captions]
"""

import argparse
import sys

# Register HEIC/HEIF support for Pillow (needed for iPhone photos)
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass  # pillow-heif not installed; HEIC files will be skipped

# ── CLI-only pipeline (no Kivy) ──────────────────────────────────────────────

def run_cli(folder: str, skip_captions: bool = False):
    from pathlib import Path

    from app.core.gallery_scanner import scan_gallery
    from app.core.deduplicator import remove_duplicates
    from app.core.location_clusterer import cluster_photos
    from app.core.photo_scorer import score_photos
    from app.core.photo_selector import select_photos
    from app.core.caption_generator import generate_captions
    from app.services.openai_service import OpenAIService
    from app.storage.database import Database
    from app.config.settings import OPENAI_API_KEY

    if not Path(folder).exists():
        print(f"Error: folder '{folder}' not found.")
        sys.exit(1)

    db = Database()

    print(f"\n[1/5] Scanning gallery: {folder}")
    photos = scan_gallery(folder)
    print(f"      {len(photos)} photos found")

    print(f"\n[2/5] Removing duplicates...")
    photos = remove_duplicates(photos)
    print(f"      {len(photos)} unique photos")

    print(f"\n[3/5] Clustering by location...")
    photos, cluster_names = cluster_photos(photos)
    for cid, name in cluster_names.items():
        count = sum(1 for p in photos if p.cluster_id == cid)
        print(f"      {name}: {count} photo(s)")

    print(f"\n[4/5] Scoring photo quality...")
    photos = score_photos(photos)

    print(f"\n[5/5] Selecting best photos (max 20)...")
    selected = select_photos(photos)
    print(f"      Selected {len(selected)} photos:")
    for i, p in enumerate(selected, 1):
        print(
            f"      {i:2}. {p.path.name:<40} "
            f"score={p.combined_score:.2f}  {p.place_name or 'no GPS'}"
        )

    db.upsert_photos(photos)

    if not skip_captions:
        if not OPENAI_API_KEY:
            print("\n[!] OPENAI_API_KEY not set — skipping caption generation.")
        else:
            print("\n[Bonus] Generating captions with GPT-4o Vision...")
            openai = OpenAIService()
            captions = generate_captions(selected, openai)
            print("\n── Caption Options ──────────────────────────────────────────")
            for i, cap in enumerate(captions, 1):
                print(f"\n{i}. [{cap.mood.upper()}]")
                print(f"   {cap.text}")
                print(f"   {' '.join('#' + h for h in cap.hashtags)}")

    db.close()
    return selected


# ── CLI agent pipeline ────────────────────────────────────────────────────────

def run_cli_agent(folder: str):
    from pathlib import Path
    from app.core.agent_pipeline import run_agent_pipeline
    from app.services.claude_service import ClaudeService
    from app.config.settings import ANTHROPIC_API_KEY

    if not Path(folder).exists():
        print(f"Error: folder '{folder}' not found.")
        sys.exit(1)

    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY is not set in your .env file.")
        sys.exit(1)

    print(f"\nStarting AI Agent pipeline on: {folder}")
    print("Claude will scan, inspect, and curate your photos autonomously.\n")

    service = ClaudeService(api_key=ANTHROPIC_API_KEY)

    result = run_agent_pipeline(
        folder=folder,
        claude_service=service,
        on_thinking=lambda text: print(f"\n[Claude] {text}"),
        on_progress=lambda msg: print(f"  → {msg}"),
    )

    print(f"\n── Selected {len(result.selected)} photos ──────────────────────────────")
    for i, p in enumerate(result.selected, 1):
        print(f"  {i:2}. {p.path.name}")

    if result.curation_notes:
        print(f"\n── Curation Notes ─────────────────────────────────────────────")
        print(f"  {result.curation_notes}")

    print(f"\n── Caption Options ─────────────────────────────────────────────")
    for i, cap in enumerate(result.captions, 1):
        print(f"\n{i}. [{cap.mood.upper()}]")
        print(f"   {cap.text}")
        print(f"   {' '.join('#' + h for h in cap.hashtags)}")

    return result.selected


def run_cli_openai_agent(folder: str):
    from pathlib import Path
    from app.core.openai_agent_pipeline import run_openai_agent_pipeline
    from app.services.openai_service import OpenAIService
    from app.config.settings import OPENAI_API_KEY

    if not Path(folder).exists():
        print(f"Error: folder '{folder}' not found.")
        sys.exit(1)

    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY is not set in your .env file.")
        sys.exit(1)

    print(f"\nStarting GPT-4o Agent pipeline on: {folder}")
    print("GPT-4o will scan, inspect, and curate your photos autonomously.\n")

    service = OpenAIService(api_key=OPENAI_API_KEY)

    result = run_openai_agent_pipeline(
        folder=folder,
        openai_service=service,
        on_thinking=lambda text: print(f"\n[GPT-4o] {text}"),
        on_progress=lambda msg: print(f"  → {msg}"),
    )

    print(f"\n── Selected {len(result.selected)} photos ──────────────────────────────")
    for i, p in enumerate(result.selected, 1):
        print(f"  {i:2}. {p.path.name}")

    if result.curation_notes:
        print(f"\n── Curation Notes ─────────────────────────────────────────────")
        print(f"  {result.curation_notes}")

    print(f"\n── Caption Options ─────────────────────────────────────────────")
    for i, cap in enumerate(result.captions, 1):
        print(f"\n{i}. [{cap.mood.upper()}]")
        print(f"   {cap.text}")
        print(f"   {' '.join('#' + h for h in cap.hashtags)}")

    return result.selected


# ── Kivy App ──────────────────────────────────────────────────────────────────

def run_app():
    from kivy.app import App
    from kivy.uix.screenmanager import ScreenManager, SlideTransition

    from app.screens.home_screen import HomeScreen
    from app.screens.method_screen import MethodScreen
    from app.screens.processing_screen import ProcessingScreen
    from app.screens.review_screen import ReviewScreen
    from app.screens.caption_screen import CaptionScreen
    from app.screens.publish_screen import PublishScreen
    from app.screens.history_screen import HistoryScreen

    class PhotoSortApp(App):
        def build(self):
            sm = ScreenManager(transition=SlideTransition())
            sm.add_widget(HomeScreen(name="home"))
            sm.add_widget(MethodScreen(name="method"))
            sm.add_widget(ProcessingScreen(name="processing"))
            sm.add_widget(ReviewScreen(name="review"))
            sm.add_widget(CaptionScreen(name="captions"))
            sm.add_widget(PublishScreen(name="publish"))
            sm.add_widget(HistoryScreen(name="history"))
            return sm

    PhotoSortApp().run()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PhotoSort — photo pipeline for Instagram")
    parser.add_argument("--cli", action="store_true", help="Run as CLI (no UI)")
    parser.add_argument("--folder", help="Photo folder path (CLI mode only)")
    parser.add_argument("--skip-captions", action="store_true", help="Skip caption generation")
    parser.add_argument("--agent", action="store_true", help="Use Claude agent pipeline (CLI mode only)")
    parser.add_argument("--openai-agent", action="store_true", help="Use GPT-4o agent pipeline (CLI mode only)")
    args = parser.parse_args()

    if args.cli:
        if not args.folder:
            print("Error: --folder is required in --cli mode.")
            sys.exit(1)
        if args.agent:
            run_cli_agent(args.folder)
        elif args.openai_agent:
            run_cli_openai_agent(args.folder)
        else:
            run_cli(args.folder, skip_captions=args.skip_captions)
    else:
        run_app()
