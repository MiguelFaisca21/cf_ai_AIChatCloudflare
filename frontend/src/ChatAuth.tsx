import { useEffect, useRef, useState } from "react";

export default function Chat() {
  //useState so that the UI updates
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string}[]>([]);
  const [pendingAI, setPendingAI] = useState("");
  const [isAITyping, setIsAITyping] = useState(false);
  const [userLoading, setUserLoading] = useState(true);

  //useRef to persist across renders 
  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingAIRef = useRef("");
  const isAITypingRef = useRef(false);

  //const domain = "127.0.0.1:8787";
  const domain = "aichat-worker.miguel-faisca-carvalho.workers.dev";

  useEffect(() => {
    fetch(`https://${domain}/auth/me`, { credentials: "include" })
      .then(async res => {
        if (!res.ok) {
          console.log("Not logged in:", await res.text());
          setUserLoading(false);
          return;
        }
        const user = await res.json();
        console.log("Authenticated user:", user);
        setUsername(user.email);
        setUserLoading(false);
      })
      .catch(err => {
        console.error("Auth check failed:", err);
        setUserLoading(false);
      });
  }, []);
  
  useEffect(() => {
    pendingAIRef.current = pendingAI;
  }, [pendingAI]);

  useEffect(() => {
    isAITypingRef.current = isAITyping;
  }, [isAITyping]);

  useEffect(() => {
    if (!username) return;

    const ws = new WebSocket(`wss://${domain}/chat?user=${username}`);
    wsRef.current = ws;

    // Load chat history
    fetch(`https://${domain}/history?user=${username}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setMessages(data || []);
        console.log(data);
      });

    ws.onmessage = (e) => {
      const text = e.data;
      if (text !== "\n") {
        if (!isAITypingRef.current) setIsAITyping(true);
        setPendingAI((prev) => prev + text);
      } else {
        const finalText = pendingAIRef.current.trim();
        if (finalText) {
          setMessages((prev) => [...prev, { role: "ai", content: finalText }]);
          setPendingAI(""); 
          setIsAITyping(false);
        }
      }
    };

    return () => {};
  }, [username]);


  const sendMessage = (text: string) => {
    if (!text.trim() || !wsRef.current) return;
    wsRef.current?.send(text);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  };

  const interruptAI = () => {
    wsRef.current?.send("__STOP__");
  };

  // Auto-scroll on new messages or streaming tokens
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, pendingAI]);

  if (!username) {
    if (userLoading) {
      return <p style={{ textAlign: "center", marginTop: "3rem" }}>Loading user...</p>;
    }
    return (
      <div style={{ maxWidth: 400, margin: "3rem auto", textAlign: "center" }}>
        <h2>Welcome to AI Chat</h2>
        <p>Please sign in to continue:</p>
        <a
          href={`https://${domain}/auth/login/google`}
          style={{
            display: "inline-block",
            background: "#4285F4",
            color: "white",
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: 600
          }}
        >
          Sign in with Google
        </a>
      </div>
    );
  }


  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>
        🤖 Cloudflare AI Chat
        <br />
        <small style={{ fontSize: "0.9rem", color: "#555" }}>
          Signed in as <strong>{username}</strong>
        </small>
      </h2>
      <div
        ref={chatContainerRef}
        style={{
          border: "1px solid #ccc",
          borderRadius: 10,
          background: "#fff",
          padding: 16,
          height: "60vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "#666",
                marginBottom: 2,
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              {m.role === "user" ? username : "AI"}
            </div>
            <div
              style={{
                background: m.role === "user" ? "#0078d7" : "#eee",
                color: m.role === "user" ? "white" : "black",
                borderRadius: 12,
                padding: "8px 12px",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pendingAI && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 2 }}>
              AI
            </div>
            <div
              style={{
                background: "#eee",
                color: "black",
                borderRadius: 12,
                padding: "8px 12px",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
              {pendingAI}
            </div>
          </div>
        )}

        {isAITyping && (
          <div
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              color: "#777",
              fontStyle: "italic",
              fontSize: "0.9rem",
              paddingLeft: 4,
              opacity: 0.8,
            }}
          >
            AI is typing<span className="dots">...</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
          placeholder="Type your message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage(e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
        />
        {isAITyping ? (
          <button
            style={{
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              background: "#d9534f",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={interruptAI}
          >
            Stop
          </button>
        ) : (
          <button
            style={{
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              background: "#0078d7",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>("input");
              if (input) {
                sendMessage(input.value);
                input.value = "";
              }
            }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
