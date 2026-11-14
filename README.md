# SupportPilot AI v2.0 — Agentic Customer Support SaaS Platform

SupportPilot AI is a production-quality, agentic customer support SaaS platform designed specifically for modern e-commerce brands. Built with **React 18 + TypeScript**, **Tailwind CSS**, **Python FastAPI**, **Pydantic v2**, **MongoDB Atlas**, and **Google Gemini**, the platform automates routine inquiries, investigates live orders, enforces deterministic business guardrails, escalates high-risk cases to human review queues, and provides observable execution traces.

---

## 1. System Architecture & The 6-Stage AI Pipeline

Every customer message or proactive webhook is processed through a deterministic, observable 6-stage execution pipeline:

```
Customer Message / Webhook
          │
          ▼
┌─────────────────────────────────┐
│ 1. PII Redaction & Sanitization │ ──> Regex masks Credit Cards, SSNs, CVVs & Phone Numbers
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 2. Customer & Order Context     │ ──> Retrieves Customer 360 profile, LTV, orders, and carrier status
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 3. Intent & Sentiment Analysis  │ ──> Classifies intent, sentiment, urgency & VIP churn risk
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 4. Policy RAG Retrieval         │ ──> Semantic BM25/Cosine match across official store policies
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 5. Deterministic Guardrails     │ ──> Strict server-side verification of caps, status & return windows
└─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│ 6. Action Routing & Execution   │ ──> Confidence >= 90% + clean guardrail ──> Autonomous Auto-Pilot
└─────────────────────────────────┘     Confidence < 90% OR gated action   ──> Human "Needs Approval" Queue
```

---

## 2. Deterministic Backend Guardrails & Agent Tools

SupportPilot AI enforces hard code guardrails on all agent actions: **AI confidence alone never authorizes sensitive operations**.

| Permitted Tool | Description | Deterministic Backend Guardrail |
| :--- | :--- | :--- |
| `lookup_customer` | Retrieves customer 360 profile, order history, and cumulative LTV. | Read-only. Workspace-isolated. |
| `lookup_order` | Investigates tracking, carrier milestones, and order items. | Read-only. Verifies matching customer ownership. |
| `retrieve_policies` | Retrieves store policy sections by topic using semantic RAG. | Read-only. Active policies only. |
| `update_shipping_address` | Updates order destination address. | **Strict Pre-Dispatch Rule:** Strictly blocked if order status is anything other than `unfulfilled` (e.g. `in_transit`, `delayed`, `delivered`). |
| `issue_store_credit` | Issues courtesy goodwill store credit. | **Financial Hard Cap:** Maximum credit per order is capped at **$50.00** (or order total). Credits exceeding cap are blocked or gated for human approval. |
| `generate_rma_label` | Generates prepaid USPS return authorization labels. | **30-Day Window:** Strictly blocked unless order status is `delivered` within the past 30 days. |
| `escalate_ticket` | Generates a 3-bullet structured escalation summary. | Triggered automatically when confidence is below threshold or customer exhibits **VIP_CHURN_RISK**. |

---

## 3. UI/UX Design System

Engineered with the clarity, typography, and aesthetic restraint of **Linear**, **Stripe Dashboard**, and **Vercel**:
- **Palette**: Clean white (`#ffffff`) and subtle neutral-gray backgrounds (`#f8fafc`, `#f1f5f9`) with slate/neutral accents.
- **Typography**: Crisp Inter font hierarchy with 4–8px spacing increments and 6–10px corner radii.
- **Restraint**: Zero glowing neon gradients, zero glassmorphism clichés, zero fake placeholder statistics.
- **Observable Audit Inspector**: Collapsible execution trace inspecting actual tool inputs, outputs, and PII redactions without fabricating hidden chain-of-thought.

---

## 4. Key Application Views

1. **Overview Dashboard**: High-level operational metrics: Total Inquiries, Open Tickets, Needs Approval Queue count, Autonomous Deflection Rate %, AI Draft Edit Rate %, and Estimated Hours Saved.
2. **Support Inbox**: Master-detail conversation interface with search, priority filters, customer 360 card, carrier tracking card, and message composer with AI draft injection.
3. **Needs Approval**: Dedicated human-in-the-loop review queue for gated store actions, low-confidence predictions, and 3-bullet escalation summaries. Allows 1-click **Approve**, **Edit & Approve** (records continuous edit distance feedback), or **Reject**.
4. **VIP / Critical Queue**: Specialized queue highlighting customers with **cumulative spend > $200** and negative sentiment (**`VIP_CHURN_RISK`**).
5. **Customer Directory**: Customer 360° profiles with LTV, order counts, sentiment meter, and ticket history.
6. **Orders & Fulfillment**: Complete warehouse order table with interactive buttons to test pre-dispatch address locking, $50 store credit limits, and 30-day RMA generation.
7. **AI Agent Workspace**: Interactive pipeline playground to test inquiries, toggle between Live Gemini mode and Deterministic Guardrail Simulation mode, and inspect audit traces.
8. **Knowledge Base**: Policy management and interactive Policy RAG Search Tester.
9. **Automations**: Rules engine with proactive carrier delay webhook triggers and SLA escalations.
10. **Analytics**: Calculated charts for 7-day deflection trends, sentiment distribution, and tool usage.
11. **Settings**: Workspace parameters, safety limits, and integration webhook URLs.
12. **Customer Portal**: Customer-owned inquiries, replies, policy citations, and order history with strict ownership filtering.

