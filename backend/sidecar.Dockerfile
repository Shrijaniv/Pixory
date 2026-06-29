# Python sidecar image — face engines (DeepFace / InsightFace) + Instagram publish.
# pip install runs ONCE here at build time and is baked into the image; the cloud
# platform boots the prebuilt image with everything already installed.
#
# Build:  docker build -f sidecar.Dockerfile -t pixory-sidecar .
# Run:    docker run -p 8001:8001 pixory-sidecar
FROM python:3.11-slim

WORKDIR /app

# System libraries: OpenCV needs libGL/libglib; insightface compiles a C ext.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps once (cached layer unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY publish_sidecar.py .
COPY face_engines ./face_engines

# Default to the lightweight engine in the cloud (override with -e FACE_ENGINE=deepface)
ENV FACE_ENGINE=insightface

# Pre-bake model weights so the FIRST request is instant (no runtime download).
# InsightFace (buffalo_l ~300MB) + HSEmotion. DeepFace weights download lazily on
# first use if you switch FACE_ENGINE=deepface.
RUN python -c "from insightface.app import FaceAnalysis; a=FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']); a.prepare(ctx_id=-1, det_size=(640,640))" \
 && python -c "from hsemotion_onnx.facial_emotions import HSEmotionRecognizer; HSEmotionRecognizer(model_name='enet_b0_8_best_afew')"

EXPOSE 8001
# Bind 0.0.0.0 (the __main__ block binds 127.0.0.1 for local use only); 2 workers
# for a little parallelism on the CPU-bound face work.
CMD ["uvicorn", "publish_sidecar:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
