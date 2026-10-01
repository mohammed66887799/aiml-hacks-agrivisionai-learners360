# AgriVision AI — Clean Run Package

## What was cleaned
- Removed dated/backup Python and React source copies.
- Kept one backend and one frontend.
- Kept demo images.
- Added `backend/requirements.txt`.
- Added `trained_model/class_names.json` and `trained_model/model_config.json`.
- Backend supports:
  - `/predict`
  - `/gradcampp`
  - `/gradcam` (alias)
  - `/nasa`
  - `/soil`
  - `/health`
  - `/model-info`

## IMPORTANT: model weights
The uploaded source ZIP did not contain `mobilenetv3_plantvillage.pth`.
Put the real trained model file here:

`trained_model/mobilenetv3_plantvillage.pth`

The backend will automatically find it there.

## Backend
PowerShell:
```powershell
cd <project>\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

## Frontend
Open a second PowerShell:
```powershell
cd <project>\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## API tests
```powershell
Invoke-RestMethod "http://127.0.0.1:8000/health" | ConvertTo-Json -Depth 10
Invoke-RestMethod "http://127.0.0.1:8000/nasa?latitude=30.9010&longitude=75.8573" | ConvertTo-Json -Depth 10
Invoke-RestMethod "http://127.0.0.1:8000/soil?latitude=30.9010&longitude=75.8573" | ConvertTo-Json -Depth 10
```

Grad-CAM++:
```powershell
curl.exe -X POST -F "file=@<path>\frontend\public\demo\late-blight.jpg" http://127.0.0.1:8000/gradcampp
```
