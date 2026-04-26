from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import json
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="Student Performance Predictor API")
api = APIRouter(prefix="/api")

# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12),
               "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=7),
               "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=12*3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=7*24*3600, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: Literal["teacher", "student"] = "teacher"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class StudentIn(BaseModel):
    name: str = Field(min_length=1)
    grade: str = "10"
    attendance_pct: float = Field(ge=0, le=100, default=85)
    study_hours: float = Field(ge=0, le=24, default=2)
    sleep_hours: float = Field(ge=0, le=24, default=7)
    prev_marks: float = Field(ge=0, le=100, default=70)
    parental_support: Literal["none", "low", "medium", "high"] = "medium"
    extracurriculars: int = Field(ge=0, le=10, default=1)
    internet_access: bool = True
    tutor: bool = False
    notes: Optional[str] = ""

class Student(StudentIn):
    id: str
    owner_id: str
    created_at: str
    last_predicted_score: Optional[float] = None
    last_band: Optional[str] = None

class PredictionResult(BaseModel):
    score: float
    band: str
    factors: dict
    recommendations: List[str]
    insight: str
    created_at: str

# ---------- Rule-based predictor ----------
WEIGHTS = {
    "prev_marks": 0.30,
    "attendance": 0.20,
    "study": 0.20,
    "sleep": 0.10,
    "support": 0.08,
    "tutor": 0.05,
    "internet": 0.04,
    "extra": 0.03,
}

def normalize(val, lo, hi):
    if hi == lo:
        return 0.5
    v = (val - lo) / (hi - lo)
    return max(0.0, min(1.0, v))

def sleep_score(h):
    # Optimal 7-9h
    if 7 <= h <= 9:
        return 1.0
    if h < 7:
        return max(0.0, h / 7)
    return max(0.0, 1.0 - (h - 9) / 6)

def study_score(h):
    # Optimal 2-5h
    if 2 <= h <= 5:
        return 1.0
    if h < 2:
        return h / 2
    return max(0.4, 1.0 - (h - 5) / 8)

def predict_score(s: dict) -> dict:
    factors = {
        "prev_marks": normalize(s["prev_marks"], 0, 100),
        "attendance": normalize(s["attendance_pct"], 0, 100),
        "study": study_score(s["study_hours"]),
        "sleep": sleep_score(s["sleep_hours"]),
        "support": {"none": 0.0, "low": 0.4, "medium": 0.7, "high": 1.0}[s["parental_support"]],
        "tutor": 1.0 if s["tutor"] else 0.0,
        "internet": 1.0 if s["internet_access"] else 0.0,
        "extra": normalize(s["extracurriculars"], 0, 5) if s["extracurriculars"] <= 5 else max(0.3, 1 - (s["extracurriculars"] - 5) * 0.15),
    }
    raw = sum(factors[k] * WEIGHTS[k] for k in WEIGHTS)
    score = round(raw * 100, 1)
    if score >= 85:
        band = "excellent"
    elif score >= 70:
        band = "good"
    elif score >= 55:
        band = "average"
    else:
        band = "at_risk"
    contributions = {k: round(factors[k] * WEIGHTS[k] * 100, 1) for k in WEIGHTS}
    return {"score": score, "band": band, "factors": factors, "contributions": contributions}

def fallback_recommendations(s: dict, pred: dict) -> List[str]:
    recs = []
    if s["attendance_pct"] < 80:
        recs.append("Improve attendance — aim for at least 90% to retain in-class context.")
    if s["study_hours"] < 2:
        recs.append("Increase focused study time to 2–4 hours per day with the Pomodoro method.")
    if s["sleep_hours"] < 7:
        recs.append("Get 7–9 hours of sleep — sleep directly impacts memory consolidation.")
    if s["prev_marks"] < 60:
        recs.append("Revise foundational topics from previous units before advancing.")
    if not s["tutor"] and pred["band"] in ("average", "at_risk"):
        recs.append("Consider a tutor or peer-study group for weak subjects.")
    if s["parental_support"] in ("none", "low"):
        recs.append("Set up a quiet study space and a fixed daily schedule at home.")
    if not recs:
        recs.append("Maintain current habits and challenge yourself with advanced practice problems.")
    return recs[:6]

