// src/pages/Splash.jsx
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Splash() {
  const navigate = useNavigate();
  const { profile, canHost } = useGame();

  const loggedIn = !!profile;

  function handleHostClick() {
    if (!loggedIn) {
      navigate("/login?mode=host");
      return;
    }

    if (!canHost) {
      navigate("/profile");
      return;
    }

    navigate("/host-session");
  }

  function handleJoinClick() {
    if (!loggedIn) {
      navigate("/login?mode=player");
      return;
    }
    navigate("/join-session");
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hostLabel = !loggedIn
    ? "Sign in to Host"
    : canHost
    ? "Host Game"
    : "Upgrade to Host";

  const hostUpgradeStyle = !canHost && loggedIn;

  return (
    <div style={page}>
      {/* TOP BAR */}
      <header style={topBar}>
        <div style={logoWrap}>
          <div style={logoBox}>LOGO</div>
          <div>
            <div style={brandText}>RollPlay</div>
          </div>
        </div>

        <nav style={navLinks}>
          <button
            style={navButton}
            onClick={() => scrollToSection("how-to-use")}
          >
            How to Use
          </button>
          <button
            style={navButton}
            onClick={() => scrollToSection("about-game")}
          >
            About
          </button>
          <button
            style={navButton}
            onClick={() => scrollToSection("gallery")}
          >
            Gallery
          </button>
        </nav>
      </header>

      {/* HERO */}
      <section style={heroSection}>
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />
        <div style={heroBubbleOne} />
        <div style={heroBubbleTwo} />
        <div style={heroBubbleThree} />

        <div style={heroCard}>
          <p style={eyebrow}>Multiplayer pub-style bill splitting</p>

          <h1 style={titleStyle}>RollPlay</h1>

          <p style={subtitleStyle}>
            Turn splitting the bill into a game.
            <br />
            Pick the rule, play the rounds, let the leaderboard decide who pays.
          </p>

          <div style={buttonRowStyle}>
            <button
              onClick={handleHostClick}
              style={{
                ...btnStyle,
                ...(hostUpgradeStyle ? upgradeBtn : primaryBtn),
              }}
            >
              {hostLabel}
            </button>

            <button
              onClick={handleJoinClick}
              style={{ ...btnStyle, ...secondaryBtn }}
            >
              Join Game
            </button>
          </div>

          {!canHost && loggedIn && (
            <p style={smallTextStyle}>
              You currently have a <strong>Player</strong> account. Tap
              <strong> “Upgrade to Host”</strong> to unlock hosting.
            </p>
          )}

          {!loggedIn && (
            <p style={smallTextStyle}>
              Hosting requires an account. Joining friends is always free.
            </p>
          )}
        </div>
      </section>

      {/* HOW TO USE */}
      <section id="how-to-use" style={section}>
        <div style={sectionInner}>
          <p style={sectionEyebrow}>How to use</p>
          <h2 style={sectionTitle}>How a RollPlay session works</h2>
          <p style={sectionIntro}>
            One player hosts, others join with a code, the mini-games decide the
            rankings, and the final split is generated from the results.
          </p>

          <div style={stepsGrid}>
            <div style={infoCard}>
              <div style={stepBadge}>1</div>
              <h3 style={cardTitle}>Host a session</h3>
              <p style={cardText}>
                Set the rule, choose the game order, and prepare the bill split.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepBadge}>2</div>
              <h3 style={cardTitle}>Players join</h3>
              <p style={cardText}>
                Friends join on their own phone or device using the session code.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepBadge}>3</div>
              <h3 style={cardTitle}>Play the rounds</h3>
              <p style={cardText}>
                Compete through mini-games while the session stays synced for
                everyone.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepBadge}>4</div>
              <h3 style={cardTitle}>Confirm the split</h3>
              <p style={cardText}>
                Review rankings, payment allocation, and confirm the final
                session summary.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about-game" style={sectionAlt}>
        <div style={sectionInnerWide}>
          <div style={aboutGrid}>
            <div>
              <p style={sectionEyebrow}>About this game</p>
              <h2 style={sectionTitle}>Why RollPlay was created</h2>

              <p style={aboutText}>
                RollPlay was built to turn one of the most awkward parts of a
                social night out into something competitive, fun, and memorable.
              </p>

              <p style={aboutText}>
                Instead of arguing over the bill, players compete through
                multiple rounds and let the leaderboard help decide the final
                payment outcome.
              </p>

              <p style={aboutText}>
                It is designed as a multiplayer social experience for pubs,
                nights out, parties, and casual gatherings where everyone wants
                the split to feel more entertaining.
              </p>

              <p style={aboutMeta}>
                Created by: <strong>Placeholder creator / team name</strong>
                <br />
                Project purpose:{" "}
                <strong>University project / portfolio product</strong>
              </p>
            </div>

            <div style={aboutSideCard}>
              <h3 style={cardTitle}>What makes it different?</h3>

              <ul style={featureList}>
                <li>Bill splitting based on game outcomes</li>
                <li>Shared multiplayer sessions</li>
                <li>Cross-device social play</li>
                <li>Multiple mini-games in one flow</li>
                <li>Fun tone with structured payment summary</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" style={section}>
        <div style={sectionInnerWide}>
          <p style={sectionEyebrow}>Gallery</p>
          <h2 style={sectionTitle}>Screenshots and gameplay previews</h2>
          <p style={sectionIntro}>
            Use placeholders for now. Later this section can show real game
            screenshots, lobby images, arena visuals, and gameplay videos.
          </p>

          <div style={galleryGrid}>
            <div style={galleryVideo}>
              <div style={galleryLabel}>VIDEO PLACEHOLDER</div>
              <div style={gallerySubLabel}>
                Add a gameplay trailer or session montage here
              </div>
            </div>

            <div style={galleryCard}>Image Placeholder 1</div>
            <div style={galleryCard}>Image Placeholder 2</div>
            <div style={galleryCard}>Image Placeholder 3</div>
            <div style={galleryCard}>Image Placeholder 4</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={footer}>
        <div style={footerInner}>
          <div>
            <h3 style={footerTitle}>RollPlay</h3>
            <p style={footerText}>
              Multiplayer bill splitting made social.
            </p>
          </div>

          <div style={footerLinks}>
            <button
              style={footerLinkBtn}
              onClick={() => scrollToSection("how-to-use")}
            >
              How to Use
            </button>
            <button
              style={footerLinkBtn}
              onClick={() => scrollToSection("about-game")}
            >
              About
            </button>
            <button
              style={footerLinkBtn}
              onClick={() => scrollToSection("gallery")}
            >
              Gallery
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --- styles --- */

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
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  padding: "16px 24px",
  background: "rgba(8, 10, 16, 0.82)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  flexWrap: "wrap",
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

