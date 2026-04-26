# PRD — Scholar.ai (Student Performance Predictor)

## Original problem statement
"create a student performance preditor app"

## User choices (locked)
- Prediction approach: Rule-based formula + AI-powered narrative (Claude Sonnet 4.5)
- Auth: JWT email + password
- Target users: Teachers (multi-student) AND Individual students (self-prediction)
- Features: history, charts, AI recommendations, CSV import/export
- Visual style: highly modern, purple theme (deep aubergine + electric violet)

## Architecture
- Backend: FastAPI + Motor (MongoDB) + PyJWT + bcrypt + emergentintegrations (Claude Sonnet 4.5)
- Frontend: React 19, react-router 7, recharts, sonner, tailwind, custom purple aubergine glassmorphism theme (Outfit + Manrope)
- Auth: httpOnly cookies (samesite=none, secure) **and** Bearer token fallback in localStorage
- DB collections: users, students, predictions, login_attempts, password_reset_tokens

## User personas
1. Teacher — manages a class roster, runs predictions, exports CSVs.
2. Student — self-predicts via Quick Predict tab.
3. Admin — seeded on startup (admin@example.com / admin123).

## Implemented (2026-02)
- Auth: register / login / logout / me with JWT (cookies + Bearer)
- Students CRUD scoped to owner_id
- Rule-based predictor (8 weighted factors, 4 bands)
- AI insight + recommendations via Claude Sonnet 4.5 (with graceful fallback)
- Quick Predict (no persist)
- Dashboard KPIs (total / avg / at-risk / top-performer / band breakdown / recent)
- Charts: bar, pie, radar, contributions, score trend
- CSV export & import
- Purple aubergine glassmorphism UI (Outfit + Manrope)

## Test status
- Backend pytest: 11/11 pass
- Frontend: all pages render, login/register/predict flow validated

## Next phase backlog
- P0: per-student prediction comparison
- P1: bulk-predict button on Students list
- P1: shareable read-only student report link
- P2: subject-level scoring (math/science/etc.)
- P2: notifications when a student drops to "at risk"
- P2: PDF export of student report
