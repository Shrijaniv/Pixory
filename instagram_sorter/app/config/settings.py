import os
from dotenv import load_dotenv

load_dotenv()

# --- API Keys ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
INSTAGRAM_USERNAME = os.getenv("INSTAGRAM_USERNAME", "")
INSTAGRAM_PASSWORD = os.getenv("INSTAGRAM_PASSWORD", "")
INSTAGRAM_ACCESS_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN", "")
INSTAGRAM_BUSINESS_ACCOUNT_ID = os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID", "")

# --- Photo Selection ---
MAX_CAROUSEL_PHOTOS = 10
DUPLICATE_HASH_THRESHOLD = 10       # Max Hamming distance to consider photos duplicates
LOCATION_CLUSTER_EPSILON_KM = 0.5  # Photos within 0.5km grouped as same location
LOCATION_CLUSTER_MIN_SAMPLES = 1   # Allow single-photo clusters

# --- Scoring Weights (must sum to 1.0) ---
SCORING_WEIGHTS = {
    "sharpness":   0.40,
    "lighting":    0.30,
    "composition": 0.20,
    "face_bonus":  0.10,
}

# --- Processing ---
MAX_WORKER_THREADS = 4
THUMBNAIL_MAX_DIM = 800     # Max dimension when loading for scoring
CAPTION_GRID_SIZE = 512     # Size of thumbnail grid sent to GPT-4o Vision

# --- Supported image formats ---
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".tiff", ".tif", ".webp"}
