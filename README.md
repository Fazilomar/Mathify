# Mathify: All-in-one social community for Math and STEM peeps.

A full-stack mathematical collaboration, proof authoring, and competitive problem-solving platform designed for university scholars, researchers, and STEM students. Mathify combines rigorous LaTeX mathematical typesetting, AI-assisted tutoring, synchronous group video calls, shared digital whiteboards, and a verified Point competition protocol.

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Frontend Client (React 18 + Vite)"]
        UI[Sleek Academic Dark UI]
        Router[React Router v6]
        AuthCtx[Auth Context & JWT Store]
        KaTeX[KaTeX LaTeX Engine]
        Whiteboard[Live Canvas Whiteboard]
        
        UI --> Router
        Router --> AuthCtx
        UI --> KaTeX
        UI --> Whiteboard
    end

    subgraph Gateway["API Gateway / Transport Layer"]
        HTTP[REST Endpoints /api/*]
        AuthHeaders[Bearer JWT Authentication]
        CORS[CORS Headers & Security Middleware]
    end

    subgraph Backend["Django REST Backend (Python 3)"]
        AuthApp["accounts (User Profiles & Credentials)"]
        FeedApp["feed (Discussions, KaTeX Posts, Media)"]
        StudioApp["studio (Proof Studio & Formal Lemmas)"]
        AITutorApp["ai_tutor (Gemini Socratic Tutor)"]
        SocialApp["social (Study Rooms, Calls, Whiteboard)"]
        CompApp["rankings & competitions (Axiom Point Protocol)"]
        LibApp["library (Monographs, Papers, Theorems)"]
    end

    subgraph External["External Services & Data Tier"]
        DB[(PostgreSQL Database)]
        Gemini[Google Gemini 1.5 Flash API]
        MediaStorage[Cloud Media / Image Storage]
    end

    Client -->|HTTPS / JSON| Gateway
    Gateway --> Backend
    Backend --> DB
    AITutorApp -->|Prompt Engineering & LaTeX Instruction| Gemini
    FeedApp --> MediaStorage
    SocialApp --> DB
```

---

## Core Modules & Features

### 1. Academic Feed & Mathematical Discourse
- **Real-Time KaTeX Typesetting**: Native parsing and rendering of both inline (`$...$`) and display (`$$...$$`) LaTeX equations.
- **Symbol Composer Toolbar**: Quick insertion of mathematical operators ($\forall$, $\exists$, $\in$, $\notin$, $\implies$, $\iff$, $\sum$, $\int$, $\mathbb{R}$, $\mathbb{C}$, $\mathbb{Z}$, $\mathbb{N}$, $\pi$, $\infty$, $\sqrt{}$).
- **Academic Endorsements & Discussions**: Peer-reviewed theorem discussions, mathematical question threads, image attachment support, and bookmarking.

### 2. Formal Proof Studio
- **Structured Theorem Verification**: Environment for composing formal mathematical proofs with theorem titles, lemmas, hypothesis assumptions, and Q.E.D. derivations.
- **Split-Pane Live Preview**: Simultaneous markdown and LaTeX compilation alongside raw notation input.
- **Subfield Tagging**: Classification across Pure & Applied Mathematics, Abstract Algebra, Real Analysis, Topology, Differential Geometry, and Number Theory.

### 3. AI Tutor (Powered by Google Gemini)
- **Assisted Learning**: Rigorous step-by-step guidance without handing out raw solutions, prompting scholars to discover lemmas independently.
- **LaTeX Math Output**: Enforces clean LaTeX notation for formulas and proofs.
- **Multi-Session Context**: Dynamic conversation management with persistent conversation history, session drawer, and quick mathematical inquiry chips.

### 4. Synchronous Study Rooms & Group Calls
- **Live Collaborative Rooms**: Peer-led rooms categorized into Study, Research, Problem Solving, and Departmental groups.
- **Off-Canvas Responsive Drawer**: Clean master-detail view on desktop, and a slide-out drawer on mobile for uncluttered screen space.
- **Group Calls**: Instant meeting initiation with unique codes (`mtf-xxx-xxx`) and direct links for academic groups.
- **Interactive Whiteboard**: Integrated digital whiteboard for freehand derivations, geometric constructions, and mathematical sketching.

### 5. Competitions & Axiom Point Protocol
- **Axiom Point Economy**: Strict academic scoring. Points are awarded **exclusively for solving and answering competition questions correctly** (+10 Points per validated answer).
- **Timed Mathematical Sprints**: Timed problem sets featuring varying difficulty tiers from foundational calculus to Olympiad-level combinatorics.
- **Institutional & Global Leaderboards**: Live scholar standings and university departmental rankings.

### 6. Curated Mathematical Library
- **Research Repository**: Centralized archive of mathematical monographs, lecture notes, formula sheets, and peer-reviewed publications.
- **Field Categorization**: Filter by discipline (Linear Algebra, Complex Analysis, Probability & Statistics, Discrete Mathematics, etc.).

---

## Project Structure

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
│   ├── manage.py
│   ├── requirements.txt
│   └── vercel.json               
├── frontend/                      
│   ├── public/
│   ├── src/
│   │   ├── api/                   
│   │   ├── assets/                
│   │   ├── components/
│   │   │   ├── common/            
│   │   │   ├── layout/           
│   │   │   └── seminar/           
│   │   ├── context/               
│   │   ├── pages/                 
│   │   ├── App.jsx                
│   │   ├── index.css              
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json                
├── .gitignore
└── README.md
```

---

## How It Works

### 1. Authentication & Route Protection
- Uses JSON Web Tokens (`access` and `refresh` tokens) managed via `AuthContext`.
- Unauthenticated visitors have access to the Landing / Welcome overview. All internal features (Feed, Proof Studio, Groups, AI Tutor, Library, Leaderboard) are guarded by `<ProtectedRoute>` which redirects unauthorized requests to `/login`.
- Global Axios/Fetch client automatically appends `Authorization: Bearer <token>` to outbound requests and handles silent token refresh upon expiration.

### 2. Mathematical Typesetting Pipeline
- LaTeX equations wrapped in `$..$` (inline) or `$$..$$` (display mode) are parsed by `<MathRenderer>`.
- KaTeX executes client-side rendering with error boundaries, preventing malformed equations from breaking page layouts.

### 3. Synchronous Collaboration Flow
- Scholars establish or join a Study Room under `/groups`.
- The room creator or host can initiate a **Live group call**; participants in the room receive real-time notification cards with one-click **Join Meeting** access.
- Simultaneous derivations are conducted via the shared **Whiteboard**, allowing multi-modal academic collaboration alongside the text chat.

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- PostgreSQL (or local SQLite for development)

### 1. Backend Setup
```bash
cd backend
python -m venv venv

# Activate virtual environment
venv\Scripts\activate 

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Backend API will be accessible at `http://127.0.0.1:8000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend development server will be running at `http://localhost:5173`.

---

## Academic Ethics & Axiom Protocol

Mathify strictly enforces mathematical authenticity:
1. **No Inflationary Scoring**: Points cannot be earned by social vanity metrics (likes, comments, profile visits). They reflect strictly verified mathematical problem-solving ability.
2. **Academic Integrity in AI Tutoring**: The AI Tutor operates under strict constraints to assist derivation methodology rather than solving academic assignments directly.
