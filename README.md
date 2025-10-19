# Simple Cloudflare Worker AI Project

This project contains two main parts:

1. **`worker/`** — the implemented Cloudflare's Worker AI 
2. **`frontend/`** — a React-based frontend interface to interact with the deployed worker

---

## 1. Deploy Cloudflare Worker

### **Steps**

1. Go to the `worker` folder:
   ```bash
   cd worker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Log in to Cloudflare for access to permissions:
   ```bash
   npx wrangler login
   ```

4. Deploy your Worker:
   ```bash
   npx wrangler deploy
   ```

5. After a successful deployment, Wrangler will show the worker's URL:
   ```
   https://your-worker-name.username.workers.dev
   ```

6. Go to src/config.ts and change the variable to the worker's URL:
   ```
   export const WORKER_DOMAIN = "https://your-worker-name.username.workers.dev";
   ```
---

## 2. Set Up React Frontend

### **Steps**

1. Go to the `frontend` folder:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a environment file:
   ```bash
   cp .env.example .env
   ```

4. Open the newly created environment file `.env` and replace the placeholder with the Worker's URL:
   ```env
   VITE_WORKER_URL=https://your-worker-name.username.workers.dev
   ```
5. Start React Frontend:
   ```bash
   npm run dev
   ```
---

## Re-deploying Updates, if needed 

### For Worker changes:
```bash
cd worker
npx wrangler deploy
```

### For Frontend changes:
```bash
cd frontend
npm run build
```

---
