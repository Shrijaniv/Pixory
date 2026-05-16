from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class Photo:
    path: Path
    date: Optional[datetime] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    cluster_id: Optional[int] = None
    place_name: Optional[str] = None
    phash: Optional[str] = None
    sharpness_score: float = 0.0
    lighting_score: float = 0.0
    composition_score: float = 0.0
    combined_score: float = 0.0
    selected: bool = False
    width: int = 0
    height: int = 0
    file_size: int = 0

    def __repr__(self):
        return (
            f"Photo(name={self.path.name}, score={self.combined_score:.2f}, "
            f"place={self.place_name}, date={self.date})"
        )
