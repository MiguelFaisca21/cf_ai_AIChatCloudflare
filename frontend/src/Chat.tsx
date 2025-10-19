import { useEffect, useRef, useState } from "react";
import { WORKER_DOMAIN } from "./config";

export default function Chat() {
  //useState so that UI updates
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string}[]>([]);
  const [pendingAI, setPendingAI] = useState("");
  const [isAITyping, setIsAITyping] = useState(false);

  //useRef to persist across renders 
  const wsRef = useRef<WebSocket | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingAIRef = useRef("");
  const isAITypingRef = useRef(false);

  useEffect(() => {
    pendingAIRef.current = pendingAI;
  }, [pendingAI]);

  useEffect(() => {
    isAITypingRef.current = isAITyping;
  }, [isAITyping]);

  useEffect(() => {
    if (!username) return;

    const ws = new WebSocket(`ws://${WORKER_DOMAIN}/chat?user=${username}`);
    wsRef.current = ws;

    fetch(`http://${WORKER_DOMAIN}/history?user=${username}`)
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
    wsRef.current?.send("_STOP_");
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, pendingAI]);

  if (!username) {
    return (
      <div style={{ maxWidth: 400, margin: "3rem auto", textAlign: "center" }}>
        <h2>Welcome to AI Chat</h2>
        <p>Please enter your username:</p>
        <input
          style={{
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ccc",
            width: "80%",
          }}
          placeholder="Type your username..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const value = e.currentTarget.value.trim();
              if (value) setUsername(value);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Chatting as {username}</h2>
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
            placeholder={isAITyping ? "AI is responding..." : "Type your message..."}
          disabled={isAITyping}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isAITyping) { 
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
              if (isAITyping) return;
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
