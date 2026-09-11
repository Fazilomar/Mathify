# Mathify: Academic Mathematical Social Hub & Olympiad Arena

A full-stack mathematical collaboration and competition platform built with **Django REST Framework** (Backend) and **React + Vite** (Frontend).

---

## Project Architecture

```
stitch_mathify_social_hub/
├── backend/                  # Django REST API
│   ├── accounts/             # Authentication, Profiles & RBAC
│   ├── ai_tutor/             # AI Mathematics Tutor (Gemini Integration)
│   ├── feed/                 # Academic Social Feed, Notes & Discussions
│   ├── library/              # Mathematical Manuscript & Paper Repository
│   ├── mathify/              # Project Settings & WSGI Entrypoint
│   ├── rankings/             # Competitions, Axiom Points & Leaderboards
│   ├── social/               # Study Groups, Real-Time Rooms & Calls
│   ├── studio/               # Interactive LaTeX Proof Studio
│   ├── requirements.txt      # Python Dependencies
│   └── vercel.json           # Vercel Serverless WSGI Deployment
├── frontend/                 # React 18 + Vite SPA
│   ├── src/                  # Components, Pages, Contexts & Hooks
│   ├── package.json          # Node Dependencies
│   └── vercel.json           # Vercel SPA Routing & Rewrites
├── .gitignore
└── README.md
```

---

## Deploying to Vercel (Separately from Unified Monorepo)

### 1. Deploy the Backend

1. Go to [Vercel Dashboard](https://vercel.com/new) and import this GitHub repository (`Mathify`).
2. In the project configuration:
   - **Project Name**: e.g., `mathify-backend`
   - **Root Directory**: Click **Edit** and select **`backend`**.
   - **Framework Preset**: **Other** (Vercel automatically detects Python with `vercel.json`).
3. Under **Environment Variables**, add:
   - `SECRET_KEY`: A strong random string.
   - `DEBUG`: `False`
   - `ALLOWED_HOSTS`: `*`
   - `DATABASE_URL`: Your PostgreSQL connection string (from Neon, Supabase, Vercel Postgres, or AWS RDS).
   - `GEMINI_API_KEY`: Your Google Gemini API key.
4. Click **Deploy**. Note down your deployed backend URL (e.g., `https://mathify-backend.vercel.app`).

---

### 2. Deploy the Frontend

1. In [Vercel Dashboard](https://vercel.com/new), import the same GitHub repository again.
2. In the project configuration:
   - **Project Name**: e.g., `mathify-frontend`
   - **Root Directory**: Click **Edit** and select **`frontend`**.
   - **Framework Preset**: **Vite**.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Under **Environment Variables**, add:
   - `VITE_API_URL`: The URL of your deployed backend (e.g., `https://mathify-backend.vercel.app`).
4. Click **Deploy**.

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to test locally.
