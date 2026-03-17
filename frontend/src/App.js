import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

export default function App() {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me anything and I’ll stream the answer." }
  ]);

  const listRef = useRef(null);
  const controllerRef = useRef(null);       // to abort on unmount
  const assistantIndexRef = useRef(null);   // ensures chunks append to the correct message

  // Auto‑scroll when new content arrives
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Abort in‑flight request on unmount (no Stop button in UI)
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, []);

  const send = async () => {
    setError("");
    const msg = input.trim();
    if (!msg) {
      setError("Please type a message.");
      return;
    }
    if (streaming) return;

    // 1) append user message
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setInput("");
    setStreaming(true);

    // 2) append empty assistant message and capture its exact index
    setMessages(prev => {
      const idx = prev.length;            // this will be the new assistant message index
      assistantIndexRef.current = idx;
      return [...prev, { role: "assistant", content: "" }];
    });

    // 3) POST and stream back
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch("/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        // 4) append chunk to last assistant bubble (Markdown will render it)
        const idx = assistantIndexRef.current;
        setMessages(prev => {
          const next = [...prev];
          next[idx] = {
            role: "assistant",
            content: (next[idx]?.content || "") + chunk
          };
          return next;
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") setError("Stream ended or failed.");
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-center text-lg font-semibold text-slate-800">AI Chatbot</h1>
        </div>
      </header>

      {/* Messages (top) */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4">
          <div ref={listRef} className="h-[70vh] overflow-y-auto py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap
                  ${m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"}`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    // Assistant messages render as Markdown (with GFM: lists, tables, fenced code)
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex items-center gap-2 text-slate-500 text-sm pl-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500" />
                </span>
                <span>Generating…</span>
              </div>
            )}

            {error && (
              <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 text-sm w-fit">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Composer (bottom) */}
      <footer className="border-t bg-white">
        <div className="max-w-3xl mx-auto w-full px-4 py-3">
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Type your message and press Enter…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              disabled={streaming}
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
