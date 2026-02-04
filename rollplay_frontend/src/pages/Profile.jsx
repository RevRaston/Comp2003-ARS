// src/pages/Profile.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useGame } from "../GameContext";
import AvatarBuilder from "../components/AvatarBuilder";

export default function Profile() {
  const navigate = useNavigate();
  const { profile, setProfile } = useGame();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  // Keep avatarKey so we don't break any existing emoji-based usage elsewhere.
  const [avatarKey, setAvatarKey] = useState(profile?.avatarKey || "beer-mug");

  // New: local state for Alex-style avatar JSON (not persisted yet)
  const [avatarJson, setAvatarJson] = useState(null);

  const [cardBrand, setCardBrand] = useState(profile?.cardBrand || "");
  const [cardLast4, setCardLast4] = useState(profile?.cardLast4 || "");
  const [loading, setLoading] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");

  if (!profile) {
    return (
      <div style={wrapper}>
        <h1>Profile</h1>
        <p>You need to sign in first.</p>
        <button style={btnPrimary} onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    );
  }

  const isHost = profile.canHost;
  const isAdmin = !!profile.isAdmin;

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

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          // keep avatar_key logic as-is for now
          avatar_key: avatarKey,
          // later: add avatar_json column and persist avatarJson here
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = {
        ...profile,
        displayName: data.display_name,
        avatarKey: data.avatar_key,
        cardBrand: data.card_brand || profile.cardBrand || null,
        cardLast4: data.card_last4 || profile.cardLast4 || null,
        tier: data.tier || profile.tier || "player",
        isAdmin,
        canHost: (data.tier || profile.tier) === "host" || isAdmin,
      };

      setProfile(updatedProfile);
      setCardBrand(updatedProfile.cardBrand || "");
      setCardLast4(updatedProfile.cardLast4 || "");
      navigate("/");
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
        avatarKey: data.avatar_key,
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

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          tier: "host",
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
        avatarKey: data.avatar_key,
        cardBrand: data.card_brand || null,
        cardLast4: data.card_last4 || null,
        tier: data.tier || "host",
        isAdmin,
        canHost: true,
      };

      setProfile(updatedProfile);
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
    <div style={wrapper}>
      <h1 style={{ marginBottom: 10 }}>Your Profile</h1>
      <p style={{ opacity: 0.7, marginBottom: 8 }}>
        This profile is used across all games and sessions.
      </p>
      <p style={{ opacity: 0.85, marginBottom: 20 }}>
        <strong>Tier:</strong> {isHost ? "Host" : "Player"}{" "}
        {isAdmin && " · Admin / Dev"}
      </p>

      {error && (
        <p style={{ color: "salmon", marginBottom: 16 }}>{error}</p>
      )}

      {/* Display name */}
      <div style={{ marginBottom: 16, width: "100%" }}>
        <label style={label}>Display Name</label>
        <input
          style={input}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Fluff, Ryan, DartsKing"
        />
      </div>

      {/* Avatar builder (Alex-style) */}
      <div
        style={{
          width: "100%",
          marginBottom: 16,
          padding: 16,
          borderRadius: 12,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Avatar</h3>
        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 10 }}>
          Tweak your avatar look. This builder is based on Alex&apos;s prototype,
          refactored into the app. (Saving to the database comes in the next
          iteration.)
        </p>

        <AvatarBuilder
          initialAvatar={avatarJson}
          onAvatarChange={(av) => {
            try {
              setAvatarJson(JSON.stringify(av));
            } catch {
              // ignore parse errors
            }
          }}
        />
      </div>

      {/* Demo card + upgrade section */}
      <div
        style={{
          width: "100%",
          marginTop: 8,
          padding: 16,
          borderRadius: 12,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Demo Card & Hosting</h3>
        <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 12 }}>
          Card details are <strong>demo-only</strong> and never charged. We
          just use them as flavour for hosting & bill splitting.
        </p>

        {cardBrand && cardLast4 ? (
          <p style={{ marginBottom: 12 }}>
            <strong>{cardBrand}</strong> • **** **** **** {cardLast4}
          </p>
        ) : (
          <p style={{ marginBottom: 12, opacity: 0.7 }}>
            No demo card yet.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleGenerateCard}
            disabled={savingCard}
            style={btnSecondary}
          >
            {savingCard ? "Generating…" : "Generate Demo Card"}
          </button>

          {!isHost && (
            <button
              type="button"
              onClick={handleUpgradeToHost}
              disabled={upgrading}
              style={{
                ...btnPrimary,
                paddingInline: 20,
                fontSize: 14,
              }}
            >
              {upgrading ? "Processing…" : "Pay for the Game (Upgrade to Host)"}
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button
          style={btnPrimary}
          onClick={handleSaveProfile}
          disabled={loading}
        >
          {loading ? "Saving…" : "Save Profile"}
        </button>
        <button style={btnGhost} onClick={() => navigate("/")}>
          Cancel
        </button>
      </div>

      {/* Sign out */}
      <button
        style={{
          ...btnGhost,
          marginTop: 24,
          borderColor: "#ff6666",
          color: "#ff6666",
        }}
        onClick={handleSignOut}
      >
        Sign Out
      </button>
    </div>
  );
}

/* --- inline styles --- */

const wrapper = {
  paddingTop: 80,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  color: "white",
  textAlign: "left",
  maxWidth: 900, // widened for avatar builder
  margin: "0 auto",
};

const label = {
  display: "block",
  fontSize: 14,
  marginBottom: 6,
  opacity: 0.85,
};

const input = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #666",
  background: "#111",
  color: "white",
  fontSize: 16,
};

const btnPrimary = {
  padding: "10px 20px",
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

const btnGhost = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #666",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};
