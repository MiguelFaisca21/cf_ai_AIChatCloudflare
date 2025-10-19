import { DurableObject } from "cloudflare:workers";

export class AIChat extends DurableObject<Env> {
  private history: Array<{ role: string; content: string }> = [];
  private streamAbortController: AbortController | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const stored = await this.ctx.storage.get<typeof this.history>("history");
    if (stored) this.history = stored;

    if (pathname === "/history" && request.method === "GET") {
      return Response.json(this.history);
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (pathname === "/chat"  && request.method === "GET" && upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      //console.log("WebSocket connection established for user");
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Unsupported endpoint", { status: 400 });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const input = String(message || "").trim();

    if (input === "_STOP_") {
      if (this.streamAbortController) {
        this.streamAbortController.abort();
        this.streamAbortController = null;
      }
      return;
    }
  
    this.history.push({ role: "user", content: input });

    const abortController = new AbortController();
    this.streamAbortController = abortController;

    try {
      const stream = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: this.history,
        stream: true
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";
      let buffer = "";

      while (true) {
        if (abortController.signal.aborted) {
          //console.log("aborted ai stream");
          ws.send("\n");
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          //TODO: remove hardcoded 5 as how payload is structured
          const payload = line.slice(5).trim();
          //console.log(payload)
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
              aiResponse += token;
            }
          } catch {
            buffer = line + "\n" + buffer;
          }
        }
      }

      if (!abortController.signal.aborted && aiResponse.trim()) {
        //console.log("Adding to history:", assistantMessage);
        this.history.push({ role: "assistant", content: aiResponse });
        await this.ctx.storage.put("history", this.history);
      }
    } catch (err: any) {
      if (abortController.signal.aborted) {
        //console.log("AI generation aborted by user");
      } else {
        //console.error("AI error:", err);
        ws.send("AI request failed");
      }
    } finally {
      this.streamAbortController = null; 
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    //console.log(`WebSocket closed: ${code} - ${reason}`);
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
  }

}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user");
    if (!userId) return new Response("Missing user ID", { status: 400 });

    const id = env.AIChat.idFromName(userId);
    const durableObject = env.AIChat.get(id);

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      return durableObject.fetch(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders()});
    }

    const res = await durableObject.fetch(request);
    return new Response(res.body, {...res, headers: {...corsHeaders(), ...(res.headers || {})}});
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}