---

## 5. Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, Vite.
- **Backend**: Python 3.12, FastAPI, Pydantic v2, PyJWT, HTTPX.
- **Database**: MongoDB Atlas (`motor` / `pymongo`), with automatic zero-configuration fallback to local workspace-isolated `AsyncMockMotorDatabase` persisted to `backend/data/store.json`.
- **AI Engine**: Google Gemini API (`gemini-2.0-flash`, `gemini-1.5-pro`) with structured outputs and fallback to the Deterministic Guardrail Simulation Engine.

---

## 6. Getting Started

### Prerequisites
- Node.js v18+ and npm
- Python 3.10+

### Option A: Run Unified Application (Recommended)
FastAPI automatically serves both the backend API and the compiled React frontend:

```bash
npm start
```

This single command compiles the current frontend and starts the unified FastAPI server.

The application is now live at **`http://localhost:8000`**!

### Option B: Run in Development with Vite Hot Reload

```bash
# Terminal 1: Backend
backend/venv/bin/python3 -m uvicorn backend.app.main:app --port 8000 --ws none

# Terminal 2: Frontend with HMR
npm run dev
```
Visit **`http://localhost:5173`** for instant frontend hot-module reloading.

---

## 7. Deploy Frontend + Backend Together on Vercel

This repository is one Vercel project:

- Vite builds the frontend into `dist/` and Vercel serves it at `/`.
- `api/index.py` exposes the FastAPI backend as one Python function at `/api/*`.
- `vercel.json` keeps API rewrites ahead of the React SPA fallback and registers the daily follow-up cron supported by Vercel Hobby.
- The browser uses the same-origin `/api` URL, so no separate frontend URL or CORS environment variable is required.

### Environment

Use one environment file for both sides:

```bash
cp .env.example .env
```

Replace the MongoDB URI and all three secrets. `GEMINI_API_KEY` is optional. In Vercel, use **Import .env** to upload the completed local `.env` values for Production and Preview. Do not commit `.env`.

MongoDB Atlas is required for durable data on Vercel because a serverless function's local `/tmp` storage is temporary. Allow network access from Vercel in the Atlas network settings.

Production deployments fail closed if MongoDB or any required secret is missing. Demo accounts remain available on Vercel, CORS is limited to configured origins, and login/registration requests are rate limited. Set both `DEMO_MODE=false` and `VITE_DEMO_MODE=false` only if you want to disable demo access later.

### Deploy

Import the repository into Vercel with the repository root as the **Root Directory**. The committed configuration already sets the build command and output directory, so no second Vercel project is needed. You can also deploy from the root with:

```bash
npx vercel
npx vercel --prod
```

After deployment, verify these URLs on the same domain:

```text
https://YOUR-PROJECT.vercel.app/
https://YOUR-PROJECT.vercel.app/api/health
```

---

## 8. Local Demo Accounts & 1-Click Login

SupportPilot AI features dedicated **1-Click Demo Logins** directly on the sign-in screen and an in-app **Role Switcher** in the top navigation header. They remain enabled in the Vercel deployment:

| Role | Demo User | Email | Password | Scope & Privileges |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Admin** | Alexander Hayes | `admin@aerowear.com` | `admin123` | Full workspace administration, safety caps, AI model configuration, and store policy management. |
| **Support Specialist** | Sarah Jenkins | `sarah.support@aerowear.com` | `agent123` | Support Inbox triage, live conversations, review queue approvals, draft edits, and store action execution. |
| **Support Auditor** | Elena Rostova | `viewer@aerowear.com` | `viewer123` | Read-only analytics, observable audit traces inspection, and deflection metrics monitoring. |
| **Customer** | Sophia Rodriguez | `customer@aerowear.com` | `customer123` | Own support inquiries, conversation replies, cited policies, and own order history only. |

*To switch between demo roles at any point without logging out, click the active user profile in the top-right header.*

---

## 9. Running the Backend Test Suite

The comprehensive backend integration test suite validates authentication, guardrails, $50 credit caps, pre-dispatch address locks, PII redaction, and proactive webhooks:

```bash
npm test       # backend integration + SRS acceptance suite
npm run verify # tests plus production frontend build
```

The acceptance suite covers authentication and RBAC, workspace/customer isolation, the 90% confidence gate, strict Gemini schema validation, citations, PII redaction, idempotent order actions and signed webhooks, protected follow-up cron processing, and simulated catalog data.
