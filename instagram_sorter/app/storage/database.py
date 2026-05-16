import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from app.models.caption import Caption
from app.models.photo import Photo
from app.models.post_draft import PostDraft

DB_PATH = Path.home() / ".instagram_sorter" / "data.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS photos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    path              TEXT UNIQUE NOT NULL,
    date              TEXT,
    lat               REAL,
    lon               REAL,
    cluster_id        INTEGER,
    place_name        TEXT,
    phash             TEXT,
    sharpness_score   REAL DEFAULT 0,
    lighting_score    REAL DEFAULT 0,
    composition_score REAL DEFAULT 0,
    combined_score    REAL DEFAULT 0,
    width             INTEGER DEFAULT 0,
    height            INTEGER DEFAULT 0,
    file_size         INTEGER DEFAULT 0,
    selected          INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_drafts (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_paths_json     TEXT NOT NULL,
    caption_text         TEXT,
    caption_mood         TEXT,
    caption_hashtags_json TEXT DEFAULT '[]',
    status               TEXT DEFAULT 'draft',
    instagram_post_id    TEXT,
    created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
    published_at         TEXT
);
"""


class Database:
    def __init__(self, db_path: Path = DB_PATH):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    # ------------------------------------------------------------------
    # Photos
    # ------------------------------------------------------------------

    def upsert_photo(self, photo: Photo):
        self.conn.execute(
            """
            INSERT INTO photos (
                path, date, lat, lon, cluster_id, place_name, phash,
                sharpness_score, lighting_score, composition_score, combined_score,
                width, height, file_size, selected
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                date              = excluded.date,
                lat               = excluded.lat,
                lon               = excluded.lon,
                cluster_id        = excluded.cluster_id,
                place_name        = excluded.place_name,
                phash             = excluded.phash,
                sharpness_score   = excluded.sharpness_score,
                lighting_score    = excluded.lighting_score,
                composition_score = excluded.composition_score,
                combined_score    = excluded.combined_score,
                width             = excluded.width,
                height            = excluded.height,
                file_size         = excluded.file_size,
                selected          = excluded.selected
            """,
            (
                str(photo.path),
                photo.date.isoformat() if photo.date else None,
                photo.lat,
                photo.lon,
                photo.cluster_id,
                photo.place_name,
                photo.phash,
                photo.sharpness_score,
                photo.lighting_score,
                photo.composition_score,
                photo.combined_score,
                photo.width,
                photo.height,
                photo.file_size,
                int(photo.selected),
            ),
        )
        self.conn.commit()

    def upsert_photos(self, photos: List[Photo]):
        for photo in photos:
            self.upsert_photo(photo)

    def get_cached_photo(self, path: Path) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM photos WHERE path = ?", (str(path),)
        ).fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------
    # Post Drafts
    # ------------------------------------------------------------------

    def save_draft(self, draft: PostDraft) -> int:
        cursor = self.conn.execute(
            """
            INSERT INTO post_drafts (
                photo_paths_json, caption_text, caption_mood,
                caption_hashtags_json, status
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (
                json.dumps([str(p.path) for p in draft.photos]),
                draft.caption.text if draft.caption else None,
                draft.caption.mood if draft.caption else None,
                json.dumps(draft.caption.hashtags) if draft.caption else "[]",
                draft.status,
            ),
        )
        self.conn.commit()
        return cursor.lastrowid

    def update_draft_status(
        self,
        draft_id: int,
        status: str,
        instagram_post_id: str = None,
    ):
        published_at = datetime.now().isoformat() if status == "published" else None
        self.conn.execute(
            """
            UPDATE post_drafts
            SET status = ?, instagram_post_id = ?, published_at = ?
            WHERE id = ?
            """,
            (status, instagram_post_id, published_at, draft_id),
        )
        self.conn.commit()

    def get_all_drafts(self) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM post_drafts ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_draft(self, draft_id: int) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM post_drafts WHERE id = ?", (draft_id,)
        ).fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self):
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