const heroSection = {
  position: "relative",
  minHeight: "92vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "56px 20px 40px",
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
  width: 140,
  height: 140,
  borderRadius: "50%",
  border: "8px solid rgba(255,220,140,0.12)",
  top: 140,
  right: "12%",
};

const heroBubbleTwo = {
  position: "absolute",
  width: 90,
  height: 90,
  borderRadius: "50%",
  border: "6px solid rgba(255,220,140,0.10)",
  bottom: 140,
  left: "14%",
};

const heroBubbleThree = {
  position: "absolute",
  width: 60,
  height: 60,
  borderRadius: "50%",
  border: "5px solid rgba(255,220,140,0.10)",
  top: "48%",
  left: "20%",
};

const heroCard = {
  position: "relative",
  zIndex: 2,
  background: "rgba(0, 0, 0, 0.42)",
  borderRadius: 32,
  padding: "52px 28px",
  maxWidth: 860,
  width: "100%",
  textAlign: "center",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
};

const eyebrow = {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.6,
  color: "#f6cf64",
};

const titleStyle = {
  fontSize: "clamp(54px, 9vw, 96px)",
  margin: "0 0 12px",
  fontWeight: 900,
  lineHeight: 0.95,
};

const subtitleStyle = {
  fontSize: "clamp(18px, 2vw, 30px)",
  margin: "0 auto 30px",
  lineHeight: 1.45,
  maxWidth: 720,
};