async def get_ai_insight(s: dict, pred: dict) -> dict:
    """Returns {'insight': str, 'recommendations': [str]}. Falls back if AI unavailable."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("no key")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"predict-{uuid.uuid4()}",
            system_message=(
                "You are an academic performance coach. Given a student's profile and "
                "a predicted score, return STRICT JSON with keys: insight (2-3 sentence "
                "narrative diagnosing strengths and risks) and recommendations (array "
                "of 4-6 short, specific, actionable bullet recommendations). No markdown."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"Student: {s['name']} (grade {s['grade']})\n"
            f"Attendance: {s['attendance_pct']}%, Study: {s['study_hours']}h/day, "
            f"Sleep: {s['sleep_hours']}h, Previous marks: {s['prev_marks']}, "
            f"Parental support: {s['parental_support']}, Extracurriculars: {s['extracurriculars']}, "
            f"Internet: {s['internet_access']}, Tutor: {s['tutor']}.\n"
            f"Predicted score: {pred['score']} (band: {pred['band']}).\n"
            f"Factor contributions: {pred['contributions']}.\n"
            "Respond with JSON only."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()
        data = json.loads(text)
        return {
            "insight": str(data.get("insight", "")).strip(),
            "recommendations": [str(r) for r in data.get("recommendations", [])][:6],
        }
    except Exception as e:
        logging.warning(f"AI insight failed, using fallback: {e}")
        band_text = {
            "excellent": "performing at a high level with strong fundamentals",
            "good": "on solid ground with room for refinement",
            "average": "performing adequately but at risk of stagnation",
            "at_risk": "showing concerning patterns that need immediate attention",
        }[pred["band"]]
        return {
            "insight": (f"{s['name']} is currently {band_text}. Predicted score "
                        f"of {pred['score']}/100 reflects the combined effect of study "
                        f"habits, attendance, and lifestyle factors."),
            "recommendations": fallback_recommendations(s, pred),
        }

# ---------- Auth routes ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user["name"],
            "role": user["role"], "created_at": user["created_at"],
            "access_token": access}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "created_at": user["created_at"],
            "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Students routes ----------
@api.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    items = await db.students.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items

@api.post("/students")
async def create_student(payload: StudentIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["owner_id"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["last_predicted_score"] = None
    doc["last_band"] = None
    await db.students.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/students/{sid}")
async def get_student(sid: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": sid, "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    return s

@api.put("/students/{sid}")
async def update_student(sid: str, payload: StudentIn, user: dict = Depends(get_current_user)):
    res = await db.students.update_one(
        {"id": sid, "owner_id": user["id"]},
        {"$set": payload.model_dump()},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    s = await db.students.find_one({"id": sid}, {"_id": 0})
    return s

@api.delete("/students/{sid}")
async def delete_student(sid: str, user: dict = Depends(get_current_user)):
    res = await db.students.delete_one({"id": sid, "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.predictions.delete_many({"student_id": sid})
    return {"ok": True}

@api.post("/students/{sid}/predict")
async def predict_student(sid: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": sid, "owner_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    pred = predict_score(s)
    ai = await get_ai_insight(s, pred)
    record = {
        "id": str(uuid.uuid4()),
        "student_id": sid,
        "owner_id": user["id"],
        "score": pred["score"],
        "band": pred["band"],
        "factors": pred["factors"],
        "contributions": pred["contributions"],
        "insight": ai["insight"],
        "recommendations": ai["recommendations"],
        "snapshot": {k: s[k] for k in [
            "attendance_pct", "study_hours", "sleep_hours", "prev_marks",
            "parental_support", "extracurriculars", "internet_access", "tutor"
        ]},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.predictions.insert_one(record)
    await db.students.update_one(
        {"id": sid},
        {"$set": {"last_predicted_score": pred["score"], "last_band": pred["band"]}},
    )
    record.pop("_id", None)
    return record

@api.get("/students/{sid}/predictions")
async def list_predictions(sid: str, user: dict = Depends(get_current_user)):
    items = await db.predictions.find(
        {"student_id": sid, "owner_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return items

# Quick predict (student self-mode, not stored against a student record)
@api.post("/predict-quick")
async def predict_quick(payload: StudentIn, user: dict = Depends(get_current_user)):
    s = payload.model_dump()
    pred = predict_score(s)
    ai = await get_ai_insight(s, pred)
    return {
        "score": pred["score"],
        "band": pred["band"],
        "factors": pred["factors"],
        "contributions": pred["contributions"],
        "insight": ai["insight"],
        "recommendations": ai["recommendations"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    students = await db.students.find({"owner_id": user["id"]}, {"_id": 0}).to_list(5000)
    total = len(students)
    scored = [s for s in students if s.get("last_predicted_score") is not None]
    avg = round(sum(s["last_predicted_score"] for s in scored) / len(scored), 1) if scored else 0.0
    at_risk = sum(1 for s in scored if s["last_band"] == "at_risk")
    top = max(scored, key=lambda x: x["last_predicted_score"], default=None)
    band_counts = {"excellent": 0, "good": 0, "average": 0, "at_risk": 0}
    for s in scored:
        band_counts[s["last_band"]] = band_counts.get(s["last_band"], 0) + 1
    # Recent predictions across all students
    recent = await db.predictions.find(
        {"owner_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(8)
    return {
        "total_students": total,
        "avg_score": avg,
        "at_risk_count": at_risk,
        "top_performer": ({"name": top["name"], "score": top["last_predicted_score"]}
                          if top else None),
        "band_counts": band_counts,
        "recent_predictions": recent,
    }

# ---------- CSV ----------
@api.get("/students/export/csv")
async def export_csv(user: dict = Depends(get_current_user)):
    items = await db.students.find({"owner_id": user["id"]}, {"_id": 0}).to_list(5000)
    cols = ["name", "grade", "attendance_pct", "study_hours", "sleep_hours",
            "prev_marks", "parental_support", "extracurriculars",
            "internet_access", "tutor", "notes", "last_predicted_score", "last_band"]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols)
    w.writeheader()
    for it in items:
        w.writerow({c: it.get(c, "") for c in cols})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )

@api.post("/students/import/csv")
async def import_csv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    inserted = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        try:
            data = StudentIn(
                name=row.get("name", "").strip(),
                grade=row.get("grade", "10").strip() or "10",
                attendance_pct=float(row.get("attendance_pct", 85) or 85),
                study_hours=float(row.get("study_hours", 2) or 2),
                sleep_hours=float(row.get("sleep_hours", 7) or 7),
                prev_marks=float(row.get("prev_marks", 70) or 70),
                parental_support=(row.get("parental_support", "medium") or "medium").strip().lower(),
                extracurriculars=int(float(row.get("extracurriculars", 1) or 1)),
                internet_access=str(row.get("internet_access", "True")).lower() in ("true", "1", "yes"),
                tutor=str(row.get("tutor", "False")).lower() in ("true", "1", "yes"),
                notes=row.get("notes", ""),
            )
            doc = data.model_dump()
            doc["id"] = str(uuid.uuid4())
            doc["owner_id"] = user["id"]
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            doc["last_predicted_score"] = None
            doc["last_band"] = None
            await db.students.insert_one(doc)
            inserted += 1
        except Exception as e:
            errors.append(f"row {i}: {e}")
    return {"inserted": inserted, "errors": errors[:20]}

# ---------- Misc ----------
@api.get("/")
async def root():
    return {"message": "Student Performance Predictor API"}

# ---------- App wiring ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.students.create_index("owner_id")
    await db.predictions.create_index([("owner_id", 1), ("created_at", -1)])
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pw)}},
        )

@app.on_event("shutdown")
async def shutdown():
    client.close()
