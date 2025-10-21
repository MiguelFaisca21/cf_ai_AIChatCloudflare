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

5. After a successful deployment, Wrangler will show the worker's URL. This URL will be used to enable the REACT frontend to communicate with the deployed worker:
   ```
   https://your-worker-name.username.workers.dev
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
3. Go to src/config.ts and change the variable to the previously deployed worker's URL:
   ```
   export const WORKER_DOMAIN = "https://your-worker-name.username.workers.dev";
   ```

4. Start React Frontend:
   ```bash
   npm start
   ```
---

## Re-deploying Updates locally, if needed 

### For Worker changes:
```bash
cd worker
npx wrangler deploy
```

### For Frontend changes:
```bash
cd frontend
npm start
```

---
