import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Splash() {
  const navigate = useNavigate();
  const { profile, canHost } = useGame();

  const loggedIn = !!profile;

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [openInfo, setOpenInfo] = useState(null);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 640;
  const isLaptop = screenWidth <= 1100;

  function toggleInfo(id) {
    setOpenInfo((current) => (current === id ? null : id));
  }

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

  const steps = [
    {
      id: "host",
      number: "1",
      title: "Host",
      short: "Create a session.",
      more: "The host starts the room, chooses the session setup, and shares the code with players.",
    },
    {
      id: "join",
      number: "2",
      title: "Join",
      short: "Players enter the code.",
      more: "Each player joins from their own device so everyone can take part in the same session.",
    },
    {
      id: "play",
      number: "3",
      title: "Play",
      short: "Compete in mini-games.",
      more: "Games generate rankings which can influence how the final split is suggested.",
    },
    {
      id: "split",
      number: "4",
      title: "Split",
      short: "Review and confirm.",
      more: "The final split is shown clearly, with options to review or adjust before confirmation.",
    },
  ];

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
          <div style={logoBox}>
            <img
              src="/branding/RollPay_Logo.png"
              alt="RollPay logo"
              style={logoImg}
            />
          </div>
          <div>
            <div style={brandText}>RollPay</div>
          </div>
        </div>

        <nav
          style={{
            ...navLinks,
            justifyContent: isPhone ? "center" : "flex-end",
          }}
        >
          <button
            style={navButton}
            onClick={() => scrollToSection("how-to-use")}
          >
            How it Works
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
      <section
        style={{
          ...heroSection,
          minHeight: isPhone ? "auto" : "92vh",
          padding: isPhone ? "36px 14px 28px" : "56px 20px 40px",
        }}
      >
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />
        {!isPhone && <div style={heroBubbleOne} />}
        {!isPhone && <div style={heroBubbleTwo} />}
        {!isPhone && <div style={heroBubbleThree} />}

        <div
          style={{
            ...heroCard,
            padding: isPhone
              ? "32px 18px"
              : isLaptop
              ? "42px 24px"
              : "52px 28px",
            borderRadius: isPhone ? 24 : 32,
          }}
        >
          <div style={heroLogoWrap}>
            <img
              src="/branding/RollPay_Logo.png"
              alt="RollPay logo"
              style={{
                ...heroLogo,
                maxWidth: isPhone ? 140 : 180,
              }}
            />
          </div>

          <p
            style={{
              ...eyebrow,
              fontSize: isPhone ? 12 : 14,
            }}
          >
            Multiplayer bill splitting
          </p>

          <h1
            style={{
              ...titleStyle,
              fontSize: isPhone ? "52px" : isLaptop ? "72px" : "96px",
            }}
          >
            RollPay
          </h1>

          <p
            style={{
              ...subtitleStyle,
              fontSize: isPhone ? 18 : isLaptop ? 23 : 30,
              lineHeight: isPhone ? 1.45 : 1.4,
            }}
          >
            Split the bill. Play the game. Let the results decide.
          </p>

          <div
            style={{
              ...buttonRowStyle,
              flexDirection: isPhone ? "column" : "row",
              alignItems: "center",
            }}
          >
            <button
              onClick={handleHostClick}
              style={{
                ...btnStyle,
                ...(hostUpgradeStyle ? upgradeBtn : primaryBtn),
                width: isPhone ? "100%" : "auto",
                maxWidth: isPhone ? 320 : "none",
              }}
            >
              {hostLabel}
            </button>

            <button
              onClick={handleJoinClick}
              style={{
                ...btnStyle,
                ...secondaryBtn,
                width: isPhone ? "100%" : "auto",
                maxWidth: isPhone ? 320 : "none",
              }}
            >
              Join Game
            </button>
          </div>

          {!canHost && loggedIn && (
            <p
              style={{
                ...smallTextStyle,
                fontSize: isPhone ? 13 : 14,
              }}
            >
              Player account active. Upgrade to unlock hosting.
            </p>
          )}

          {!loggedIn && (
            <p
              style={{
                ...smallTextStyle,
                fontSize: isPhone ? 13 : 14,
              }}
            >
              Hosting needs an account. Joining is free.
            </p>
          )}
        </div>
      </section>

      {/* HOW TO USE */}
      <section
        style={{ ...section, padding: isPhone ? "64px 14px" : "90px 20px" }}
        id="how-to-use"
      >
        <div style={sectionInner}>
          <p style={sectionEyebrow}>How it works</p>

          <h2
            style={{
              ...sectionTitle,
              fontSize: isPhone ? 34 : isLaptop ? 42 : 52,
            }}
          >
            One session. One game. One final split.
          </h2>

          <div
            style={{
              ...stepsGrid,
              gridTemplateColumns: isPhone
                ? "1fr"
                : isLaptop
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(4, minmax(0, 1fr))",
            }}
          >
            {steps.map((step) => (
              <div key={step.id} style={infoCard}>
                <div style={stepBadge}>{step.number}</div>
                <h3 style={cardTitle}>{step.title}</h3>
                <p style={cardText}>{step.short}</p>

                <button
                  type="button"
                  onClick={() => toggleInfo(step.id)}
                  style={infoButton}
                >
                  {openInfo === step.id ? "Hide info" : "More info"}
                </button>

                {openInfo === step.id && <p style={expandText}>{step.more}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        id="about-game"
        style={{
          ...sectionAlt,
          padding: isPhone ? "64px 14px" : "90px 20px",
        }}
      >
        <div style={sectionInnerWide}>
          <div
            style={{
              ...aboutGrid,
              gridTemplateColumns:
                isPhone || isLaptop
                  ? "1fr"
                  : "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
            }}
          >
            <div>
              <p style={sectionEyebrow}>About</p>
              <h2
                style={{
                  ...sectionTitle,
                  fontSize: isPhone ? 34 : isLaptop ? 42 : 52,
                }}
              >
                Bill splitting, made social.
              </h2>

              <p style={aboutText}>
                RollPay turns group payments into a shared social moment. Instead
                of making bill splitting feel awkward or overly transactional,
                the app adds quick mini-games, rankings, and a clear final split.
              </p>

              <p style={aboutText}>
                The prototype is designed for pubs, restaurants, parties, and
                casual group settings where users want the payment process to
                feel quick, fair, and more entertaining.
              </p>

              <p style={aboutMeta}>
                Built as a university proof-of-concept by the RollPay team.
              </p>
            </div>

            <div style={aboutSideCard}>
              <h3 style={cardTitle}>What makes it different?</h3>

              <ul style={featureList}>
                <li>Game-driven bill splitting</li>
                <li>Shared multiplayer sessions</li>
                <li>Cross-device play</li>
                <li>Clear ranked results</li>
                <li>Final split review before confirmation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section
        id="gallery"
        style={{
          ...section,
          padding: isPhone ? "64px 14px" : "90px 20px",
        }}
      >
        <div style={sectionInnerWide}>
          <p style={sectionEyebrow}>Gallery</p>
          <h2
            style={{
              ...sectionTitle,
              fontSize: isPhone ? 34 : isLaptop ? 42 : 52,
            }}
          >
            App previews
          </h2>
          <p
            style={{
              ...sectionIntro,
              fontSize: isPhone ? 16 : 18,
            }}
          >
            Preview the app flow, mini-games, and mobile access.
          </p>

          <div
            style={{
              ...galleryGrid,
              gridTemplateColumns: isPhone ? "1fr" : "repeat(12, 1fr)",
            }}
          >
            <div
              style={{
                ...galleryVideo,
                gridColumn: isPhone ? "span 1" : "span 12",
                minHeight: isPhone ? 220 : 320,
              }}
            >
              <div style={galleryLabel}>Gameplay Preview</div>
              <div style={gallerySubLabel}>
                Add a short gameplay trailer or session montage here.
              </div>
            </div>

            <div
              style={{
                ...galleryCard,
                gridColumn: isPhone ? "span 1" : isLaptop ? "span 6" : "span 3",
              }}
            >
              Lobby Preview
            </div>

            <div
              style={{
                ...galleryCard,
                ...qrGalleryCard,
                gridColumn: isPhone ? "span 1" : isLaptop ? "span 6" : "span 3",
              }}
            >
              <img
                src="/branding/RollPay_QR.png"
                alt="Scan to open RollPay on mobile"
                style={qrImage}
              />
              <div style={qrTitle}>Scan to play</div>
              <div style={qrText}>Open RollPay on your phone instantly.</div>
            </div>

            <div
              style={{
                ...galleryCard,
                gridColumn: isPhone ? "span 1" : isLaptop ? "span 6" : "span 3",
              }}
            >
              Mini-Game Preview
            </div>

            <div
              style={{
                ...galleryCard,
                gridColumn: isPhone ? "span 1" : isLaptop ? "span 6" : "span 3",
              }}
            >
              Results Preview
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={footer}>
        <div
          style={{
            ...footerInner,
            flexDirection: isPhone ? "column" : "row",
            alignItems: isPhone ? "flex-start" : "center",
          }}
        >
          <div>
            <h3 style={footerTitle}>RollPay</h3>
            <p style={footerText}>Multiplayer bill splitting made social.</p>
          </div>

          <div style={footerLinks}>
            <button
              style={footerLinkBtn}
              onClick={() => scrollToSection("how-to-use")}
            >
              How it Works
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
  width: 52,
  height: 52,
  borderRadius: 14,
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
  maxWidth: 860,
  width: "100%",
  textAlign: "center",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
};

const heroLogoWrap = {
  display: "flex",
  justifyContent: "center",
  marginBottom: 18,
};

const heroLogo = {
  width: "100%",
  height: "auto",
  objectFit: "contain",
  filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.30))",
};

const eyebrow = {
  margin: "0 0 12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.6,
  color: "#f6cf64",
};

const titleStyle = {
  margin: "0 0 12px",
  fontWeight: 900,
  lineHeight: 0.95,
};

const subtitleStyle = {
  margin: "0 auto 30px",
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
  opacity: 0.9,
  marginTop: "10px",
  lineHeight: 1.5,
};

const section = {
  padding: "90px 20px",
};

const sectionAlt = {
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
  lineHeight: 1.05,
};

const sectionIntro = {
  marginTop: 14,
  maxWidth: 760,
  lineHeight: 1.6,
  opacity: 0.88,
};

const stepsGrid = {
  display: "grid",
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

const infoButton = {
  marginTop: 14,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f6cf64",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const expandText = {
  margin: "12px 0 0",
  fontSize: 14,
  lineHeight: 1.55,
  opacity: 0.82,
};

const aboutGrid = {
  display: "grid",
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
  gap: 18,
  marginTop: 26,
};

const galleryVideo = {
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

const qrGalleryCard = {
  flexDirection: "column",
  gap: 12,
  padding: 16,
};

const qrImage = {
  width: "100%",
  maxWidth: 180,
  borderRadius: 16,
  background: "#fff",
  padding: 8,
  objectFit: "contain",
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
};

const qrTitle = {
  fontSize: 18,
  fontWeight: 800,
};

const qrText = {
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.82,
  fontWeight: 500,
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