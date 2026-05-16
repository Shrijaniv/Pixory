from typing import Dict, List

from app.models.photo import Photo
from app.config.settings import MAX_CAROUSEL_PHOTOS


def select_photos(photos: List[Photo], max_count: int = MAX_CAROUSEL_PHOTOS) -> List[Photo]:
    """
    Select up to max_count photos with balanced coverage across all location clusters.

    Strategy:
    1. Divide the budget evenly across clusters (each location gets a fair share).
    2. Within each cluster, pick the highest-scoring photos first.
    3. Fill any remaining slots with the highest-scoring photos from any cluster.
    4. Return the final selection sorted chronologically.
    """
    # Group by cluster (photos without GPS go to cluster -1)
    clusters: Dict[int, List[Photo]] = {}
    for photo in photos:
        cid = photo.cluster_id if photo.cluster_id is not None else -1
        clusters.setdefault(cid, []).append(photo)

    # Sort each cluster by quality score, best first
    for cid in clusters:
        clusters[cid].sort(key=lambda p: p.combined_score, reverse=True)

    num_clusters = len(clusters)
    if num_clusters == 0:
        return []

    # Assign per-cluster quotas with remainder distributed to larger clusters
    sorted_cids = sorted(clusters.keys(), key=lambda c: len(clusters[c]), reverse=True)
    base_quota = max_count // num_clusters
    remainder = max_count % num_clusters

    cluster_quotas: Dict[int, int] = {}
    for i, cid in enumerate(sorted_cids):
        quota = base_quota + (1 if i < remainder else 0)
        cluster_quotas[cid] = min(quota, len(clusters[cid]))

    # First pass: fill per-cluster quotas
    selected: List[Photo] = []
    for cid, quota in cluster_quotas.items():
        selected.extend(clusters[cid][:quota])

    # Second pass: fill remaining slots with the best unused photos
    if len(selected) < max_count:
        selected_paths = {p.path for p in selected}
        remaining = sorted(
            (p for p in photos if p.path not in selected_paths),
            key=lambda p: p.combined_score,
            reverse=True,
        )
        slots_left = max_count - len(selected)
        selected.extend(remaining[:slots_left])

    # Sort final selection chronologically
    selected.sort(key=lambda p: (p.date is None, p.date))

    for photo in selected:
        photo.selected = True

    return selected[:max_count]
