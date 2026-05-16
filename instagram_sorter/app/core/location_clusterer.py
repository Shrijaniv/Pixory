from typing import Dict, List, Tuple

import numpy as np
from sklearn.cluster import DBSCAN

from app.models.photo import Photo
from app.services.geocoding_service import reverse_geocode
from app.config.settings import LOCATION_CLUSTER_EPSILON_KM, LOCATION_CLUSTER_MIN_SAMPLES

_EARTH_RADIUS_KM = 6371.0


def cluster_photos(photos: List[Photo]) -> Tuple[List[Photo], Dict[int, str]]:
    """
    Group photos by GPS location using DBSCAN with haversine distance.
    Photos without GPS are assigned cluster_id = -1 ("Unknown Location").

    Returns:
        - photos with cluster_id and place_name populated
        - dict mapping cluster_id -> human-readable place name
    """
    has_gps = [p for p in photos if p.lat is not None and p.lon is not None]
    no_gps = [p for p in photos if p.lat is None or p.lon is None]

    cluster_names: Dict[int, str] = {}

    for p in no_gps:
        p.cluster_id = -1

    if has_gps:
        coords = np.radians([[p.lat, p.lon] for p in has_gps])
        epsilon_rad = LOCATION_CLUSTER_EPSILON_KM / _EARTH_RADIUS_KM

        db = DBSCAN(
            eps=epsilon_rad,
            min_samples=LOCATION_CLUSTER_MIN_SAMPLES,
            algorithm="ball_tree",
            metric="haversine",
        )
        labels = db.fit_predict(coords)

        for photo, label in zip(has_gps, labels):
            photo.cluster_id = int(label)

        # Reverse-geocode each cluster centroid
        for cid in set(labels):
            cluster_members = [p for p in has_gps if p.cluster_id == cid]
            centroid_lat = float(np.mean([p.lat for p in cluster_members]))
            centroid_lon = float(np.mean([p.lon for p in cluster_members]))
            place = reverse_geocode(centroid_lat, centroid_lon)
            cluster_names[cid] = place or f"Location {cid}"

    if no_gps:
        cluster_names[-1] = "Unknown Location"

    # Assign place_name to every photo
    for photo in photos:
        if photo.cluster_id is not None:
            photo.place_name = cluster_names.get(photo.cluster_id, "Unknown")

    return photos, cluster_names
