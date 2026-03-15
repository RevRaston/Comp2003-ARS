import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  async function quickSignup() {
    console.log("Creating admin test account...");

    const { data, error } = await supabase.auth.signUp({
      email: "test@rollpay.com",
      password: "test1234",
    });

    if (error) {
      console.error("Signup failed:", error.message);
      alert("Signup failed: " + error.message);
    } else {
      console.log("Created account:", data);
      alert("Admin account created! Now press Quick Login.");
    }
  }

  async function quickLogin() {
    console.log("Attempting quick login...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: "test@rollpay.com",
      password: "test1234",
    });

    if (error) {
      console.error("Login failed:", error.message);
      alert("Login failed: " + error.message);
      return;
    }

    console.log("Logged in as:", data.user.email);
    alert("Logged in as: " + data.user.email);

    navigate("/home");
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={page}>
      {/* TOP BAR */}
      <header style={topBar}>
        <div style={logoWrap}>
          <div style={logoBox}>LOGO</div>
          <span style={brandText}>RollPlay</span>
        </div>

        <nav style={navLinks}>
          <button style={navButton} onClick={() => scrollToSection("how-to-use")}>
            How To Use
          </button>
          <button style={navButton} onClick={() => scrollToSection("about-game")}>
            About
          </button>
          <button style={navButton} onClick={() => scrollToSection("gallery")}>
            Gallery
          </button>
        </nav>
      </header>

      {/* HERO */}
      <section style={heroSection}>
        <div style={heroBackgroundGlow1} />
        <div style={heroBackgroundGlow2} />

        <div style={heroCard}>
          <p style={eyebrow}>Multiplayer pub-style bill splitting</p>

          <h1 style={heroTitle}>RollPlay</h1>

          <p style={heroSubtitle}>
            Turn splitting the bill into a game.
            <br />
            Pick the rule, play the rounds, and let the leaderboard decide who pays.
          </p>

          <div style={heroButtonRow}>
            <button style={primaryButton} onClick={() => navigate("/login")}>
              Sign in to Host
            </button>

            <button style={secondaryButton} onClick={() => navigate("/join")}>
              Join Game
            </button>
          </div>

          <p style={heroNote}>
            Hosting requires an account. Joining friends is always free.
          </p>
        </div>
      </section>

      {/* HOW TO USE */}
      <section id="how-to-use" style={section}>
        <div style={sectionInner}>
          <div style={sectionHeaderBlock}>
            <p style={sectionEyebrow}>How to use</p>
            <h2 style={sectionTitle}>How a RollPlay session works</h2>
            <p style={sectionIntro}>
              Designed for social nights out, pubs, bars, and game evenings.
              One person hosts, everyone joins, then the mini-games decide the split.
            </p>
          </div>

          <div style={stepsGrid}>
            <div style={infoCard}>
              <div style={stepNumber}>1</div>
              <h3 style={cardTitle}>Host a session</h3>
              <p style={cardText}>
                Sign in, create a session, choose the rule, and set the bill or split type.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepNumber}>2</div>
              <h3 style={cardTitle}>Players join</h3>
              <p style={cardText}>
                Friends join with the session code from their own phone or device.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepNumber}>3</div>
              <h3 style={cardTitle}>Play the rounds</h3>
              <p style={cardText}>
                Compete through the selected mini-games while the session stays synced for everyone.
              </p>
            </div>

            <div style={infoCard}>
              <div style={stepNumber}>4</div>
              <h3 style={cardTitle}>See the results</h3>
              <p style={cardText}>
                Review rankings, calculate the split, and confirm the final payment summary.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about-game" style={sectionAlt}>
        <div style={sectionInnerWide}>
          <div style={aboutLeft}>
            <p style={sectionEyebrow}>About this game</p>
            <h2 style={sectionTitle}>Why RollPlay was created</h2>

            <p style={aboutText}>
              RollPlay was made to turn one of the most awkward parts of a social night out
              into something competitive, memorable, and fun.
            </p>

            <p style={aboutText}>
              Instead of everyone arguing over the bill, the session host sets the rules,
              players compete in mini-games, and the final rankings help decide how the total
              should be split.
            </p>

            <p style={aboutText}>
              The project is being developed as a multiplayer social game experience with
              accessible design, cross-device play, and a fun pub-night atmosphere at its core.
            </p>

            <p style={aboutMeta}>
              Created by: <strong>Placeholder name(s)</strong>
              <br />
              Project purpose: <strong>University / portfolio / social game prototype</strong>
            </p>
          </div>

          <div style={aboutRight}>
            <div style={aboutHighlightCard}>
              <h3 style={cardTitle}>What makes it different?</h3>
              <ul style={featureList}>
                <li>Shared multiplayer sessions</li>
                <li>Mini-games decide outcomes</li>
                <li>Built-in bill split logic</li>
                <li>Designed for phones and shared play</li>
                <li>Fun-first but still structured and usable</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" style={section}>
        <div style={sectionInnerWide}>
          <div style={sectionHeaderBlock}>
            <p style={sectionEyebrow}>Gallery</p>
            <h2 style={sectionTitle}>Images and gameplay previews</h2>
            <p style={sectionIntro}>
              Placeholder content for now. Later this section can hold real screenshots,
              gameplay clips, trailers, and promotional visuals.
            </p>
          </div>

          <div style={galleryGrid}>
            <div style={galleryLarge}>
              <div style={mediaPlaceholderLabel}>VIDEO PLACEHOLDER</div>
              <div style={mediaPlaceholderSubtext}>
                Add gameplay trailer / session montage here
              </div>
            </div>

            <div style={galleryCard}>Image Placeholder 1</div>
            <div style={galleryCard}>Image Placeholder 2</div>
            <div style={galleryCard}>Image Placeholder 3</div>
            <div style={galleryCard}>Image Placeholder 4</div>
          </div>
        </div>
      </section>

      {/* DEV TEST SECTION */}
      <section style={devSection}>
        <div style={devCard}>
          <p style={sectionEyebrow}>Developer test tools</p>
          <h2 style={sectionTitleSmall}>Quick test access</h2>

          <div style={devButtons}>
            <button style={devButton} onClick={quickSignup}>
              Quick Signup
            </button>

            <button style={devButton} onClick={quickLogin}>
              Quick Login
            </button>

            <button style={devButtonSecondary} onClick={() => navigate("/host")}>
              Go to Host
            </button>

            <button style={devButtonSecondary} onClick={() => navigate("/join")}>
              Go to Join
            </button>
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
            <button style={footerLinkButton} onClick={() => scrollToSection("how-to-use")}>
              How To Use
            </button>
            <button style={footerLinkButton} onClick={() => scrollToSection("about-game")}>
              About
            </button>
            <button style={footerLinkButton} onClick={() => scrollToSection("gallery")}>
              Gallery
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* STYLES */

