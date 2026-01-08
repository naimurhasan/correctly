import time
import psutil
import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException, status, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from transformers import pipeline
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

corrector = None

MODEL_NAME = os.getenv("MODEL_NAME", "vennify/t5-base-grammar-correction")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "5000"))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "10"))
API_KEY = os.getenv("API_KEY")

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)

if API_KEY:
    logger.info("Authentication Enabled: API Key is set.")
else:
    logger.warning("Authentication Disabled: No API Key found in environment.")

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if not API_KEY:
        return True
    if api_key_header == API_KEY:
        return True
    raise HTTPException(status_code=403, detail="Invalid API Key")

class CorrectionRequest(BaseModel):
    text: str = Field(..., description="Text to correct")

    @validator("text")
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError("Text cannot be empty")
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError(f"Max length {MAX_TEXT_LENGTH} exceeded")
        return v

class BatchCorrectionRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts")

    @validator("texts")
    def validate_texts(cls, v):
        if not v:
            raise ValueError("List cannot be empty")
        if len(v) > MAX_BATCH_SIZE:
            raise ValueError(f"Batch size {MAX_BATCH_SIZE} exceeded")
        for i, text in enumerate(v):
            if not text.strip() or len(text) > MAX_TEXT_LENGTH:
                raise ValueError(f"Invalid text at index {i}")
        return v

class CorrectionResponse(BaseModel):
    success: bool
    original: str
    corrected: str
    processing_time_ms: int
    chars_count: int

class BatchCorrectionResponse(BaseModel):
    success: bool
    results: List[CorrectionResponse]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    system: dict

app = FastAPI(title="Grammar Correction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    global corrector
    try:
        # Prefer local model for offline support
        model_path = "./local_model" if os.path.isdir("./local_model") else MODEL_NAME
        logger.info(f"Loading model from: {model_path}")
        corrector = pipeline("text2text-generation", model=model_path, device=-1)
        logger.info("Model loaded")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        corrector = None

def process_text(text: str) -> dict:
    if not corrector:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Model not active")
    
    start = time.time()
    try:
        # T5-base specific prefix expectation
        prompt = f"grammar: {text}"
        res = corrector(prompt, max_length=512)
        corrected = res[0]['generated_text']
        
        return {
            "success": True,
            "original": text,
            "corrected": corrected,
            "processing_time_ms": int((time.time() - start) * 1000),
            "chars_count": len(text)
        }
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(500, f"Error: {str(e)}")

@app.get("/", response_model=dict)
async def root():
    return {"message": "Grammar Correction API", "docs": "/docs", "health": "/health"}

@app.get("/health", response_model=HealthResponse)
async def health():
    mem = psutil.virtual_memory()
    return {
        "status": "healthy" if corrector else "loading",
        "model_loaded": corrector is not None,
        "system": {
            "memory_used_mb": round(mem.used / (1024**2), 2),
            "memory_percent": mem.percent,
            "cpu_count": psutil.cpu_count()
        }
    }

@app.post("/api/correct", response_model=CorrectionResponse, dependencies=[Depends(get_api_key)])
async def correct(req: CorrectionRequest):
    return process_text(req.text)

@app.post("/api/correct/batch", response_model=BatchCorrectionResponse, dependencies=[Depends(get_api_key)])
async def batch_correct(req: BatchCorrectionRequest):
    results = []
    for text in req.texts:
        try:
            results.append(process_text(text))
        except HTTPException:
            # Fallback for individual item failure in batch
            results.append({
                "success": False,
                "original": text,
                "corrected": "",
                "processing_time_ms": 0,
                "chars_count": len(text)
            })
    return {"success": True, "results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
