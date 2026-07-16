from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import torch
import whisper
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None

@app.on_event("startup")
def load_model():
    global model
    model_size = os.getenv("WHISPER_MODEL", "base")
    model = whisper.load_model(model_size)
    print(f"Loaded whisper model: {model_size}")

@app.get("/health")
def health():
    return {"status": "ok", "model": "whisper"}

@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    if model is None:
        return {"error": "Model not loaded"}, 500

    content = await audio.read()
    with open("/tmp/audio.mp3", "wb") as f:
        f.write(content)

    result = model.transcribe("/tmp/audio.mp3", language=language)
    os.remove("/tmp/audio.mp3")

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
        })

    return {
        "text": result["text"].strip(),
        "segments": segments,
    }