const page = {
  minHeight: "100vh",
  color: "white",
  background:
    "radial-gradient(circle at top, rgba(255,220,120,0.12), transparent 24%), linear-gradient(180deg, #10131b 0%, #151926 28%, #1c2131 100%)",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  padding: "16px 28px",
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
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 11,
  fontWeight: 700,
};

const brandText = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: 0.3,
};

const navLinks = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "center",
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
  padding: "60px 20px 40px",
  overflow: "hidden",
};

const heroBackgroundGlow1 = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.18)",
  filter: "blur(80px)",
  top: 80,
  left: -120,
};

const heroBackgroundGlow2 = {
  position: "absolute",
  width: 440,
  height: 440,
  borderRadius: "50%",
  background: "rgba(255, 110, 70, 0.14)",
  filter: "blur(90px)",
  bottom: 40,
  right: -80,
};

const heroCard = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 860,
  padding: "54px 28px",
  borderRadius: 32,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
};

const eyebrow = {
  margin: 0,
  marginBottom: 12,
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: 1.6,
  color: "#f4cf67",
  fontWeight: 700,
};

const heroTitle = {
  margin: 0,
  fontSize: "clamp(48px, 8vw, 92px)",
  fontWeight: 900,
  lineHeight: 0.95,
};

const heroSubtitle = {
  margin: "18px auto 0",
  maxWidth: 700,
  fontSize: "clamp(18px, 2vw, 32px)",
  lineHeight: 1.4,
  opacity: 0.94,
};

const heroButtonRow = {
  marginTop: 34,
  display: "flex",
  justifyContent: "center",
  gap: 16,
  flexWrap: "wrap",
};

const primaryButton = {
  padding: "16px 28px",
  borderRadius: 999,
  border: "none",
  background: "#f4c431",
  color: "#161616",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
  minWidth: 220,
  boxShadow: "0 10px 24px rgba(244,196,49,0.24)",
};

const secondaryButton = {
  padding: "16px 28px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 220,
};

const heroNote = {
  marginTop: 18,
  fontSize: 15,
  opacity: 0.8,
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

const sectionHeaderBlock = {
  maxWidth: 760,
  marginBottom: 30,
};

const sectionEyebrow = {
  margin: 0,
  marginBottom: 10,
  color: "#f4cf67",
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

const sectionTitleSmall = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.1,
};

const sectionIntro = {
  marginTop: 14,
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
  boxShadow: "0 14px 28px rgba(0,0,0,0.18)",
};

const stepNumber = {
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
  margin: 0,
  marginBottom: 10,
  fontSize: 20,
};

const cardText = {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.6,
  opacity: 0.86,
};

const sectionTwoCol = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 24,
};

const aboutLeft = {
  minWidth: 0,
};

const aboutRight = {
  display: "flex",
  alignItems: "stretch",
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

const aboutHighlightCard = {
  width: "100%",
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

const galleryLarge = {
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
};

const mediaPlaceholderLabel = {
  fontSize: 28,
  fontWeight: 800,
  marginBottom: 10,
};

const mediaPlaceholderSubtext = {
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

const devSection = {
  padding: "40px 20px 90px",
};

const devCard = {
  width: "100%",
  maxWidth: 1180,
  margin: "0 auto",
  padding: 24,
  borderRadius: 24,
  background: "rgba(255,255,255,0.04)",
  border: "1px dashed rgba(255,255,255,0.16)",
};

const devButtons = {
  marginTop: 16,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const devButton = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: "#f4c431",
  color: "#171717",
  fontWeight: 800,
  cursor: "pointer",
};

const devButtonSecondary = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
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
  margin: 0,
  marginBottom: 8,
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

const footerLinkButton = {
  background: "transparent",
  border: "none",
  color: "white",
  opacity: 0.82,
  cursor: "pointer",
  fontSize: 14,
};