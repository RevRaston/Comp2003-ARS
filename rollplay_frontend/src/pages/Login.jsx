// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useGame } from "../GameContext";

// Default avatar config for brand-new accounts
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
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ?mode=host or ?mode=player
  const { setProfile } = useGame();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(searchParams.get("mode") || "host");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ---------- helper: map DB row -> profile shape ----------
  function mapProfileRow(row) {
    if (!row) return null;

    const isAdmin = !!row.is_admin;
    const tier = row.tier || "player";

    return {
      id: row.id,
      displayName: row.display_name,
      avatarKey: row.avatar_key,          // legacy fallback
      avatarJson: row.avatar_json || null,
      cardBrand: row.card_brand || null,
      cardLast4: row.card_last4 || null,
      tier,
      isAdmin,
      canHost: tier === "host" || isAdmin,
    };
  }

  // ---------- helper: load or create profile ----------
  async function loadOrCreateProfile(user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // real error
    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // no profile yet → create default row
    if (!data) {
      const baseName = user.email?.split("@")[0] || "Player";

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

  // ---------- auto-login on refresh ----------
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        try {
          const profile = await loadOrCreateProfile(data.session.user);
          setProfile(profile);
        } catch (err) {
          console.error("Error loading profile on refresh:", err);
        }
      }
    });
  }, [setProfile]);

  // ---------- sign in / sign up ----------
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

      // store user_id for backend headers
      localStorage.setItem("user_id", user.id);

      const profile = await loadOrCreateProfile(user);
      setProfile(profile);

      // route based on host / player mode
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

      {/* Host vs Player toggle */}
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
