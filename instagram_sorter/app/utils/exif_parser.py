from datetime import datetime
from pathlib import Path
from typing import Optional

import piexif
from PIL import Image


def parse_exif(path: Path) -> dict:
    """Extract date, GPS, and dimensions from an image's EXIF data."""
    result = {"date": None, "lat": None, "lon": None, "width": 0, "height": 0}

    try:
        with Image.open(path) as img:
            result["width"], result["height"] = img.size
            raw_exif = img.info.get("exif", b"")
            if not raw_exif:
                return result
            exif_data = piexif.load(raw_exif)
    except Exception:
        return result

    # Parse capture date
    try:
        date_bytes = exif_data.get("Exif", {}).get(piexif.ExifIFD.DateTimeOriginal)
        if date_bytes:
            result["date"] = datetime.strptime(date_bytes.decode(), "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass

    # Parse GPS coordinates
    try:
        gps = exif_data.get("GPS", {})
        if gps:
            lat_raw = gps.get(piexif.GPSIFD.GPSLatitude)
            lat_ref = gps.get(piexif.GPSIFD.GPSLatitudeRef, b"N").decode()
            lon_raw = gps.get(piexif.GPSIFD.GPSLongitude)
            lon_ref = gps.get(piexif.GPSIFD.GPSLongitudeRef, b"E").decode()

            lat = _rational_to_decimal(lat_raw)
            lon = _rational_to_decimal(lon_raw)

            if lat is not None and lon is not None:
                result["lat"] = lat if lat_ref == "N" else -lat
                result["lon"] = lon if lon_ref == "E" else -lon
    except Exception:
        pass

    return result


def _rational_to_decimal(value) -> Optional[float]:
    """Convert EXIF GPS rational tuple (degrees, minutes, seconds) to decimal degrees."""
    if not value or len(value) < 3:
        return None
    try:
        degrees = value[0][0] / value[0][1]
        minutes = value[1][0] / value[1][1]
        seconds = value[2][0] / value[2][1]
        return degrees + minutes / 60.0 + seconds / 3600.0
    except (ZeroDivisionError, TypeError):
        return None
