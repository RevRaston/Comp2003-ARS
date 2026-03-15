// src/pages/Profile.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useGame } from "../GameContext";
import AvatarBuilder from "../components/AvatarBuilder";

export default function Profile() {
  const navigate = useNavigate();
  const { profile, setProfile } = useGame();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [displayName, setDisplayName] = useState(
    profile?.displayName || profile?.display_name || ""
  );

  // avatarJson is ALWAYS a string in React state
  const [avatarJson, setAvatarJson] = useState(() => {
    if (!profile) return null;
    if (profile.avatarJson) return profile.avatarJson;
    if (profile.avatar_json) return JSON.stringify(profile.avatar_json);
    return null;
  });

  const [cardBrand, setCardBrand] = useState(profile?.cardBrand || "");
  const [cardLast4, setCardLast4] = useState(profile?.cardLast4 || "");
  const [loading, setLoading] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(false);

  const isHost = !!profile?.canHost;
  const isAdmin = !!profile?.isAdmin;

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.display_name || "");
    if (profile.avatarJson) {
      setAvatarJson(profile.avatarJson);
    } else if (profile.avatar_json) {
      setAvatarJson(JSON.stringify(profile.avatar_json));
    }
    setCardBrand(profile.cardBrand || "");
    setCardLast4(profile.cardLast4 || "");
  }, [profile]);

  const isPhone = screenWidth <= 640;
  const isLaptop = screenWidth <= 1100;

  const shownName =
    displayName?.trim() ||
    profile?.displayName ||
    profile?.display_name ||
    profile?.email ||
    "Player";

  const initials = useMemo(() => {
    const parts = String(shownName).trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "RP";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [shownName]);

  if (!profile) {
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
            <button style={navButton} onClick={() => navigate("/host-session")}>
              Host
            </button>
            <button style={navButtonActive} onClick={() => navigate("/profile")}>
              Profile
            </button>
          </nav>
        </header>

        <section
          style={{
            ...heroSection,
            minHeight: "calc(100vh - 76px)",
            padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
          }}
        >
          <div style={heroGlowOne} />
          <div style={heroGlowTwo} />

          <div style={authCard}>
            <p style={sectionEyebrow}>Profile</p>
            <h1 style={pageTitle}>You need to sign in</h1>
            <p style={introText}>
              Sign in to view or edit your RollPlay profile, avatar, and hosting setup.
            </p>
            <button style={primaryButton} onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </div>
        </section>
      </div>
    );
  }

  function generateFakeCard() {
    const brands = ["DemoCard", "VISA", "MasterCard"];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const last4 = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return { brand, last4 };
  }

  async function handleSaveProfile() {
    setError("");
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }

    try {
      setLoading(true);

      const avatarObject = avatarJson ? JSON.parse(avatarJson) : null;

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          avatar_json: avatarObject,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedAvatarObj = data.avatar_json ?? avatarObject;
      const updatedAvatarJson = updatedAvatarObj
        ? JSON.stringify(updatedAvatarObj)
        : null;

      const updatedProfile = {
        ...profile,
        displayName: data.display_name,
        avatarJson: updatedAvatarJson,
        cardBrand: data.card_brand || profile.cardBrand || null,
        cardLast4: data.card_last4 || profile.cardLast4 || null,
        tier: data.tier || profile.tier || "player",
        isAdmin,
        canHost: (data.tier || profile.tier) === "host" || isAdmin,
      };

      setProfile(updatedProfile);
      setAvatarJson(updatedProfile.avatarJson);
      setCardBrand(updatedProfile.cardBrand || "");
      setCardLast4(updatedProfile.cardLast4 || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateCard() {
    setError("");
    try {
      setSavingCard(true);
      const { brand, last4 } = generateFakeCard();

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          card_brand: brand,
          card_last4: last4,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = {
        ...profile,
        displayName: data.display_name,
        avatarJson: avatarJson,
        cardBrand: data.card_brand || null,
        cardLast4: data.card_last4 || null,
        tier: data.tier || profile.tier || "player",
        isAdmin,
        canHost: (data.tier || profile.tier) === "host" || isAdmin,
      };

      setProfile(updatedProfile);
      setCardBrand(updatedProfile.cardBrand || "");
      setCardLast4(updatedProfile.cardLast4 || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate demo card");
    } finally {
      setSavingCard(false);
    }
  }

  async function handleUpgradeToHost() {
    setError("");
    try {
      setUpgrading(true);

      const needsCard = !cardBrand || !cardLast4;
      const { brand, last4 } = needsCard
        ? generateFakeCard()
        : { brand: cardBrand, last4: cardLast4 };

      const avatarObject = avatarJson ? JSON.parse(avatarJson) : null;

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          tier: "host",
          card_brand: brand,
          card_last4: last4,
          avatar_json: avatarObject,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedAvatarObj = data.avatar_json ?? avatarObject;
      const updatedAvatarJson = updatedAvatarObj
        ? JSON.stringify(updatedAvatarObj)
        : null;

      const updatedProfile = {
        ...profile,
        displayName: data.display_name,
        avatarJson: updatedAvatarJson,
        cardBrand: data.card_brand || null,
        cardLast4: data.card_last4 || null,
        tier: data.tier || "host",
        isAdmin,
        canHost: true,
      };

      setProfile(updatedProfile);
      setAvatarJson(updatedProfile.avatarJson);
      setCardBrand(updatedProfile.cardBrand || "");
      setCardLast4(updatedProfile.cardLast4 || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to upgrade account");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error during sign out:", err);
    }

    localStorage.removeItem("user_id");
    localStorage.removeItem("session_code");
    localStorage.removeItem("session_id");
    localStorage.removeItem("session_is_host");

    setProfile(null);
    navigate("/login");
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
          <button style={navButton} onClick={() => navigate("/host-session")}>
            Host
          </button>
          <button style={navButtonActive} onClick={() => navigate("/profile")}>
            Profile
          </button>
        </nav>
      </header>

      <section
        style={{
          ...heroSection,
          padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
        }}
      >
        <div style={heroGlowOne} />
        <div style={heroGlowTwo} />
        {!isPhone && <div style={heroBubbleOne} />}
        {!isPhone && <div style={heroBubbleTwo} />}

        <div
          style={{
            ...profileLayout,
            gridTemplateColumns:
              isPhone || isLaptop
                ? "1fr"
                : "minmax(320px, 0.82fr) minmax(0, 1.18fr)",
            gap: isPhone ? 18 : 24,
          }}
        >
          {/* LEFT SIDE */}
          <div style={sideCard}>
            <p style={sectionEyebrow}>Profile overview</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Your profile
            </h1>

            <p style={introText}>
              This profile is used across all sessions, games, and multiplayer lobbies.
            </p>

            <div style={profileSummaryCard}>
              <div style={avatarCircle}>{initials}</div>

              <div style={{ minWidth: 0 }}>
                <div style={profileLabel}>Display name</div>
                <div style={profileName}>{shownName}</div>
                <div style={profileSubtext}>
                  {isHost ? "Host account" : "Player account"}
                  {isAdmin ? " · Admin / Dev" : ""}
                </div>
              </div>
            </div>

            <div style={statusGrid}>
              <div style={statusCard}>
                <div style={statusLabel}>Account Tier</div>
                <div style={statusValue}>{isHost ? "Host" : "Player"}</div>
              </div>

              <div style={statusCard}>
                <div style={statusLabel}>Demo Card</div>
                <div style={statusValue}>
                  {cardBrand && cardLast4 ? `${cardBrand} • ${cardLast4}` : "Not added"}
                </div>
              </div>
            </div>

            <div style={tipsCard}>
              <h3 style={smallCardTitle}>What this page controls</h3>
              <ul style={tipsList}>
                <li>Your public display name in sessions</li>
                <li>Your avatar and appearance</li>
                <li>Your demo card and host upgrade status</li>
              </ul>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div style={mainColumn}>
            {error && <p style={errorText}>{error}</p>}

            {/* BASIC DETAILS */}
            <div style={contentCard}>
              <p style={sectionEyebrow}>Profile details</p>
              <h2 style={cardHeading}>Basic information</h2>

              <div style={fieldBlock}>
                <label style={labelStyle}>Display Name</label>
                <p style={helperText}>
                  This is the name shown to other players in the lobby and arena.
                </p>
                <input
                  style={inputStyle}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Fluff, Ryan, DartsKing"
                />
              </div>
            </div>

            {/* AVATAR */}
            <div style={contentCard}>
              <p style={sectionEyebrow}>Avatar</p>
              <h2 style={cardHeading}>Appearance</h2>

              {!editingAvatar && (
                <>
                  <div style={{ maxWidth: 520, margin: "0 auto" }}>
                    <AvatarBuilder
                      initialAvatar={avatarJson}
                      onAvatarChange={null}
                    />
                  </div>

                  <div style={buttonGroup}>
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={() => setEditingAvatar(true)}
                    >
                      Edit Appearance
                    </button>
                  </div>
                </>
              )}

              {editingAvatar && (
                <>
                  <div style={{ maxWidth: 520, margin: "0 auto" }}>
                    <AvatarBuilder
                      initialAvatar={avatarJson}
                      onAvatarChange={(model) => {
                        setAvatarJson(JSON.stringify(model));
                      }}
                    />
                  </div>

                  <div
                    style={{
                      ...buttonGroup,
                      flexDirection: isPhone ? "column" : "row",
                    }}
                  >
                    <button
                      type="button"
                      style={primaryButton}
                      onClick={() => {
                        setEditingAvatar(false);
                      }}
                    >
                      Done Editing
                    </button>

                    <button
                      type="button"
                      style={ghostButton}
                      onClick={() => {
                        if (profile.avatarJson) {
                          setAvatarJson(profile.avatarJson);
                        } else if (profile.avatar_json) {
                          setAvatarJson(JSON.stringify(profile.avatar_json));
                        } else {
                          setAvatarJson(null);
                        }
                        setEditingAvatar(false);
                      }}
                    >
                      Cancel Changes
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* HOSTING / CARD */}
            <div style={contentCard}>
              <p style={sectionEyebrow}>Hosting</p>
              <h2 style={cardHeading}>Demo card & upgrade</h2>

              <p style={infoText}>
                Card details are <strong>demo-only</strong> and never charged. They are
                only used as part of the project flow and hosting setup.
              </p>

              <div style={summaryPanel}>
                <div style={summaryRow}>
                  <span style={summaryLabel}>Current demo card</span>
                  <strong style={summaryValue}>
                    {cardBrand && cardLast4
                      ? `${cardBrand} • **** **** **** ${cardLast4}`
                      : "No demo card yet"}
                  </strong>
                </div>

                <div style={summaryRow}>
                  <span style={summaryLabel}>Hosting access</span>
                  <strong style={summaryValue}>
                    {isHost ? "Unlocked" : "Not unlocked"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  ...buttonGroup,
                  flexDirection: isPhone ? "column" : "row",
                }}
              >
                <button
                  type="button"
                  onClick={handleGenerateCard}
                  disabled={savingCard}
                  style={secondaryButton}
                >
                  {savingCard ? "Generating..." : "Generate Demo Card"}
                </button>

                {!isHost && (
                  <button
                    type="button"
                    onClick={handleUpgradeToHost}
                    disabled={upgrading}
                    style={primaryButton}
                  >
                    {upgrading
                      ? "Processing..."
                      : "Pay for the Game (Upgrade to Host)"}
                  </button>
                )}
              </div>
            </div>

            {/* ACTIONS */}
            <div style={contentCard}>
              <p style={sectionEyebrow}>Actions</p>
              <h2 style={cardHeading}>Save or leave</h2>

              <div
                style={{
                  ...buttonGroup,
                  flexDirection: isPhone ? "column" : "row",
                }}
              >
                <button
                  style={primaryButton}
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>

                <button style={ghostButton} onClick={() => navigate("/")}>
                  Cancel
                </button>

                <button
                  style={dangerGhostButton}
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
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
  justifyContent: "center",
  overflow: "hidden",
  paddingBottom: 48,
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

const profileLayout = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1180,
  display: "grid",
  alignItems: "start",
};

const sideCard = {
  background: "rgba(0, 0, 0, 0.38)",
  borderRadius: 30,
  padding: "28px 24px",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
};

const mainColumn = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const contentCard = {
  background: "rgba(0, 0, 0, 0.42)",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  padding: "28px 24px",
};

const authCard = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 720,
  background: "rgba(0, 0, 0, 0.42)",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  padding: "32px 24px",
  textAlign: "center",
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

const cardHeading = {
  margin: "0 0 16px",
  fontSize: 30,
  lineHeight: 1.05,
};

const introText = {
  marginTop: 14,
  fontSize: 17,
  lineHeight: 1.65,
  opacity: 0.9,
};

const profileSummaryCard = {
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
  width: 68,
  height: 68,
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

const statusGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 18,
};

const statusCard = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const statusLabel = {
  fontSize: 12,
  opacity: 0.72,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const statusValue = {
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.4,
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

const fieldBlock = {
  marginBottom: 8,
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

const infoText = {
  margin: "0 0 18px",
  fontSize: 15,
  lineHeight: 1.75,
  opacity: 0.88,
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

const buttonGroup = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 12,
};

const errorText = {
  color: "#ff9a9a",
  fontWeight: 700,
  marginBottom: 4,
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

const ghostButton = {
  padding: "14px 22px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "transparent",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 140,
};

const dangerGhostButton = {
  ...ghostButton,
  border: "1px solid rgba(255,120,120,0.4)",
  color: "#ff9a9a",
};