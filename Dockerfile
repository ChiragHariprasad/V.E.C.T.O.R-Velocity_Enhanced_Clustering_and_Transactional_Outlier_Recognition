# =============================================================================
# V.E.C.T.O.R — Dockerfile
# Unified Single-Port Container (Python 3.11 + Node.js 20)
# =============================================================================

FROM python:3.11-slim

# Prevent interactive prompts and Python output buffering
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PORT=3001

WORKDIR /app

# 1. Install system dependencies, curl, and Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy application code
COPY Backend/ ./Backend/
COPY Frontend/package*.json ./Frontend/

# 4. Install Node.js frontend dependencies and build SPA
WORKDIR /app/Frontend
RUN npm ci
COPY Frontend/ ./
RUN npm run build

# 5. Set working directory to app root
WORKDIR /app

# Expose single application port (serves REST API, WebSockets, and SPA)
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/api/bitcoin/status || exit 1

# Start unified server
CMD ["node", "Frontend/server/index.js"]
