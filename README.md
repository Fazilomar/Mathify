# Mathify: Community for STEM students most especially Mathematics students.

A full-stack mathematical collaboration and competition platform built with **Django REST Framework** (Backend) and **React + Vite** (Frontend).

---

## Project Architecture

```
stitch_mathify_social_hub/
├── backend/                  
│   ├── accounts/             
│   ├── ai_tutor/             
│   ├── feed/                 
│   ├── library/              
│   ├── mathify/              
│   ├── rankings/             
│   ├── social/               
│   ├── studio/               
│   ├── requirements.txt      
│   └── vercel.json           
├── frontend/                 
│   ├── src/                  
│   ├── package.json          
│   └── vercel.json          
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

## Mobile delivery at $0

The frontend includes an installable iOS PWA and a public `/download` page for
Android. iOS users open the site in Safari and choose **Share -> Add to Home
Screen**. Android builds are produced by `.github/workflows/build-apk.yml` on
GitHub-hosted runners. Every `main` build is available as an Actions artifact;
version tags (`v1.0.0`) also attach an unsigned debug APK to a GitHub Release.

The Capacitor wrapper in `frontend/capacitor.config.json` loads
`https://mathify-coral.vercel.app`, so merged frontend deployments appear in the
wrapper without rebuilding it. This requires network access on first load and
does not provide Play Store distribution or signed release publishing.

```bash
cd frontend
npm ci
npm run build
npm run lint

cd ..
python scripts/compress_images.py frontend/public
```

The Android application ID is `com.aliyudavid.mathify`. Keep it stable if the
native project is generated later for signed distribution. The frontend and
backend are deployed as separate Vercel projects, so active routing and cache
configuration remains in `frontend/vercel.json` and `backend/vercel.json`.
