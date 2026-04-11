import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useGame } from "../GameContext";

const DEFAULT_AVATAR = {
  displayName: "Player",
  bodyShape: "round",
  skin: "#F2C7A5",
  hairStyle: "short",
  hair: "#2C1E1A",
  eyeStyle: "dots",
  eye: "#1A2433",
  mouthStyle: "smile",
  accessory: "none",
  outfit: "hoodie",
  outfitColor: "#7C5CFF",
  bg: "nebula",
  tilt: 0,
  badge: "common",
  throwStyle: "strong",
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setProfile } = useGame();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(searchParams.get("mode") || "host");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthHandling, setOauthHandling] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("mode") || "host");
  }, [searchParams]);

  function mapProfileRow(row) {
  if (!row) return null;

  const isAdmin = !!row.is_admin;
  const tier = row.tier || "player";

  return {
    id: row.id,
    displayName: row.display_name,
    avatarKey: row.avatar_key || null,
    avatarJson: row.avatar_json ? JSON.stringify(row.avatar_json) : null,
    avatar_json: row.avatar_json || null,
    cardBrand: row.card_brand || null,
    cardLast4: row.card_last4 || null,
    tier,
    isAdmin,
    canHost: tier === "host" || isAdmin,
  };
}

  async function loadOrCreateProfile(user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      const baseName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Player";

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: baseName,
          avatar_key: "beer-mug",
          avatar_json: {
            ...DEFAULT_AVATAR,
            displayName: baseName,
          },
          tier: "player",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return mapProfileRow(inserted);
    }

    return mapProfileRow(data);
  }

  useEffect(() => {
    let active = true;

    async function hydrateSessionAndRoute() {
      try {
        setOauthHandling(true);

        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session?.user) return;
        if (!active) return;

        const user = session.user;
        const accessToken = session.access_token;

        localStorage.setItem("user_id", user.id);
        localStorage.setItem("access_token", accessToken);

        const profile = await loadOrCreateProfile(user);
        if (!active) return;

        setProfile(profile);

        const currentMode = searchParams.get("mode") || "host";

        if (currentMode === "player") {
          navigate("/join-session", { replace: true });
        } else {
          navigate("/host-session", { replace: true });
        }
      } catch (err) {
        console.error("Error loading profile on refresh:", err);
      } finally {
        if (active) {
          setOauthHandling(false);
        }
      }
    }

    hydrateSessionAndRoute();

    return () => {
      active = false;
    };
  }, [navigate, searchParams, setProfile]);

  async function handleAuth(type) {
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      let result;
      if (type === "signup") {
        result = await supabase.auth.signUp({
          email,
          password,
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      if (result.error) throw result.error;

      const user = result.data.session?.user;
      const accessToken = result.data.session?.access_token;

      if (!user || !accessToken) {
        throw new Error("No user returned from Supabase");
      }

      localStorage.setItem("user_id", user.id);
      localStorage.setItem("access_token", accessToken);

      const profile = await loadOrCreateProfile(user);
      setProfile(profile);

      if (mode === "player") {
        navigate("/join-session");
      } else {
        navigate("/host-session");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError("");

    try {
      setLoading(true);

      const redirectTo = `${window.location.origin}/login?mode=${mode}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error(err);
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={shell}>
        <div style={heroCard}>
          <p style={eyebrow}>RollPlay account</p>
          <h1 style={title}>Sign in</h1>
          <p style={subtitle}>
            Use one account for hosting and joining sessions.
          </p>

          <div style={modeRow}>
            <button
              type="button"
              onClick={() => setMode("host")}
              style={{
                ...modeButton,
                ...(mode === "host" ? modeButtonActive : null),
              }}
            >
              Host
            </button>

            <button
              type="button"
              onClick={() => setMode("player")}
              style={{
                ...modeButton,
                ...(mode === "player" ? modeButtonActive : null),
              }}
            >
              Join
            </button>
          </div>

          {error ? <p style={errorText}>{error}</p> : null}

          <div style={formCard}>
            <label style={label}>Email</label>
            <input
              type="email"
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <label style={{ ...label, marginTop: 12 }}>Password</label>
            <input
              type="password"
              style={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />

            <div style={buttonCol}>
              <button
                type="button"
                onClick={() => handleAuth("signin")}
                disabled={loading || oauthHandling}
                style={primaryButton}
              >
                {loading || oauthHandling
                  ? "Working..."
                  : mode === "host"
                  ? "Sign in to Host"
                  : "Sign in to Join"}
              </button>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading || oauthHandling}
                style={secondaryButton}
              >
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleAuth("signup")}
                disabled={loading || oauthHandling}
                style={ghostButton}
              >
                {loading || oauthHandling ? "Working..." : "Create Account"}
              </button>
            </div>

            <p style={footnote}>
              Card details in RollPlay are demo-only and are not real payments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  color: "#fff",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
};

const glowOne = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.18)",
  filter: "blur(90px)",
  top: 60,
  left: -100,
};

const glowTwo = {
  position: "absolute",
  width: 440,
  height: 440,
  borderRadius: "50%",
  background: "rgba(255, 115, 64, 0.12)",
  filter: "blur(90px)",
  bottom: 40,
  right: -80,
};

const shell = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
  position: "relative",
  zIndex: 2,
};

const heroCard = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 30,
  background: "rgba(0, 0, 0, 0.42)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  padding: "32px 24px",
};

const eyebrow = {
  margin: 0,
  marginBottom: 10,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontSize: 13,
  fontWeight: 700,
};

const title = {
  margin: 0,
  lineHeight: 0.98,
  fontWeight: 900,
  fontSize: 54,
};

const subtitle = {
  marginTop: 14,
  marginBottom: 0,
  fontSize: 17,
  lineHeight: 1.65,
  opacity: 0.9,
};

const modeRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 22,
  marginBottom: 18,
};

const modeButton = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const modeButtonActive = {
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.34)",
  color: "#f6cf64",
};

const formCard = {
  marginTop: 8,
};

const label = {
  display: "block",
  marginBottom: 8,
  fontSize: 15,
  fontWeight: 700,
};

const input = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  boxSizing: "border-box",
};

const buttonCol = {
  marginTop: 18,
  display: "flex",
  flexDirection: "column",
  gap: 10,
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
};

const footnote = {
  marginTop: 18,
  marginBottom: 0,
  fontSize: 13,
  lineHeight: 1.6,
  opacity: 0.72,
};

const errorText = {
  color: "#ff9a9a",
  fontWeight: 700,
  marginBottom: 12,
};