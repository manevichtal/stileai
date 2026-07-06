# StileAI checkpoint (Interlock MCP server) — runs in HTTP mode.
# Build:  docker build -t stileai-checkpoint ./interlock-mcp
# Run:    docker run -p 8000:8000 -e INTERLOCK_STORE=api -e INTERLOCK_TRANSPORT=http \
#           -e INTERLOCK_DASHBOARD_URL=... -e INTERLOCK_API_KEY=... \
#           -e INTERLOCK_MCP_AUTH_TOKEN=... stileai-checkpoint
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Defaults for hosted use; override at runtime.
ENV INTERLOCK_STORE=api \
    INTERLOCK_TRANSPORT=http

# The server binds 0.0.0.0:$PORT (defaults to 8000 if PORT is unset).
EXPOSE 8000

CMD ["python", "-m", "interlock.server"]
