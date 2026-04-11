import { useEffect, useState } from "react";
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

export default function LoginCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setProfile } = useGame();

  const [message, setMessage] = useState("Signing you in...");

  function mapProfileRow(row) {
    if (!row) return null;

    const isAdmin = !!row.is_admin;
    const tier = row.tier || "player";

    return {
      id: row.id,
      displayName: row.display_name,
      avatarKey: row.avatar_key || null,
      avatarJson: row.avatar_json || null,
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

  useEffect(() => {
    let active = true;

    async function finishLogin() {
      try {
        const mode = searchParams.get("mode") || "host";

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = data.session?.user;
        const accessToken = data.session?.access_token;

        if (!user || !accessToken) {
          throw new Error("No active session after Google sign-in.");
        }

        localStorage.setItem("user_id", user.id);
        localStorage.setItem("access_token", accessToken);

        const profile = await loadOrCreateProfile(user);
        if (!active) return;

        setProfile(profile);
        setMessage("Success! Redirecting...");

        navigate(mode === "player" ? "/join-session" : "/host-session", {
          replace: true,
        });
      } catch (err) {
        console.error(err);
        if (!active) return;
        setMessage(err.message || "Google sign-in failed.");

        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 1200);
      }
    }

    finishLogin();

    return () => {
      active = false;
    };
  }, [navigate, searchParams, setProfile]);

  return (
    <div style={page}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={shell}>
        <div style={card}>
          <p style={eyebrow}>RollPlay</p>
          <h1 style={title}>Signing in</h1>
          <p style={text}>{message}</p>
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

const card = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 30,
  background: "rgba(0, 0, 0, 0.42)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
  padding: "32px 24px",
  textAlign: "center",
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

const text = {
  marginTop: 14,
  marginBottom: 0,
  fontSize: 17,
  lineHeight: 1.65,
  opacity: 0.9,
};