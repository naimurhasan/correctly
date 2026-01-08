# Grammar Correction API

A robust, production-ready Python FastAPI service that uses the `pszemraj/flan-t5-small-grammar-synthesis` model to perform grammar corrections on text. Designed for efficiency and ease of deployment.

## 1. Project Overview

This API provides an interface to a Transformer-based model optimized for grammar synthesis. It accepts text input and returns grammatically corrected versions. The system is built with FastAPI for high performance, uses PyTorch (CPU-optimized) for inference, and Pydantic for strict data validation.

## 2. Features

- **Single & Batch Correction**: Process individual strings or lists of strings.
- **Efficient Model Loading**: Model is loaded once at startup to minimize latency per request.
- **CPU Optimization**: configured to run efficiently on standard CPU instances without needing GPUs.
- **Health Monitoring**: Dedicated `/health` endpoint exposes real-time memory usage and system status.
- **Robust Validation**: Input length and content validation to prevent processing errors.
- **Docker-Ready**: (Optional) Structure is compatible with containerization.

## 3. Prerequisites

- **Python**: 3.10 or higher
- **RAM**: Minimum 2GB (4GB recommended for smooth operation)

## 4. Installation (Local)

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Create a virtual environment**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Environment Setup**:
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```

## 4.5 Offline Usage (No Extra Dependencies at Runtime)

To run the API completely offline (without connecting to HuggingFace during startup), you can pre-download the model:

1.  **Run the download script**:
    ```bash
    python download_model.py
    ```
    This will save the model to the `./local_model` directory (~300MB).

2.  **Configuration**:
    The application is configured to automatically check for `./local_model` at startup. If found, it will load from there instead of the internet.
    Alternatively, you can manually set `MODEL_NAME=./local_model` in your `.env` file.

## 5. Running Locally

Start the development server with hot-reload enabled:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.
Documentation is available at `http://localhost:8000/docs`.

## 6. GCP Deployment Steps

To deploy this on a Google Cloud Platform (GCP) Compute Engine instance:

1.  **Create VM Instance**:
    *   Operating System: Ubuntu 22.04 LTS
    *   Machine Type: e2-medium (2 vCPU, 4GB memory) is recommended.
    *   Firewall: Allow HTTP/HTTPS traffic.

2.  **SSH into Instance**:
    Use the GCP Console or `gcloud` command to SSH.

3.  **Upload Code**:
    *   Use `git clone` to pull your code onto the server.

4.  **Run Deployment Script**:
    The included `deploy.sh` handles dependencies, swap space, and PM2 setup.
    ```bash
    chmod +x deploy.sh
    ./deploy.sh
    ```

5.  **Configure Firewall**:
    Ensure the GCP Firewall rules allow traffic on port 8000 (or configure Nginx as a reverse proxy).

    To open HTTP/HTTPS traffic:
    ```bash
    gcloud compute firewall-rules create allow-http-https --allow tcp:80,tcp:443
    ```

## 7. API Usage Examples
**Authentication**: If `API_KEY` is set in your environment, you must include the `x-api-key` header in your requests.

### Simple Correction
```bash
curl -X 'POST' \
  'http://localhost:8000/api/correct' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-secret-api-key' \
  -d '{
  "text": "me go to store yesterday"
}'
```

### Batch Correction
```bash
curl -X 'POST' \
  'http://localhost:8000/api/correct/batch' \
  -H 'Content-Type: application/json' \
  -d '{
  "texts": [
    "he dont like it",
    "she run fast"
  ]
}'
```

### Health Check
```bash
curl -X 'GET' 'http://localhost:8000/health'
```

### Error Case (Empty Text)
```bash
curl -X 'POST' \
  'http://localhost:8000/api/correct' \
  -H 'Content-Type: application/json' \
  -d '{
  "text": "   "
}'
```

## 8. Memory Optimization Tips

*   **Model Size**: We use `flan-t5-small` which is lightweight (~300MB). Avoid switching to `base` or `large` models on low-RAM instances.
*   **Swap Space**: The `deploy.sh` script creates a 2GB swap file. This prevents Out-Of-Memory (OOM) kills if the model spikes memory usage during loading.
*   **Concurrency**: By default, Uvicorn runs workers. For this CPU-bound task with a thread-unsafe tokenizer/model pipeline, a single worker is often safest unless you implement multiprocessing logic.

## 9. Troubleshooting

*   **Server crashes on startup**: Usually due to insufficient RAM. Check if swap is enabled.
## 10. Process Management (Systemd)

We use native Linux `systemd` to manage the application service.

*   **View Status**: `sudo systemctl status grammar-api`
*   **View Logs**: `sudo journalctl -u grammar-api -f`
*   **Restart**: `sudo systemctl restart grammar-api`
*   **Stop**: `sudo systemctl stop grammar-api`
