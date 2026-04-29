import { useState, useRef, useEffect, useCallback } from "react";

const BACKEND = "https://hotel-tracker-hw3k.onrender.com";

// ── Category mapping for AI to use ───────────────────────────────────────────
const CATEGORY_MAP = {
  restaurant: { icon: "🍽️", label: "Restaurants" },
  bar: { icon: "🍸", label: "Bars" },
  cafe: { icon: "☕", label: "Cafes" },
  museum: { icon: "🏛️", label: "Museums" },
  tourist_attraction: { icon: "🗺️", label: "Attractions" },
  park: { icon: "🌿", label: "Parks" },
  shopping_mall: { icon: "🛍️", label: "Shopping" },
  spa: { icon: "💆", label: "Spa & Wellness" },
  night_club: { icon: "🎶", label: "Nightlife" },
  gym: { icon: "💪", label: "Gym" },
  pharmacy: { icon: "💊", label: "Pharmacy" },
  hospital: { icon: "🏥", label: "Hospital" },
  subway_station: { icon: "🚇", label: "Subway" },
  bus_station: { icon: "🚌", label: "Bus" },
  taxi_stand: { icon: "🚕", label: "Taxi" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const priceLabel = (level) => level != null ? "$".repeat(level + 1) : "";

function PlaceCard({ place, category }) {
  const cat = CATEGORY_MAP[category] || { icon: "📍", label: "" };
  return (
    <a href={place.maps_url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}>
      <div style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, padding: "14px 16px", marginBottom: 10,
        transition: "all 0.2s", cursor: "pointer",
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{cat.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#fff", fontFamily: "'Clash Display', sans-serif" }}>{place.name}</span>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{place.address}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {place.rating && (
                <span style={{ fontSize: 12, color: "#f5c842", fontWeight: 600 }}>
                  ★ {place.rating}
                  <span style={{ color: "#555", fontWeight: 400 }}> ({place.user_ratings_total?.toLocaleString()})</span>
                </span>
              )}
              {place.price_level != null && (
                <span style={{ fontSize: 12, color: "#28c878", fontWeight: 600 }}>{priceLabel(place.price_level)}</span>
              )}
              {place.open_now != null && (
                <span style={{ fontSize: 11, fontWeight: 700, color: place.open_now ? "#28c878" : "#ff5050" }}>
                  {place.open_now ? "● Open" : "● Closed"}
                </span>
              )}
              <span style={{ fontSize: 11, color: "#555" }}>{place.distance_km} km away</span>
            </div>
          </div>
          <div style={{ fontSize: 20, opacity: 0.5 }}>↗</div>
        </div>
      </div>
    </a>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "12px 16px" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#5b6aff",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Hotel Search Screen ───────────────────────────────────────────────────────
function HotelSearch({ onHotelFound }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setError(null);
    try {
      const res = await fetch(`${BACKEND}/travelmate/hotel?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Hotel not found. Try adding the city name.");
      const data = await res.json();
      onHotelFound(data);
    } catch (e) { setError(e.message); }
    finally { setSearching(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #080810 0%, #0f0f1a 50%, #080810 100%)",
      padding: "32px 24px", position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", top: "15%", left: "10%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(91,106,255,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "5%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(40,200,120,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
          <h1 style={{
            fontFamily: "'Clash Display', 'Syne', sans-serif",
            fontSize: 38, fontWeight: 800, color: "#fff",
            letterSpacing: -1.5, lineHeight: 1, margin: 0,
          }}>
            Travel<span style={{ color: "#5b6aff" }}>Mate</span>
          </h1>
          <p style={{ color: "#555", fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
            Your AI travel companion.<br />Explore everything around your hotel.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5b6aff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Where are you staying?
          </div>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Hilton Toronto Downtown"
              style={{
                width: "100%", padding: "16px 52px 16px 18px",
                borderRadius: 14, fontSize: 15,
                background: "rgba(255,255,255,0.07)",
                border: "1.5px solid rgba(91,106,255,0.3)",
                color: "#fff", outline: "none",
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 38, height: 38, borderRadius: 10, border: "none",
                background: searching ? "#333" : "linear-gradient(135deg, #5b6aff, #4f46e5)",
                color: "#fff", fontSize: 18, cursor: searching ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {searching ? "⟳" : "→"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: "#ff7070", fontSize: 13, textAlign: "center", padding: "10px", background: "rgba(255,80,80,0.08)", borderRadius: 10, border: "1px solid rgba(255,80,80,0.2)" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Sample hotels */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Try searching for</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Marriott New York", "Hilton London", "Four Seasons Paris", "Burj Al Arab Dubai"].map(s => (
              <button key={s} onClick={() => { setQuery(s); }} style={{
                padding: "8px 14px", borderRadius: 20, fontSize: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#888", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat Screen ───────────────────────────────────────────────────────────────
function ChatScreen({ hotel, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Welcome message
    setMessages([{
      role: "assistant",
      content: `Welcome to **${hotel.name}**! 🏨\n\nI'm your personal travel guide. I know everything around your hotel — restaurants, attractions, bars, shopping, transport and more.\n\nJust tell me what you're in the mood for! For example:\n• *"Find me a rooftop bar nearby"*\n• *"I want authentic local street food"*\n• *"What museums are within walking distance?"*`,
    }]);
  }, [hotel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, places]);

  const fetchPlaces = async (category, keyword) => {
    try {
      const params = new URLSearchParams({
        lat: hotel.lat, lng: hotel.lng,
        category, radius: 2000,
        ...(keyword ? { keyword } : {}),
      });
      const res = await fetch(`${BACKEND}/travelmate/places?${params}`);
      const data = await res.json();
      return data.places || [];
    } catch { return []; }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setPlaces([]);
    setActiveCategory(null);

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const systemPrompt = `You are TravelMate, a friendly AI travel guide helping a traveler explore around ${hotel.name} located at ${hotel.address}.

Your job:
1. Understand what the traveler wants
2. Respond in a warm, concise way (2-3 sentences max)
3. At the end of your response, output a JSON block with this exact format to trigger a place search:
<search>{"category": "restaurant", "keyword": "rooftop"}</search>

Category must be one of: restaurant, bar, cafe, museum, tourist_attraction, park, shopping_mall, spa, night_club, gym, pharmacy, hospital, subway_station, bus_station, taxi_stand

keyword is optional — only include if the user asked for something specific like "vegan", "rooftop", "street food", "jazz" etc.

If the traveler is asking something that doesn't need a place search (like general questions), skip the <search> block.

Keep responses short and friendly. Use 1-2 emojis max.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const raw = data.content?.[0]?.text || "Sorry, I couldn't process that.";

      // Extract search block if present
      const searchMatch = raw.match(/<search>([\s\S]*?)<\/search>/);
      const cleanText = raw.replace(/<search>[\s\S]*?<\/search>/, "").trim();

      setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);

      if (searchMatch) {
        try {
          const { category, keyword } = JSON.parse(searchMatch[1]);
          setActiveCategory(category);
          const results = await fetchPlaces(category, keyword);
          setPlaces(results);
        } catch {}
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I ran into an issue. Please try again!" }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/•/g, '•')
      .split('\n').join('<br/>');
  };

  const quickSuggestions = [
    "Best restaurants nearby 🍽️",
    "Things to do today 🗺️",
    "Rooftop bars 🍸",
    "Local street food 🥘",
    "How do I get around? 🚇",
    "Nearest pharmacy 💊",
  ];

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "linear-gradient(160deg, #080810 0%, #0f0f1a 100%)",
      fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto",
      position: "relative",
    }}>

      {/* Header */}
      <div style={{
        padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(8,8,16,0.95)", backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onReset} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#5b6aff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>TravelMate AI</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hotel.name}</div>
          <div style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hotel.address}</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #5b6aff, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✈️</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #5b6aff, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 2 }}>✈️</div>
            )}
            <div style={{
              maxWidth: "78%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user"
                ? "linear-gradient(135deg, #5b6aff, #4f46e5)"
                : "rgba(255,255,255,0.07)",
              border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
              fontSize: 14, lineHeight: 1.6, color: "#f0f0f0",
            }}
              dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
            />
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #5b6aff, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✈️</div>
            <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px 18px 18px 4px" }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Place Results */}
        {places.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#5b6aff", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>
              {CATEGORY_MAP[activeCategory]?.icon} {CATEGORY_MAP[activeCategory]?.label || "Places"} nearby
            </div>
            {places.map(place => <PlaceCard key={place.id} place={place} category={activeCategory} />)}
          </div>
        )}

        {/* Quick suggestions — only show at start */}
        {messages.length === 1 && !loading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#444", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>Quick suggestions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {quickSuggestions.map(s => (
                <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 100); }} style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 12,
                  background: "rgba(91,106,255,0.1)", border: "1px solid rgba(91,106,255,0.25)",
                  color: "#8090ff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px 24px", borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(8,8,16,0.95)", backdropFilter: "blur(20px)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask me anything about the area..."
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 14, fontSize: 14,
              background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(91,106,255,0.2)",
              color: "#fff", outline: "none", fontFamily: "'DM Sans', sans-serif",
              resize: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              background: loading || !input.trim() ? "rgba(91,106,255,0.2)" : "linear-gradient(135deg, #5b6aff, #4f46e5)",
              color: loading || !input.trim() ? "#555" : "#fff",
              fontSize: 20, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >↑</button>
        </div>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function TravelMate() {
  const [hotel, setHotel] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #080810; overscroll-behavior: none; }
        input::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
      `}</style>
      {hotel
        ? <ChatScreen hotel={hotel} onReset={() => setHotel(null)} />
        : <HotelSearch onHotelFound={setHotel} />
      }
    </>
  );
}
