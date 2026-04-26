"""Backend tests for Student Performance Predictor API."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://student-predict-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["email"] == "admin@example.com"
    assert "password_hash" not in data
    return data["access_token"]


@pytest.fixture(scope="session")
def fresh_user():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "pass1234", "name": "Test U", "role": "teacher"},
                      timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "access_token" in d
    assert "password_hash" not in d
    return {"email": email, "token": d["access_token"], "id": d["id"]}


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------- Auth -------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_register_duplicate(self, fresh_user):
        r = requests.post(f"{API}/auth/register",
                          json={"email": fresh_user["email"], "password": "x123456", "name": "X"}, timeout=15)
        assert r.status_code == 400

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "admin@example.com"
        assert "password_hash" not in d
        assert "_id" not in d

    def test_login_sets_cookies(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "admin123"}, timeout=15)
        assert r.status_code == 200
        # cookies returned in headers
        sc = r.headers.get("set-cookie", "")
        assert "access_token" in sc and "HttpOnly" in sc


# ------- Students CRUD + Ownership -------
class TestStudents:
    def test_crud_and_ownership(self, fresh_user, admin_token):
        token = fresh_user["token"]
        # Create
        payload = {"name": "TEST_Alice", "grade": "10", "attendance_pct": 92,
                   "study_hours": 3, "sleep_hours": 8, "prev_marks": 78,
                   "parental_support": "high", "extracurriculars": 2,
                   "internet_access": True, "tutor": False}
        r = requests.post(f"{API}/students", json=payload, headers=H(token), timeout=15)
        assert r.status_code == 200, r.text
        s = r.json()
        sid = s["id"]
        assert s["name"] == "TEST_Alice" and s["owner_id"] == fresh_user["id"]
        assert "_id" not in s

        # List - only own students
        r = requests.get(f"{API}/students", headers=H(token), timeout=15)
        assert r.status_code == 200
        lst = r.json()
        assert any(x["id"] == sid for x in lst)
        for x in lst:
            assert x["owner_id"] == fresh_user["id"]
            assert "_id" not in x

        # Get by id
        r = requests.get(f"{API}/students/{sid}", headers=H(token), timeout=15)
        assert r.status_code == 200 and r.json()["id"] == sid

        # Ownership: admin should NOT see this student
        r = requests.get(f"{API}/students/{sid}", headers=H(admin_token), timeout=15)
        assert r.status_code == 404

        # Update
        payload["attendance_pct"] = 95
        r = requests.put(f"{API}/students/{sid}", json=payload, headers=H(token), timeout=15)
        assert r.status_code == 200 and r.json()["attendance_pct"] == 95

        # Delete by non-owner -> 404
        r = requests.delete(f"{API}/students/{sid}", headers=H(admin_token), timeout=15)
        assert r.status_code == 404

        # Owner deletes
        r = requests.delete(f"{API}/students/{sid}", headers=H(token), timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/students/{sid}", headers=H(token), timeout=15)
        assert r.status_code == 404


# ------- Prediction + AI (slow) -------
class TestPrediction:
    @pytest.fixture(scope="class")
    def student_for_pred(self, fresh_user):
        token = fresh_user["token"]
        payload = {"name": "TEST_Pred", "grade": "11", "attendance_pct": 88,
                   "study_hours": 3.5, "sleep_hours": 7.5, "prev_marks": 82,
                   "parental_support": "high", "extracurriculars": 1,
                   "internet_access": True, "tutor": True}
        r = requests.post(f"{API}/students", json=payload, headers=H(token), timeout=15)
        assert r.status_code == 200
        return {"sid": r.json()["id"], "token": token, "payload": payload}

    def test_predict_student(self, student_for_pred):
        sid = student_for_pred["sid"]; token = student_for_pred["token"]
        r = requests.post(f"{API}/students/{sid}/predict", headers=H(token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert 0 <= d["score"] <= 100
        assert d["band"] in ("excellent", "good", "average", "at_risk")
        assert isinstance(d["factors"], dict) and len(d["factors"]) > 0
        assert isinstance(d["contributions"], dict)
        assert isinstance(d["insight"], str) and len(d["insight"]) > 5
        assert isinstance(d["recommendations"], list) and len(d["recommendations"]) >= 1
        assert "_id" not in d

        # Student last_predicted_score updated
        r2 = requests.get(f"{API}/students/{sid}", headers=H(token), timeout=15)
        s = r2.json()
        assert s["last_predicted_score"] == d["score"]
        assert s["last_band"] == d["band"]

        # History sorted desc
        r3 = requests.get(f"{API}/students/{sid}/predictions", headers=H(token), timeout=15)
        assert r3.status_code == 200
        hist = r3.json()
        assert len(hist) >= 1
        if len(hist) > 1:
            assert hist[0]["created_at"] >= hist[1]["created_at"]

    def test_predict_quick_no_persist(self, fresh_user):
        token = fresh_user["token"]
        payload = {"name": "TEST_Quick", "grade": "9", "attendance_pct": 70,
                   "study_hours": 1, "sleep_hours": 6, "prev_marks": 55,
                   "parental_support": "low", "extracurriculars": 0,
                   "internet_access": True, "tutor": False}
        r = requests.post(f"{API}/predict-quick", json=payload, headers=H(token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "score" in d and "band" in d and "insight" in d
        assert isinstance(d["recommendations"], list)
        # Confirm no persisted student named TEST_Quick
        r2 = requests.get(f"{API}/students", headers=H(token), timeout=15)
        assert all(s["name"] != "TEST_Quick" for s in r2.json())


# ------- Dashboard + CSV -------
class TestDashboardCsv:
    def test_dashboard(self, fresh_user):
        r = requests.get(f"{API}/dashboard", headers=H(fresh_user["token"]), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_students", "avg_score", "at_risk_count", "top_performer", "band_counts", "recent_predictions"):
            assert k in d
        assert isinstance(d["band_counts"], dict)

    def test_export_csv(self, fresh_user):
        r = requests.get(f"{API}/students/export/csv", headers=H(fresh_user["token"]), timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        first_line = r.text.splitlines()[0]
        for col in ("name", "grade", "attendance_pct", "last_predicted_score"):
            assert col in first_line

    def test_import_csv(self, fresh_user):
        token = fresh_user["token"]
        csv_data = ("name,grade,attendance_pct,study_hours,sleep_hours,prev_marks,"
                    "parental_support,extracurriculars,internet_access,tutor,notes\n"
                    "TEST_Imp1,10,90,3,8,75,medium,1,True,False,n1\n"
                    "TEST_Imp2,11,60,1,5,40,low,0,False,False,n2\n")
        files = {"file": ("students.csv", io.BytesIO(csv_data.encode()), "text/csv")}
        r = requests.post(f"{API}/students/import/csv", files=files,
                          headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["inserted"] == 2
        # Verify persisted
        r2 = requests.get(f"{API}/students", headers=H(token), timeout=15)
        names = [s["name"] for s in r2.json()]
        assert "TEST_Imp1" in names and "TEST_Imp2" in names
