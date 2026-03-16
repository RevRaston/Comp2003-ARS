// src/pages/HostSession.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

export default function HostSession({ token }) {
  const navigate = useNavigate();

  const {
    profile,
    setSessionInfo,
    setTotalCost,
    setRule,
    setPlayers,
    clearConfirmedSplit,
  } = useGame();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [totalCost, setTotalCostLocal] = useState("50");
  const [ruleValue, setRuleValue] = useState("winner_free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 640;
  const isLaptop = screenWidth <= 1100;

  const displayName =
    profile?.display_name || profile?.username || profile?.email || "Host";

  const initials = useMemo(() => {
    const parts = String(displayName).trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "RP";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [displayName]);

  async function handleCreateSession() {
    setError("");

    if (!token) {
      navigate("/login?mode=host");
      return;
    }

    const parsedCost = Number(totalCost);
    if (Number.isNaN(parsedCost) || parsedCost <= 0) {
      setError("Enter a valid total cost greater than 0.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_cost: parsedCost,
          rule: ruleValue,
          host_name: displayName,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create session");
      }

      setTotalCost(parsedCost);
      setRule(ruleValue);
      setPlayers([]);
      clearConfirmedSplit?.();

      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: data.code,
        isHost: true,
      });

      navigate("/lobby");
    } catch (err) {
      console.error("Create session error:", err);
      setError(err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      {/* TOP BAR */}
      <header
        style={{
          ...topBar,
          padding: isPhone ? "14px 16px" : "16px 24px",
          flexDirection: isPhone ? "column" : "row",
          alignItems: isPhone ? "stretch" : "center",
        }}
      >
        <div
          style={{
            ...logoWrap,
            justifyContent: isPhone ? "center" : "flex-start",
          }}
        >
          <div style={logoBox}>LOGO</div>
          <div style={brandText}>RollPlay</div>
        </div>

        <nav
          style={{
            ...navLinks,
            justifyContent: isPhone ? "center" : "flex-end",
          }}
        >
          <button style={navButton} onClick={() => navigate("/join-session")}>
            Join
          </button>
          <button
            style={navButtonActive}
            onClick={() => navigate("/host-session")}
          >
            Host
          </button>
          <button style={navButton} onClick={() => navigate("/profile")}>
            Profile
          </button>
        </nav>
      </header>

      {/* PAGE HERO / FORM */}
      <section
        style={{
          ...heroSection,
          minHeight: isPhone ? "auto" : "calc(100vh - 76px)",
          padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
        }}
      >
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />
        {!isPhone && <div style={heroBubbleOne} />}
        {!isPhone && <div style={heroBubbleTwo} />}

        <div
          style={{
            ...hostLayout,
            gridTemplateColumns:
              isPhone || isLaptop
                ? "1fr"
                : "minmax(320px, 0.9fr) minmax(0, 1.1fr)",
            gap: isPhone ? 18 : 24,
          }}
        >
          {/* LEFT INFO CARD */}
          <div style={sideCard}>
            <p style={sectionEyebrow}>Host dashboard</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Host a game
            </h1>

            <p style={introText}>
              Start a new RollPlay session, set the bill total, and invite
              players to join using a session code.
            </p>

            <div style={profileCard}>
              <div style={avatarCircle}>{initials}</div>

              <div style={{ minWidth: 0 }}>
                <div style={profileLabel}>Signed in as</div>
                <div style={profileName}>{displayName}</div>
                <div style={profileSubtext}>Ready to host</div>
              </div>
            </div>

            <div style={tipsCard}>
              <h3 style={smallCardTitle}>Before you start</h3>
              <ul style={tipsList}>
                <li>Make sure everyone has their own device.</li>
                <li>Set the shared bill total for the session.</li>
                <li>Players will join with a room code in the lobby.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT FORM CARD */}
          <div
            style={{
              ...formCard,
              padding: isPhone ? "22px 16px" : "28px 24px",
            }}
          >
            <p style={sectionEyebrow}>Session setup</p>
            <h2 style={formTitle}>Create a new session</h2>
            <p style={formIntro}>
              Set the total bill and choose the session rule before creating the
              room.
            </p>

            <div style={fieldBlock}>
              <label style={labelStyle} htmlFor="total-cost">
                Total cost (£)
              </label>
              <p style={helperText}>
                Enter the total amount for the session bill.
              </p>
              <input
                id="total-cost"
                type="number"
                min="1"
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCostLocal(e.target.value)}
                placeholder="50.00"
                style={inputStyle}
              />
            </div>

            <div style={fieldBlock}>
              <label style={labelStyle} htmlFor="rule">
                Rule
              </label>
              <p style={helperText}>
                Choose how the game outcome should affect who pays.
              </p>
              <select
                id="rule"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                style={selectStyle}
              >
                <option value="winner_free">Winner Drinks Free</option>
                <option value="even_split">Even Split</option>
              </select>
            </div>

            <div style={summaryPanel}>
              <div style={summaryRow}>
                <span style={summaryLabel}>Session total</span>
                <strong style={summaryValue}>
                  £{Number(totalCost || 0).toFixed(2)}
                </strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Rule</span>
                <strong style={summaryValue}>
                  {ruleValue === "winner_free"
                    ? "Winner Drinks Free"
                    : "Even Split"}
                </strong>
              </div>
            </div>

            {error && <p style={errorText}>{error}</p>}

            <div
              style={{
                ...actionRow,
                flexDirection: isPhone ? "column" : "row",
              }}
            >
              <button
                onClick={handleCreateSession}
                disabled={loading}
                style={{
                  ...primaryButton,
                  width: isPhone ? "100%" : "auto",
                }}
              >
                {loading ? "Creating..." : "Create Session"}
              </button>

              <button
                onClick={() => navigate("/profile")}
                style={{
                  ...secondaryButton,
                  width: isPhone ? "100%" : "auto",
                }}
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* styles */

const page = {
  minHeight: "100vh",
  color: "#fff",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  background: "rgba(8, 10, 16, 0.82)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const logoWrap = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoBox = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 11,
  fontWeight: 700,
};

const brandText = {
  fontSize: 24,
  fontWeight: 800,
};

const navLinks = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const navButton = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};

const navButtonActive = {
  ...navButton,
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.34)",
  color: "#f6cf64",
};

