// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useGame } from "../GameContext";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ?mode=host or ?mode=player (optional)
  const { setProfile } = useGame();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(searchParams.get("mode") || "host");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -------- Helper: load / create profile --------
  async function loadOrCreateProfile(user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // If it's a real error (not "no rows"), throw
    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      // Create default profile
      const defaultDisplayName = user.email?.split("@")[0] || "Player";

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: defaultDisplayName,
          avatar_key: "beer-mug",
          card_brand: null,
          card_last4: null,
          // optional tier flags can be null/"player" by default
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        id: inserted.id,
        displayName: inserted.display_name,
        avatarKey: inserted.avatar_key,
        cardBrand: inserted.card_brand,
        cardLast4: inserted.card_last4,
        tier: inserted.tier || "player",
        isAdmin: inserted.is_admin || false,
        canHost:
          inserted.tier === "host" || inserted.is_admin === true,
      };
    }

    return {
      id: data.id,
      displayName: data.display_name,
      avatarKey: data.avatar_key,
      cardBrand: data.card_brand,
      cardLast4: data.card_last4,
      tier: data.tier || "player",
      isAdmin: data.is_admin || false,
      canHost: data.tier === "host" || data.is_admin === true,
    };
  }

  // -------- On mount: if already logged in, just hydrate profile (no redirect) --------
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const user = data.session.user;
        try {
          const profile = await loadOrCreateProfile(user);
          setProfile(profile);
          if (user.email) setEmail(user.email);
        } catch (err) {
          console.error("Failed to hydrate profile on login screen:", err);
        }
      }
    });
  }, [setProfile]);

  // -------- Sign in / sign up handler --------
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
      if (!user) throw new Error("No user returned from Supabase");

      // Store user_id for backend headers just like before
      localStorage.setItem("user_id", user.id);

      // Load or create profile
      const profile = await loadOrCreateProfile(user);
      setProfile(profile);

      // Decide where to go next
      if (!profile.displayName) {
        navigate("/profile");
      } else {
        if (mode === "player") {
          navigate("/join-session");
        } else {
          navigate("/host-session");
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        paddingTop: 80,
        minHeight: "100vh",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Sign In</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Use one account for hosting and playing.
      </p>

      {/* Host vs Player mode toggle (optional) */}
      <div style={{ display: "flex", marginBottom: 20, gap: 8 }}>
        <button
          type="button"
          onClick={() => setMode("host")}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid #777",
            background: mode === "host" ? "#ffcc33" : "transparent",
            color: mode === "host" ? "#222" : "white",
            cursor: "pointer",
          }}
        >
          Host
        </button>
        <button
          type="button"
          onClick={() => setMode("player")}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid #777",
            background: mode === "player" ? "#ffcc33" : "transparent",
            color: mode === "player" ? "#222" : "white",
            cursor: "pointer",
          }}
        >
          Player
        </button>
      </div>

      {error && (
        <p style={{ color: "salmon", marginBottom: 12 }}>{error}</p>
      )}

      <div style={{ width: "90%", maxWidth: 360 }}>
        <label style={{ display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label
          style={{ display: "block", marginBottom: 4, marginTop: 12 }}
        >
          Password
        </label>
        <input
          type="password"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            onClick={() => handleAuth("signin")}
            disabled={loading}
            style={btnPrimary}
          >
            {loading ? "Working..." : "Sign In"}
          </button>

          <button
            onClick={() => handleAuth("signup")}
            disabled={loading}
            style={btnSecondary}
          >
            {loading ? "Working..." : "Create Account"}
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 13, opacity: 0.7 }}>
          This uses Supabase auth. Card details are demo-only and not
          real payments.
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #666",
  background: "#111",
  color: "white",
  fontSize: 16,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "#ffcc33",
  color: "#222",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 600,
};

const btnSecondary = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #888",
  background: "#222",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};
