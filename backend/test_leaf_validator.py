from pathlib import Path
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import torch
MODEL = "openai/clip-vit-base-patch32"
processor = CLIPProcessor.from_pretrained(MODEL)
model = CLIPModel.from_pretrained(MODEL)
model.eval()
labels = [
    "a clear photograph of a plant leaf",
    "a photograph of a non-plant object",
    "a photograph of a person",
    "a photograph of an animal",
    "a photograph of a vehicle",
    "a photograph of a building",
    "a photograph of a landscape",
    "a photograph of food",
    "a photograph of a document or screen"
]
folder = Path(r"D:\AgriVisionAI_CLEAN_RUNNABLE\frontend\public\demo")
for path in folder.iterdir():
    if path.suffix.lower() not in [".jpg", ".jpeg", ".png", ".webp"]:
        continue
    image = Image.open(path).convert("RGB")
    inputs = processor(
        text=labels,
        images=image,
        return_tensors="pt",
        padding=True
    )
    with torch.no_grad():
        outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]
    ranked = sorted(
        zip(labels, probs.tolist()),
        key=lambda x: x[1],
        reverse=True
    )
    print(f"\nIMAGE: {path.name}")
    for label, probability in ranked:
        print(f"{probability*100:6.2f}%  {label}")
    leaf_score = float(probs[0]) * 100
    top_label = ranked[0][0]
    if top_label == labels[0] and leaf_score >= 80:
        print("RESULT: ACCEPT - LEAF")
    else:
        print("RESULT: REJECT - NOT CONFIRMED AS LEAF")

