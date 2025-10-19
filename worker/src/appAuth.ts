import { DurableObject } from "cloudflare:workers";
import { SignJWT, jwtVerify } from "jose";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALLBACK_DOMAIN = "https:// /auth/callback";

async function createSession(user: any, secret: Uint8Array) {
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);
  return token;
}

async function validateSession(request: Request, secret: Uint8Array) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], secret);
    return payload;
  } catch {
    return null;
  }
}

export class AIChat extends DurableObject<Env> {
  private history: Array<{ role: string; content: string }> = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const stored = await this.ctx.storage.get<typeof this.history>("history");
    if (stored) this.history = stored;

    if (pathname === "/history" && request.method === "GET") {
      console.log("History fetched")
      return Response.json(this.history);
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      console.log("WebSocket connection established for user");

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Unsupported request", { status: 400 });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const input = String(message || "").trim();
    this.history.push({ role: "user", content: input });

    try {
      const stream = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: this.history,
        stream: true
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          console.log(payload)
          if (!payload) continue;
          if (payload === "[DONE]") {
            ws.send("\n");
            buffer = "";
            continue;
          }
          try {
            const json = JSON.parse(payload);
            const token = json.response || "";
            if (token) {
              ws.send(token);
              assistantMessage += token;
            }
          } catch {
            buffer = line + "\n" + buffer;
          }
        }
      }

      if (assistantMessage.trim()) {
        console.log("Adding to history:", assistantMessage);
        this.history.push({ role: "assistant", content: assistantMessage });
        await this.ctx.storage.put("history", this.history);
      }
    } catch (err: any) {
      console.error("AI error:", err);
      ws.send("AI request failed");
    } 
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log(`WebSocket closed: ${code} - ${reason}`);
  }

}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
    const url = new URL(request.url);

    // 🔹 Step 1: Start Google login
    if (url.pathname === "/auth/login/google") {
      console.log("Entered login");
      const redirect = new URL(GOOGLE_AUTH_URL);
      redirect.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: CALLBACK_DOMAIN,
        response_type: "code",
        scope: "openid email profile",
        state: crypto.randomUUID(),
      }).toString();

      return Response.redirect(redirect.toString(), 302);
    }

    // 🔹 Step 2: Handle Google callback
    if (url.pathname === "/auth/callback") {
      console.log("Entered callback");
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: CALLBACK_DOMAIN,
          grant_type: "authorization_code",
        }),
      });

      const tokens = (await tokenRes.json()) as {
        access_token?: string;
        id_token?: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      };

      if (!tokens.id_token) return new Response("Failed to get token", { status: 400 });

      const [, payloadBase64] = tokens.id_token.split(".");
      const payload = JSON.parse(atob(payloadBase64));

      const session = await createSession(
        { email: payload.email, name: payload.name },
        JWT_SECRET
      );

      console.log(session);

      return new Response("Logged in!", {
        status: 302,
        headers: {
          "Set-Cookie": `session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax`,
          "Location": "/", // Redirect back to frontend
        },
      });
    }

    // 🔹 Step 3: Auth check
    if (url.pathname === "/auth/me") {
      const user = await validateSession(request, JWT_SECRET);
      console.log("Inside auth me:"+user);
      if (!user) return new Response("Not logged in", { status: 401 });
      return Response.json(user);
    }

    const user = await validateSession(request, JWT_SECRET);
    if (!user) return new Response("Unauthorized", { status: 401 });

    const userId = user.email as any;
    const id = env.AIChat.idFromName(userId);
    const obj = env.AIChat.get(id);

    console.log("User id:"+id);

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      return obj.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const res = await obj.fetch(request);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    return new Response(res.body, { ...res, headers: corsHeaders });
  },
};