const heroSection = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const heroGlowOne = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.18)",
  filter: "blur(90px)",
  top: 60,
  left: -100,
};

const heroGlowTwo = {
  position: "absolute",
  width: 440,
  height: 440,
  borderRadius: "50%",
  background: "rgba(255, 115, 64, 0.12)",
  filter: "blur(90px)",
  bottom: 40,
  right: -80,
};

const heroBubbleOne = {
  position: "absolute",
  width: 120,
  height: 120,
  borderRadius: "50%",
  border: "7px solid rgba(255,220,140,0.12)",
  top: 120,
  right: "12%",
};

const heroBubbleTwo = {
  position: "absolute",
  width: 78,
  height: 78,
  borderRadius: "50%",
  border: "6px solid rgba(255,220,140,0.10)",
  bottom: 120,
  left: "10%",
};

const hostLayout = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1180,
  display: "grid",
  alignItems: "stretch",
};

const sideCard = {
  background: "rgba(0, 0, 0, 0.38)",
  borderRadius: 30,
  padding: "28px 24px",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
};

const formCard = {
  background: "rgba(0, 0, 0, 0.42)",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
};

const sectionEyebrow = {
  margin: 0,
  marginBottom: 10,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontSize: 13,
  fontWeight: 700,
};

const pageTitle = {
  margin: 0,
  lineHeight: 0.98,
  fontWeight: 900,
};

const introText = {
  marginTop: 14,
  fontSize: 17,
  lineHeight: 1.65,
  opacity: 0.9,
};

const profileCard = {
  marginTop: 24,
  padding: 18,
  borderRadius: 22,
  display: "flex",
  alignItems: "center",
  gap: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const avatarCircle = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f4c431, #ff9d2f)",
  color: "#1b1b1b",
  fontWeight: 900,
  fontSize: 22,
  flexShrink: 0,
};

const profileLabel = {
  fontSize: 13,
  opacity: 0.72,
  marginBottom: 4,
};

const profileName = {
  fontSize: 22,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const profileSubtext = {
  fontSize: 14,
  opacity: 0.76,
  marginTop: 4,
};

const tipsCard = {
  marginTop: 20,
  padding: 20,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.12), rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.1)",
};

const smallCardTitle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const tipsList = {
  margin: 0,
  paddingLeft: 20,
  lineHeight: 1.9,
  fontSize: 15,
  opacity: 0.9,
};

const formTitle = {
  margin: "0 0 10px",
  fontSize: 34,
  lineHeight: 1.05,
};

const formIntro = {
  margin: "0 0 24px",
  fontSize: 16,
  lineHeight: 1.6,
  opacity: 0.86,
};

const fieldBlock = {
  marginBottom: 22,
};

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontSize: 16,
  fontWeight: 700,
};

const helperText = {
  margin: "0 0 10px",
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.76,
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 17,
  boxSizing: "border-box",
};

const selectStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 17,
  boxSizing: "border-box",
};

const summaryPanel = {
  marginTop: 8,
  marginBottom: 22,
  padding: 18,
  borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: "6px 0",
};

const summaryLabel = {
  opacity: 0.78,
  fontSize: 15,
};

const summaryValue = {
  fontSize: 16,
};

const errorText = {
  color: "#ff9a9a",
  fontWeight: 700,
  marginBottom: 16,
};

const actionRow = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "none",
  background: "#f4c431",
  color: "#161616",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
  minWidth: 200,
  boxShadow: "0 10px 24px rgba(244,196,49,0.24)",
};

const secondaryButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 170,
};