FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir "crewai[litellm]==1.13.0" "fastapi>=0.115,<1" "uvicorn>=0.32,<1" "httpx>=0.28,<1"
COPY app.py .
ENV OTEL_SDK_DISABLED=true CREWAI_TELEMETRY_ENABLED=false
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
