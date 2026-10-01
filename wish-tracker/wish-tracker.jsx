import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Star, Sparkles } from "lucide-react";

const CATEGORIES = [
  { id: "подорожі", label: "Подорожі", color: "#7DD3C0" },
  { id: "речі", label: "Речі", color: "#E8B95B" },
  { id: "навчання", label: "Навчання", color: "#A78BFA" },
  { id: "стосунки", label: "Стосунки", color: "#F0A8B8" },
  { id: "кар'єра", label: "Кар'єра", color: "#8EB4E3" },
  { id: "інше", label: "Інше", color: "#9CA8C2" },
];

const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const PREDICTIONS = [
  "Сьогодні варто озвучити бажання вголос — воно швидше знайде дорогу.",
  "Одна дрібна дія сьогодні наблизить велике бажання більше, ніж здається.",
  "День сприяє тому, щоб дозволити собі хотіти більшого.",
  "Те, що відкладали через сумнів, сьогодні варто хоча б записати.",
  "Несподівана розмова може підказати, як здійснити давнє бажання.",
  "Сьогодні гарний день, щоб оновити список — щось у ньому вже не ваше.",
  "Терпіння до одного з бажань сьогодні винагородиться раніше, ніж очікуєте.",
  "Звертайте увагу на дрібні збіги — сьогодні вони не випадкові.",
  "Бажання, яке лякає своєю масштабністю, варто розбити на перший крок уже сьогодні.",
  "День для того, щоб подякувати собі за вже здійснене.",
  "Сьогодні краще діяти, ніж чекати ідеального моменту.",
  "Хтось поруч може стати союзником для одного з ваших бажань — спитайте.",
  "Позбудьтесь одного зайвого клопоту — і в списку бажань з'явиться місце.",
  "Сьогодні варто перечитати найдавніше бажання зі списку — воно ще актуальне?",
  "День приносить ясність щодо того, чого ви хочете насправді.",
  "Маленький ризик сьогодні відкриє шлях до більшого бажання.",
  "Сьогодні варто мріяти конкретніше — деталі притягують здійснення.",
  "Те, що ви відклали «на потім», сьогодні просить хоча б п'ять хвилин уваги.",
  "День, коли варто повірити, що бажання вже в дорозі.",
  "Сьогодні приємна новина може стосуватися саме того, чого ви прагнете.",
  "Спробуйте сьогодні уявити бажання здійсненим — у деталях, наче спогад.",
  "День для чесності з собою: яке бажання у списку насправді не ваше?",
  "Сьогодні варто зробити крок, навіть маленький, у бік найважчого бажання.",
  "Той, хто питає — отримує. Сьогодні гарний день попросити про допомогу.",
  "Бажання, що повторюється у думках останнім часом, сьогодні варто записати.",
  "День сприяє завершенню — щось із давно розпочатого проситься до фіналу.",
  "Сьогодні звертайте увагу на те, що вас надихає без причини — це підказка.",
  "Одне бажання сьогодні здійсниться легше, ніж ви припускаєте.",
  "День для того, щоб додати нове бажання — без сумнівів, чи варте воно уваги.",
  "Сьогодні хороший момент відсвяткувати навіть маленький крок уперед.",
];

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function predictionForDate(d) {
  const key = dayKey(d);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PREDICTIONS[h % PREDICTIONS.length];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Deterministic-ish scatter for the constellation strip, seeded by id
function scatter(id, i, total) {
  let h = 0;
  for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
  const x = ((i + 0.5) / Math.max(total, 1)) * 100;
  const y = 20 + (h % 60);
  const delay = (h % 400) / 100;
  return { x, y, delay };
}

export default function WishTracker() {
  const [wishes, setWishes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [priority, setPriority] = useState(2);
  const [filter, setFilter] = useState("активні");
  const [saveError, setSaveError] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const inputRef = useRef(null);

  // Checks periodically so the prediction rolls over automatically after midnight
  // even if the tab stays open.
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const prediction = useMemo(() => predictionForDate(today), [today]);
  const dateLabel = useMemo(
    () => today.toLocaleDateString("uk-UA", { day: "numeric", month: "long" }),
    [today]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("wishes", false);
        if (res && res.value) setWishes(JSON.parse(res.value));
      } catch (e) {
        // no saved wishes yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const ok = await window.storage.set("wishes", JSON.stringify(wishes), false);
        setSaveError(!ok);
      } catch (e) {
        setSaveError(true);
      }
    })();
  }, [wishes, loaded]);

  function addWish() {
    const t = text.trim();
    if (!t) return;
    setWishes((w) => [
      { id: uid(), text: t, category, priority, done: false, createdAt: Date.now() },
      ...w,
    ]);
    setText("");
    inputRef.current?.focus();
  }

  function toggleDone(id) {
    setWishes((w) => w.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }

  function removeWish(id) {
    setWishes((w) => w.filter((x) => x.id !== id));
  }

  const filtered = useMemo(() => {
    let list = wishes;
    if (filter === "активні") list = list.filter((w) => !w.done);
    else if (filter === "здійснені") list = list.filter((w) => w.done);
    return [...list].sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  }, [wishes, filter]);

  const total = wishes.length;
  const doneCount = wishes.filter((w) => w.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 20% 0%, #16213E 0%, #0B1120 55%), #0B1120",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#F1F5F9",
        padding: "0 0 64px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: #E8B95B55; }
        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wish-card { animation: rise 0.35s ease both; }
        .wish-card:hover .del-btn { opacity: 1; }
        input, select, textarea { font-family: inherit; }
        input::placeholder { color: #5D6B8C; }
        button { font-family: inherit; cursor: pointer; }
        .cat-btn:focus-visible, .del-btn:focus-visible, .add-btn:focus-visible, .tab-btn:focus-visible, .star-btn:focus-visible, .toggle-btn:focus-visible {
          outline: 2px solid #E8B95B; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .twinkle-dot, .wish-card { animation: none !important; }
        }
      `}</style>

      {/* Hero: constellation strip */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <Sparkles size={18} color="#E8B95B" strokeWidth={1.75} />
          <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B98B8" }}>
            нічне небо бажань
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 600,
            fontSize: "clamp(28px, 5vw, 40px)",
            margin: "4px 0 20px",
            letterSpacing: "-0.01em",
          }}
        >
          Трекер бажань
        </h1>

        {/* constellation visualization */}
        <div
          style={{
            position: "relative",
            height: 90,
            borderRadius: 14,
            background: "linear-gradient(180deg, #0F1830 0%, #0B1120 100%)",
            border: "1px solid #1E2A47",
            overflow: "hidden",
            marginBottom: 18,
          }}
          aria-hidden="true"
        >
          {total === 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#5D6B8C",
                fontSize: 13,
                fontStyle: "italic",
                fontFamily: "'Fraunces', Georgia, serif",
              }}
            >
              поки що небо порожнє — додайте перше бажання
            </div>
          ) : (
            wishes.map((w, i) => {
              const { x, y, delay } = scatter(w.id, i, wishes.length);
              const c = catMap[w.category]?.color || "#9CA8C2";
              return (
                <div
                  key={w.id}
                  className="twinkle-dot"
                  title={w.text}
                  style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: y,
                    width: w.done ? 8 : 5,
                    height: w.done ? 8 : 5,
                    borderRadius: "50%",
                    background: w.done ? "#FDE68A" : c,
                    boxShadow: w.done ? "0 0 8px 2px #FDE68A99" : `0 0 4px 1px ${c}66`,
                    animation: `twinkle ${2.4 + delay}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })
          )}
        </div>

        {/* progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 4, background: "#1E2A47", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #E8B95B, #FDE68A)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span style={{ fontSize: 12.5, color: "#8B98B8", whiteSpace: "nowrap" }}>
            {doneCount} із {total} здійснено
          </span>
        </div>
      </div>

      {/* daily prediction */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            position: "relative",
            background: "linear-gradient(135deg, #1B2747 0%, #141E33 100%)",
            border: "1px solid #2A3A63",
            borderRadius: 16,
            padding: "18px 20px",
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "radial-gradient(circle, #E8B95B22 0%, transparent 70%)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Star size={14} color="#E8B95B" fill="#E8B95B" strokeWidth={1} />
            <span style={{ fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B98B8" }}>
              передбачення дня · {dateLabel}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: "'Fraunces', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 17,
              lineHeight: 1.5,
              color: "#F1F5F9",
              maxWidth: 560,
            }}
          >
            {prediction}
          </p>
        </div>
      </div>

      {/* add form */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            background: "#141E33",
            border: "1px solid #212F52",
            borderRadius: 16,
            padding: 18,
            marginBottom: 24,
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWish()}
            placeholder="Загадайте бажання…"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #2A3A63",
              padding: "6px 2px 12px",
              fontSize: 16,
              color: "#F1F5F9",
              outline: "none",
              marginBottom: 14,
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className="cat-btn"
                  onClick={() => setCategory(c.id)}
                  style={{
                    fontSize: 12.5,
                    padding: "5px 11px",
                    borderRadius: 999,
                    border: `1px solid ${category === c.id ? c.color : "#28345A"}`,
                    background: category === c.id ? `${c.color}22` : "transparent",
                    color: category === c.id ? c.color : "#8B98B8",
                    transition: "all 0.15s",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  className="star-btn"
                  aria-label={`Пріоритет ${p}`}
                  onClick={() => setPriority(p)}
                  style={{ background: "none", border: "none", padding: 3 }}
                >
                  <Star
                    size={17}
                    color={p <= priority ? "#E8B95B" : "#3A4770"}
                    fill={p <= priority ? "#E8B95B" : "none"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <button
              className="add-btn"
              onClick={addWish}
              disabled={!text.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: text.trim() ? "#E8B95B" : "#28345A",
                color: text.trim() ? "#0B1120" : "#5D6B8C",
                border: "none",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              Додати
            </button>
          </div>
        </div>

        {saveError && (
          <div style={{ fontSize: 12.5, color: "#F0A8B8", marginBottom: 16 }}>
            Не вдалося зберегти зміни. Спробуйте ще раз.
          </div>
        )}

        {/* filter tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {["активні", "здійснені", "усі"].map((f) => (
            <button
              key={f}
              className="tab-btn"
              onClick={() => setFilter(f)}
              style={{
                fontSize: 13,
                padding: "6px 13px",
                borderRadius: 8,
                border: "none",
                background: filter === f ? "#212F52" : "transparent",
                color: filter === f ? "#F1F5F9" : "#6B7999",
                fontWeight: filter === f ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && loaded && (
            <div style={{ color: "#5D6B8C", fontSize: 13.5, padding: "20px 4px", fontStyle: "italic" }}>
              {filter === "здійснені"
                ? "жодне бажання ще не здійснилось"
                : "тут поки порожньо"}
            </div>
          )}
          {filtered.map((w) => {
            const c = catMap[w.category] || catMap["інше"];
            return (
              <div
                key={w.id}
                className="wish-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#141E33",
                  border: "1px solid #212F52",
                  borderRadius: 12,
                  padding: "12px 14px",
                  opacity: w.done ? 0.6 : 1,
                }}
              >
                <button
                  className="toggle-btn"
                  onClick={() => toggleDone(w.id)}
                  aria-label={w.done ? "Позначити як активне" : "Позначити як здійснене"}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
                    flexShrink: 0,
                    display: "flex",
                  }}
                >
                  <Star
                    size={19}
                    color={w.done ? "#FDE68A" : "#3A4770"}
                    fill={w.done ? "#FDE68A" : "none"}
                    strokeWidth={1.5}
                  />
                </button>

                <span
                  style={{
                    flex: 1,
                    fontSize: 14.5,
                    textDecoration: w.done ? "line-through" : "none",
                    color: w.done ? "#7C8AA5" : "#F1F5F9",
                  }}
                >
                  {w.text}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: `${c.color}1E`,
                    color: c.color,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {c.label}
                </span>

                <span style={{ display: "flex", flexShrink: 0 }}>
                  {[1, 2, 3].map((p) => (
                    <Star
                      key={p}
                      size={11}
                      color={p <= w.priority ? "#E8B95B" : "#2A3559"}
                      fill={p <= w.priority ? "#E8B95B" : "none"}
                      strokeWidth={1.5}
                    />
                  ))}
                </span>

                <button
                  className="del-btn"
                  onClick={() => removeWish(w.id)}
                  aria-label="Видалити бажання"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
                    opacity: 0,
                    transition: "opacity 0.15s",
                    flexShrink: 0,
                    display: "flex",
                  }}
                >
                  <X size={15} color="#6B7999" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
