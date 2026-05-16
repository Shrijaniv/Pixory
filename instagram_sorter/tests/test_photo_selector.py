"""Tests for the photo selection / diversity algorithm."""
from datetime import datetime
from pathlib import Path

import pytest

from app.models.photo import Photo
from app.core.photo_selector import select_photos


def _make_photo(name: str, cluster_id: int = 0, score: float = 0.5) -> Photo:
    p = Photo(path=Path(f"/fake/{name}.jpg"), cluster_id=cluster_id)
    p.combined_score = score
    p.date = datetime(2024, 1, 1)
    return p


class TestSelectPhotos:
    def test_respects_max_count(self):
        photos = [_make_photo(f"p{i}", cluster_id=0) for i in range(30)]
        result = select_photos(photos, max_count=20)
        assert len(result) <= 20

    def test_selects_all_when_fewer_than_max(self):
        photos = [_make_photo(f"p{i}", cluster_id=0) for i in range(5)]
        result = select_photos(photos, max_count=20)
        assert len(result) == 5

    def test_covers_all_clusters(self):
        photos = (
            [_make_photo(f"a{i}", cluster_id=0, score=0.9) for i in range(10)]
            + [_make_photo(f"b{i}", cluster_id=1, score=0.9) for i in range(10)]
            + [_make_photo(f"c{i}", cluster_id=2, score=0.9) for i in range(10)]
        )
        result = select_photos(photos, max_count=9)

        selected_clusters = {p.cluster_id for p in result}
        assert 0 in selected_clusters
        assert 1 in selected_clusters
        assert 2 in selected_clusters

    def test_prefers_higher_scoring_within_cluster(self):
        photos = [
            _make_photo("high", cluster_id=0, score=0.95),
            _make_photo("low", cluster_id=0, score=0.1),
        ]
        result = select_photos(photos, max_count=1)
        assert result[0].path.stem == "high"

    def test_marks_selected_flag(self):
        photos = [_make_photo(f"p{i}", cluster_id=0) for i in range(5)]
        result = select_photos(photos, max_count=3)
        assert all(p.selected for p in result)

    def test_returns_empty_on_no_photos(self):
        assert select_photos([], max_count=20) == []

    def test_result_sorted_chronologically(self):
        import datetime as dt
        photos = [
            _make_photo("late",  cluster_id=0, score=0.5),
            _make_photo("early", cluster_id=0, score=0.5),
        ]
        photos[0].date = dt.datetime(2024, 6, 1)
        photos[1].date = dt.datetime(2024, 1, 1)

        result = select_photos(photos, max_count=2)
        assert result[0].path.stem == "early"
