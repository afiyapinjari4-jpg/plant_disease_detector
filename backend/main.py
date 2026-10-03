import os
import io
import time
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import APIError

load_dotenv()

app = FastAPI(title="PlantVision AI Core Engine", version="7.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
client = genai.Client(api_key=API_KEY) if API_KEY else None

PRIMARY_MODEL = "gemini-2.5-flash"
FALLBACK_MODEL = "gemini-3.5-flash-lite"

# In-memory session tracking for real-time history and analytics
SCAN_HISTORY: List[Dict[str, Any]] = []

class MorphologyAnalysis(BaseModel):
    leaf_type: str = Field(description="Simple, compound, palmate, pinnate, needle, or peltate")
    margin_and_venation: str = Field(description="Description of leaf edge and vein patterns")

class ProbabilityDistribution(BaseModel):
    condition_name: str = Field(description="Condition name or 'Healthy'")
    probability: float = Field(description="Percentage 0.0 - 100.0")

class StructuredTreatment(BaseModel):
    summary_bullet_points: List[str] = Field(description="4 concise, actionable bullet points")
    detailed_guide: str = Field(description="Comprehensive treatment and cultural prevention guide")

class PlantVisionResponse(BaseModel):
    morphology: MorphologyAnalysis
    plant_name: str = Field(description="Common household name (e.g., Tomato, Potato, Papaya, Mango, Rose, Tulsi)")
    botanical_name: str = Field(description="Scientific Latin binomial name (Genus species)")
    disease_name: str = Field(description="Identified disease/pathogen or 'None (Healthy)'")
    is_healthy: bool = Field(description="True if plant has no disease, pests, or deficiencies")
    category: str = Field(description="'Fungal', 'Bacterial', 'Viral', 'Pest/Deficiency', or 'Healthy'")
    confidence: float = Field(description="Confidence percentage 0.0 to 100.0")
    disease_description: str = Field(description="Clinical summary of the pathogen and visual damage")
    probabilities: List[ProbabilityDistribution] = Field(description="Distribution of top 3 diagnostic hypotheses")
    recommended_treatments: StructuredTreatment

PATHOLOGIST_DIRECTIVE = """
You are the senior plant pathologist for the PlantVision AI diagnostic engine.
Analyze the provided leaf image with botanical and pathological rigor:
1. COMMON NAME: Always provide the simple, widely used household name ordinary gardeners use (e.g., 'Tomato plant', 'Papaya tree', 'Potato plant', 'Neem tree', 'Rose', 'Guava', 'Banana'). Put Latin names strictly in 'botanical_name'.
2. Examine leaf morphology first to avoid default dataset biases.
3. Classify into category: 'Fungal', 'Bacterial', 'Viral', 'Pest/Deficiency', or 'Healthy'.
4. Provide a top-3 probability breakdown (e.g., Primary Disease 94.6%, Secondary Suspicion 4.1%, Healthy 1.3%).
5. Give 4 concise, high-impact remedy bullet points (e.g., 'Remove infected leaves', 'Improve air circulation', 'Apply copper fungicide').
6. Provide a concise description explaining what the pathogen is and how it damages the leaf.
"""

@app.get("/health")
def health_check():
    return {
        "status": "AI System Online",
        "primary_engine": PRIMARY_MODEL,
        "fallback_engine": FALLBACK_MODEL,
        "connected": client is not None
    }

@app.get("/history")
def get_history():
    total_scans = len(SCAN_HISTORY)
    if total_scans == 0:
        return {
            "history": [],
            "stats": {
                "total_scans": 0,
                "avg_confidence": 0.0,
                "healthy_count": 0,
                "diseased_count": 0,
                "category_breakdown": {},
                "plant_distribution": {}
            }
        }

    avg_conf = sum(item["confidence"] for item in SCAN_HISTORY) / total_scans
    healthy_cnt = sum(1 for item in SCAN_HISTORY if item["status"] == "Healthy")
    diseased_cnt = total_scans - healthy_cnt

    category_counts: Dict[str, int] = {}
    plant_counts: Dict[str, int] = {}

    for item in SCAN_HISTORY:
        cat = item.get("category", "Fungal")
        category_counts[cat] = category_counts.get(cat, 0) + 1

        p = item.get("plant", "Unknown")
        plant_counts[p] = plant_counts.get(p, 0) + 1

    return {
        "history": SCAN_HISTORY,
        "stats": {
            "total_scans": total_scans,
            "avg_confidence": round(avg_conf, 1),
            "healthy_count": healthy_cnt,
            "diseased_count": diseased_cnt,
            "category_breakdown": category_counts,
            "plant_distribution": plant_counts
        }
    }

@app.delete("/history")
def clear_history():
    SCAN_HISTORY.clear()
    return {"success": True, "message": "Scan history cleared successfully"}

@app.post("/diagnose")
async def diagnose(file: UploadFile = File(...)):
    if not client:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, "error": "GEMINI_API_KEY is not configured on the backend."}
        )

    try:
        contents = await file.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": f"Invalid image format: {str(e)}"}
        )

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=PlantVisionResponse,
        temperature=0.0,
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="NONE")
        )
    )

    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL]
    last_error = ""

    for model_id in models_to_try:
        for attempt in range(1, 3):
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=[PATHOLOGIST_DIRECTIVE, pil_image],
                    config=config
                )
                parsed = PlantVisionResponse.model_validate_json(response.text)
                payload = parsed.model_dump()
                payload["success"] = True
                payload["model_used"] = model_id

                # Save to live scan history
                new_entry = {
                    "id": str(len(SCAN_HISTORY) + 1),
                    "timestamp": datetime.now().strftime("%b %d, %Y - %I:%M %p"),
                    "plant": payload["plant_name"],
                    "disease": payload["disease_name"],
                    "category": payload.get("category", "Fungal"),
                    "confidence": payload["confidence"],
                    "status": "Healthy" if payload["is_healthy"] else "Diseased"
                }
                SCAN_HISTORY.insert(0, new_entry)

                return payload
            except APIError as api_err:
                last_error = f"{api_err.code}: {api_err.message}"
                if api_err.code in [429, 503]:
                    time.sleep(2.0 * attempt)
                    continue
                break
            except Exception as ex:
                last_error = str(ex)
                break

    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"success": False, "error": f"Diagnosis failed: {last_error}"}
    )