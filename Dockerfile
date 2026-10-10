# =============================================================================
# V.E.C.T.O.R — Dockerfile (Render Backend Service)
# Unified Single-Port Container (Python 3.12 + Node.js 22)
# Serves Express API, Socket.IO, Python analytics and model artifacts.
# The frontend SPA is hosted separately on Vercel.
# =============================================================================

FROM python:3.12-slim

# Prevent interactive prompts and Python output buffering
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production

WORKDIR /app

# 1. Install system dependencies, curl, and Node.js 22
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy Backend (Python analytics + model artifacts)
COPY Backend/ ./Backend/

# 4. Install Node.js server dependencies (no frontend build — Vercel hosts the SPA)
COPY Frontend/package.json Frontend/package-lock.json ./Frontend/
WORKDIR /app/Frontend
RUN npm ci --omit=dev
COPY Frontend/server/ ./server/

# 5. Set working directory to app root so Backend/ imports resolve
WORKDIR /app

# Expose the port Render injects at runtime via $PORT
EXPOSE 3001

# Healthcheck — uses the dedicated readiness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/healthz || exit 1

# Start unified server
CMD ["node", "Frontend/server/index.js"]
