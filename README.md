# QA Launch

A monorepo system for automated website scanning using:

- **Next.js frontend** for the user interface
- **Playwright VPS service** for headless browser scanning

---

## Project Structure

```bash
qa-launch/
├── web/                # Next.js frontend (Vercel)
│   ├── app/
│   ├── package.json
│   └── next.config.js
│
├── vps/                # Playwright scanning service (VPS/Docker)
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
├── .gitignore
└── README.md
```

---

## System Overview

### Flow

1. User submits a URL from the **Next.js app**
2. Backend sends a scan request to the **VPS Playwright service**
3. Playwright:
   - Opens the target website
   - Runs scan checks
   - Collects results
   - Returns a structured JSON report
4. Frontend displays the results

---

## Tech Stack

### `web/`
- Next.js
- Tailwind CSS
- API routes / Server Actions

### `vps/`
- Node.js
- Playwright
- Docker
- Optional queue worker

---

## Installation

### 1) Clone the repository

```bash
git clone https://github.com/yourname/qa-launch.git
cd qa-launch
```

### 2) Install and run the frontend

```bash
cd web
npm install
npm run dev
```

The app will run at:

```bash
http://localhost:3000
```

### 3) Install and run the VPS service

```bash
cd ../vps
npm install
npm run dev
```

Or run with Docker:

```bash
docker build -t qa-playwright .
docker run -p 3000:3000 qa-playwright
```

---

## Deployment

### Frontend on Vercel

Set the **root directory** to:

```bash
web/
```

Deploy the frontend normally on Vercel.

### VPS on your server

```bash
git clone https://github.com/yourname/qa-launch.git
cd qa-launch/vps

docker build -t qa-playwright .
docker run -d -p 3000:3000 qa-playwright
```

---

## API Communication

Example request from the frontend to the VPS service:

```ts
await fetch("http://your-vps-ip:3000/scan", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_SECRET_TOKEN",
  },
  body: JSON.stringify({
    url: "https://example.com",
  }),
});
```

---

## Security

- Use an API token between Vercel and VPS
- Do not expose the Playwright service without authentication
- Store secrets in `.env`

Example:

```bash
SCAN_API_SECRET=supersecretkey
```

---

## Important Rules

- Do **not** deploy Playwright on Vercel
- Do **not** mix `node_modules` between `web/` and `vps/`
- Do **not** commit `.env`
- Keep `web/` and `vps/` independent
- Communicate between them only through API calls

---
