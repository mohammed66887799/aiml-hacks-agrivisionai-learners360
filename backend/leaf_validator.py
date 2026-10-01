import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
load_dotenv()
MODEL_NAME = "gemini-3.5-flash-lite"
PROMPT = """
You are a strict image validator for an agricultural plant disease detection system.
Determine whether the uploaded image contains a CLEAR, VISIBLE PLANT LEAF
as the PRIMARY SUBJECT.
ACCEPT:
- Crop leaves
- Plant leaves
- Healthy leaves
- Diseased leaves
- Leaves showing spots, lesions, rust, blight, discoloration, or other symptoms
REJECT:
- Cars
- Vehicles
- People
- Animals
- Buildings
- Phones
- Computers
- Screenshots
- Documents
- Food
- Soil-only images
- Landscapes
- Flowers without a clearly visible leaf
- Stems or branches without a leaf
- Random objects
- Images where the leaf is too small
- Images where the leaf is hidden or severely obstructed
- Images that are too unclear to confirm a leaf
Be conservative.
If you cannot clearly confirm that a plant leaf is the primary subject,
return is_leaf=false.
Return ONLY JSON:
{
  "is_leaf": true or false,
  "confidence": number from 0 to 100,
  "reason": "short explanation"
}
"""
def validate_leaf(image_bytes: bytes, mime_type: str = "image/jpeg"):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Check backend .env."
        )
    client = genai.Client(api_key=api_key)
    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type=mime_type,
    )
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            image_part,
            PROMPT,
        ],
        config={
            "response_mime_type": "application/json",
            "response_schema": {
                "type": "object",
                "properties": {
                    "is_leaf": {"type": "boolean"},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": [
                    "is_leaf",
                    "confidence",
                    "reason",
                ],
            },
        },
    )
    result = json.loads(response.text)
    is_leaf = bool(result["is_leaf"])
    confidence = max(
        0.0,
        min(100.0, float(result["confidence"]))
    )
    reason = str(result["reason"])
    return {
        "valid": is_leaf,
        "leaf_confidence": round(confidence, 2),
        "top_category": "plant_leaf" if is_leaf else "not_leaf",
        "message": (
            "Leaf image accepted."
            if is_leaf
            else "Invalid image: Please upload a clear crop leaf image."
        ),
        "reason": reason,
    }
