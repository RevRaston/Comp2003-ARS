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
    setPlayers,
    clearConfirmedSplit,
    clearSplitSetup,
    setTotalCost,
    setRule,
  } = useGame();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 640;

  const displayName =
    profile?.displayName ||
    profile?.display_name ||
    profile?.username ||
    profile?.email ||
    "Host";

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

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          host_name: displayName,
          total_cost: 1,
          rule: "winner_free",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create session");
      }

      setPlayers([]);
      clearConfirmedSplit?.();
      clearSplitSetup?.();

      setTotalCost?.(0);
      setRule?.("winner_free");

      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: data.code,
        isHost: true,
      });

      navigate("/split-setup");
    } catch (err) {
      console.error("Create session error:", err);
      setError(err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
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
          <div style={logoBox}>
            <img src="/branding/RollPay_Logo.png" alt="RollPay" style={logoImg} />
          </div>
          <div style={brandText}>RollPay</div>
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
          <button style={navButtonActive} onClick={() => navigate("/host-session")}>
            Host
          </button>
          <button style={navButton} onClick={() => navigate("/profile")}>
            Profile
          </button>
        </nav>
      </header>

      <section
        style={{
          ...heroSection,
          minHeight: isPhone ? "auto" : "calc(100vh - 76px)",
          padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
        }}
      >
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />

        <div
          style={{
            ...formCard,
            padding: isPhone ? "24px 16px" : "32px 28px",
          }}
        >
          <p style={sectionEyebrow}>Host dashboard</p>

          <h1
            style={{
              ...pageTitle,
              fontSize: isPhone ? 42 : 58,
            }}
          >
            Create session
          </h1>

          <p style={introText}>
            Start a room, share the code, then set up the split.
          </p>

          <div style={profileCard}>
            <div style={avatarCircle}>{initials}</div>

            <div style={{ minWidth: 0 }}>
              <div style={profileLabel}>Signed in as</div>
              <div style={profileName}>{displayName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            style={infoButton}
          >
            {showHelp ? "Hide help" : "How hosting works"}
          </button>

          {showHelp && (
            <div style={helpBox}>
              Create the session first. RollPay will generate a code for players.
              Split details, receipt items, and game setup are handled after this.
            </div>
          )}

          <div style={summaryPanel}>
            <div style={summaryRow}>
              <span style={summaryLabel}>Host</span>
              <strong style={summaryValue}>{displayName}</strong>
            </div>

            <div style={summaryRow}>
              <span style={summaryLabel}>Next step</span>
              <strong style={summaryValue}>Split Setup</strong>
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
                ...(loading ? disabledButton : null),
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
  overflow: "hidden",
  padding: 4,
};

const logoImg = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
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

const formCard = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 520,
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
  margin: "14px 0 24px",
  fontSize: 17,
  lineHeight: 1.55,
  opacity: 0.86,
};

const profileCard = {
  marginBottom: 18,
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

const infoButton = {
  marginBottom: 16,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f6cf64",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const helpBox = {
  marginBottom: 18,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: 14,
  lineHeight: 1.55,
  opacity: 0.86,
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

const disabledButton = {
  opacity: 0.65,
  cursor: "not-allowed",
};