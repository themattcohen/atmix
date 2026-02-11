# Railway Dockerfile for SaraBot
FROM python:3.11-slim

WORKDIR /app

# Set HuggingFace cache location (consistent between build and runtime)
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

# Install CPU-only PyTorch first (much smaller than CUDA version)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers model to app cache directory
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# NOW set offline mode for runtime (model already cached)
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Copy application code
COPY . .

# Set working directory to scripts/rag so uvicorn can find the module
WORKDIR /app/scripts/rag

# Start the server (PORT is set by Railway)
CMD ["python", "server.py"]
