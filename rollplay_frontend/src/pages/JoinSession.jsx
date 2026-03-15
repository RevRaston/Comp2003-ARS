// src/pages/JoinSession.jsx
import { useEffect, useState } from "react";
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

export default function JoinSession() {
  const navigate = useNavigate();
  const { profile, setSessionInfo } = useGame();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [code, setCode] = useState("");
  const [name, setName] = useState(
    profile?.display_name || profile?.username || ""
  );
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

  async function handleJoinSession() {
    setError("");

    const cleanedCode = code.trim().toUpperCase();
    const cleanedName = name.trim();
    const token = localStorage.getItem("token");

    if (!cleanedCode) {
      setError("Enter a session code.");
      return;
    }

    if (!cleanedName) {
      setError("Enter your name.");
      return;
    }

    setLoading(true);

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/sessions/${cleanedCode}/join`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: cleanedName,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to join session");
      }

      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: cleanedCode,
        isHost: false,
      });

      navigate("/lobby");
    } catch (err) {
      console.error("Join session error:", err);
      setError(err.message || "Failed to join session");
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
          <button style={navButtonActive} onClick={() => navigate("/join-session")}>
            Join
          </button>
          <button style={navButton} onClick={() => navigate("/host-session")}>
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
            ...joinLayout,
            gridTemplateColumns:
              isPhone || isLaptop ? "1fr" : "minmax(320px, 0.9fr) minmax(0, 1.1fr)",
            gap: isPhone ? 18 : 24,
          }}
        >
          {/* LEFT INFO CARD */}
          <div style={sideCard}>
            <p style={sectionEyebrow}>Player entry</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Join a game
            </h1>

            <p style={introText}>
              Enter the session code from the host and choose the name you want
              shown in the lobby and arena.
            </p>

            <div style={tipsCard}>
              <h3 style={smallCardTitle}>What you’ll need</h3>
              <ul style={tipsList}>
                <li>A valid session code from the host.</li>
                <li>Your own device for joining and playing.</li>
                <li>A name other players can recognise.</li>
              </ul>
            </div>

            <div style={tipsCardAlt}>
              <h3 style={smallCardTitle}>What happens next?</h3>
              <p style={infoText}>
                Once you join, you’ll enter the lobby, wait for the host to
                start the session, and then follow the group into each round.
              </p>
            </div>
          </div>

          {/* RIGHT FORM CARD */}
          <div
            style={{
              ...formCard,
              padding: isPhone ? "22px 16px" : "28px 24px",
            }}
          >
            <p style={sectionEyebrow}>Session join</p>
            <h2 style={formTitle}>Enter your session details</h2>
            <p style={formIntro}>
              Join an existing RollPlay session using the code provided by the host.
            </p>

            <div style={fieldBlock}>
              <label style={labelStyle} htmlFor="session-code">
                Session code
              </label>
              <p style={helperText}>
                Codes are usually short and shown by the host in the session setup.
              </p>
              <input
                id="session-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                autoCapitalize="characters"
                style={inputStyle}
              />
            </div>

            <div style={fieldBlock}>
              <label style={labelStyle} htmlFor="player-name">
                Your name
              </label>
              <p style={helperText}>
                This is the name shown to the host and other players in the lobby.
              </p>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                style={inputStyle}
              />
            </div>

            <div style={summaryPanel}>
              <div style={summaryRow}>
                <span style={summaryLabel}>Joining as</span>
                <strong style={summaryValue}>{name.trim() || "Not set yet"}</strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Session code</span>
                <strong style={summaryValue}>{code.trim() || "Not entered yet"}</strong>
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
                onClick={handleJoinSession}
                disabled={loading}
                style={{
                  ...primaryButton,
                  width: isPhone ? "100%" : "auto",
                }}
              >
                {loading ? "Joining..." : "Join Session"}
              </button>

              <button
                onClick={() => navigate("/host-session")}
                style={{
                  ...secondaryButton,
                  width: isPhone ? "100%" : "auto",
                }}
              >
                Switch to Host
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

const joinLayout = {
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

const tipsCard = {
  marginTop: 24,
  padding: 20,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.12), rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.1)",
};

const tipsCardAlt = {
  marginTop: 18,
  padding: 20,
  borderRadius: 22,
  background: "rgba(255,255,255,0.05)",
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

const infoText = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.75,
  opacity: 0.88,
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
  textAlign: "right",
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

//Hey