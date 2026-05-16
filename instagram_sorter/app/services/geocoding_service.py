import time
from typing import Optional

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

_geolocator = Nominatim(user_agent="instagram_sorter_v1", timeout=10)


def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """
    Convert GPS coordinates to a human-readable place name using OpenStreetMap Nominatim.
    Rate-limited to 1 request/second per Nominatim's usage policy.
    """
    try:
        time.sleep(1.1)  # Nominatim requires <= 1 req/sec
        location = _geolocator.reverse((lat, lon), language="en")
        if not location:
            return None

        addr = location.raw.get("address", {})
        place = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("suburb")
            or addr.get("county")
            or addr.get("state")
        )
        country = addr.get("country")

        if place and country:
            return f"{place}, {country}"
        return place or country or location.address

    except (GeocoderTimedOut, GeocoderServiceError, Exception):
        return None
