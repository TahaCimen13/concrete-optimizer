FROM python:3.11-slim

WORKDIR /app

# System deps for scientific Python wheels are already provided by slim + wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download the dataset and train the model at build time so the container
# starts fast and runs offline.
RUN python -c "import model; model.default_model()"

EXPOSE 8000
# Honor the platform-provided $PORT (Render/Railway), default 8000 locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