const buttonRowStyle = {
  display: "flex",
  justifyContent: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const btnStyle = {
  border: "none",
  borderRadius: "999px",
  padding: "14px 28px",
  fontSize: "18px",
  cursor: "pointer",
  fontWeight: 700,
  minWidth: "210px",
};

const primaryBtn = {
  background: "#f4c431",
  color: "#1d1d1d",
  boxShadow: "0 10px 24px rgba(244,196,49,0.24)",
};

const upgradeBtn = {
  background: "#5e6472",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.16)",
};

const secondaryBtn = {
  background: "#2d3442",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.14)",
};

const smallTextStyle = {
  fontSize: "14px",
  opacity: 0.9,
  marginTop: "10px",
};

const section = {
  padding: "90px 20px",
};

const sectionAlt = {
  padding: "90px 20px",
  background: "rgba(255,255,255,0.03)",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const sectionInner = {
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
};

const sectionInnerWide = {
  width: "100%",
  maxWidth: 1180,
  margin: "0 auto",
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

const sectionTitle = {
  margin: 0,
  fontSize: "clamp(32px, 5vw, 52px)",
  lineHeight: 1.05,
};

const sectionIntro = {
  marginTop: 14,
  maxWidth: 760,
  fontSize: 18,
  lineHeight: 1.6,
  opacity: 0.88,
};

const stepsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 18,
  marginTop: 26,
};

const infoCard = {
  padding: 22,
  borderRadius: 24,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const stepBadge = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4c431",
  color: "#171717",
  fontWeight: 800,
  marginBottom: 14,
};

const cardTitle = {
  margin: "0 0 10px",
  fontSize: 20,
};

const cardText = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.6,
  opacity: 0.86,
};

const aboutGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
  gap: 24,
  alignItems: "start",
};

const aboutText = {
  fontSize: 17,
  lineHeight: 1.7,
  opacity: 0.9,
};

const aboutMeta = {
  marginTop: 22,
  fontSize: 16,
  lineHeight: 1.7,
  opacity: 0.9,
};

const aboutSideCard = {
  padding: 24,
  borderRadius: 24,
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.12), rgba(255,255,255,0.04))",
  border: "1px solid rgba(255,255,255,0.12)",
};

const featureList = {
  margin: "14px 0 0",
  paddingLeft: 20,
  lineHeight: 1.9,
  fontSize: 16,
  opacity: 0.9,
};

const galleryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(12, 1fr)",
  gap: 18,
  marginTop: 26,
};

const galleryVideo = {
  gridColumn: "span 12",
  minHeight: 320,
  borderRadius: 26,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.1)",
  textAlign: "center",
  padding: 20,
};

const galleryLabel = {
  fontSize: 28,
  fontWeight: 800,
  marginBottom: 10,
};

const gallerySubLabel = {
  fontSize: 16,
  opacity: 0.78,
};

const galleryCard = {
  gridColumn: "span 3",
  minHeight: 180,
  borderRadius: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  fontWeight: 700,
  textAlign: "center",
  padding: 12,
};

const footer = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.18)",
};

const footerInner = {
  width: "100%",
  maxWidth: 1180,
  margin: "0 auto",
  padding: "28px 20px",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
};

const footerTitle = {
  margin: "0 0 8px",
};

const footerText = {
  margin: 0,
  opacity: 0.75,
};

const footerLinks = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const footerLinkBtn = {
  background: "transparent",
  border: "none",
  color: "white",
  opacity: 0.82,
  cursor: "pointer",
  fontSize: 14,
};