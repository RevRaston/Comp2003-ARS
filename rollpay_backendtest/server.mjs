// server.mjs
console.log("🔥 RUNNING SERVER:");
console.log("🔥 PATH:", import.meta.url);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import QRCode from "qrcode";

import sessionLevelsRoutes from "./routes/sessionLevels.mjs";
import { attachWs } from "./wsServer.mjs";
import scanReceiptRoutes from "./routes/scanReceipt.mjs";
import {
  sendDemoEmail,
  buildCreditReceiptEmail,
} from "./email/sendEmail.mjs";

dotenv.config();

function generateSessionCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPlayerName(player, fallbackIndex = 0) {
  return (
    player?.name ||
    player?.display_name ||
    player?.displayName ||
    `Player ${fallbackIndex + 1}`
  );
}

function normalizeRoundEntry(entry, fallbackRound = 1) {
  return {
    round: Number(entry?.round || fallbackRound),
    gameId: String(entry?.gameId || entry?.game_id || "unknown"),
    winnerKey:
      entry?.winnerKey === undefined || entry?.winnerKey === null
        ? null
        : String(entry.winnerKey),
    winnerName: entry?.winnerName || null,
    scores: safeArray(entry?.scores),
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function buildFinalResults(sessionPlayers = [], roundResults = []) {
  const players = safeArray(sessionPlayers);

  const standings = players.map((player, index) => ({
    key: String(
      player?.user_id ??
        player?.userId ??
        player?.id ??
        player?.profile_id ??
        player?.profileId ??
        `player-${index + 1}`
    ),
    name: getPlayerName(player, index),
    wins: 0,
    score: 0,
    roundsPlayed: 0,
  }));

  const byKey = new Map(standings.map((p) => [p.key, p]));

  for (const result of safeArray(roundResults)) {
    const winnerKey =
      result?.winnerKey === undefined || result?.winnerKey === null
        ? null
        : String(result.winnerKey);

    if (winnerKey && byKey.has(winnerKey)) {
      byKey.get(winnerKey).wins += 1;
    }

    const scores = safeArray(result?.scores);

    if (scores.length > 0) {
      for (const scoreEntry of scores) {
        const candidateKeyRaw =
          scoreEntry?.winnerKey ??
          scoreEntry?.playerKey ??
          scoreEntry?.user_id ??
          scoreEntry?.userId ??
          scoreEntry?.id ??
          null;

        const candidateKey =
          candidateKeyRaw === null || candidateKeyRaw === undefined
            ? null
            : String(candidateKeyRaw);

        const candidateName = scoreEntry?.playerName || scoreEntry?.name || null;
        const numericScore = Number(scoreEntry?.score || 0);

        let row = candidateKey ? byKey.get(candidateKey) : null;

        if (!row && candidateName) {
          row = standings.find((p) => p.name === candidateName) || null;
        }

        if (row) {
          row.score += numericScore;
          row.roundsPlayed += 1;
        }
      }
    } else {
      for (const row of standings) {
        row.roundsPlayed += 1;
      }
    }
  }

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return standings.map((player, index) => ({
    rank: index + 1,
    key: player.key,
    name: player.name,
    wins: player.wins,
    totalScore: player.score,
    roundsPlayed: player.roundsPlayed,
    recommended: 0,
  }));
}

let currentGame = {
  players: [],
  total_cost: 0,
  rule: "winner_free",
};

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use("/", scanReceiptRoutes);

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

function supaForRequest(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: req.headers.authorization || "" } },
  });
}

function creditsToPounds(credits) {
  return Number(credits || 0) / 100;
}

function poundsToCredits(amount) {
  return Math.round(Number(amount || 0) * 100);
}

app.get("/", (req, res) => {
  res.send("✅ RollPay backend is running!");
});

/* AUTH */
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "User created!", data });
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Signed in!", data });
});

/* CARDS */
app.get("/cards", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supa
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ cards: data });
});

app.post("/cards", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { card_holder, card_number, expiry_month, expiry_year, cvv } = req.body;

  const { data, error } = await supa
    .from("cards")
    .insert([
      {
        user_id: user.id,
        card_holder,
        card_number,
        expiry_month,
        expiry_year,
        cvv,
      },
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Card added!", data });
});

app.delete("/cards/:id", async (req, res) => {
  const supa = supaForRequest(req);

  const userInfo = await supa.auth.getUser();

  if (userInfo.error || !userInfo.data.user) {
    return res.status(401).json({
      error: "Token invalid",
      detail: userInfo.error,
    });
  }

  const user = userInfo.data.user;

  const { error } = await supa
    .from("cards")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", user.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Card deleted!" });
});

/* CREDITS */
app.post("/credits/buy", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const amount = Number(req.body?.amount || 0);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid credit amount" });
  }

  try {
    const { data: profile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (!profile.card_brand || !profile.card_last4) {
      return res.status(400).json({
        error: "Generate a demo card before buying credits.",
      });
    }

    const currentBalance = Number(profile.credits_balance || 0);
    const newBalance = currentBalance + amount;

    const { data: updated, error: updateErr } = await adminSupabase
      .from("profiles")
      .update({ credits_balance: newBalance })
      .eq("id", user.id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to update credits balance",
        detail: updateErr.message,
      });
    }

    try {
      const email = buildCreditReceiptEmail({
        displayName: updated.display_name || user.email || "Player",
        creditsPurchased: amount,
        newBalance,
        cardBrand: updated.card_brand,
        cardLast4: updated.card_last4,
      });

      await sendDemoEmail({
        to: user.email,
        ...email,
      });
    } catch (emailErr) {
      console.error("[credits/buy] email skipped/failed:", emailErr);
    }

    return res.json({
      ok: true,
      creditsPurchased: amount,
      creditsBalance: newBalance,
      profile: updated,
      emailSent: true,
    });
  } catch (err) {
    console.error("[credits/buy] error:", err);

    return res.status(500).json({
      error: "Failed to buy credits",
      detail: String(err),
    });
  }
});

app.post("/credits/purchase", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { amount } = req.body || {};
  const pounds = Number(amount || 0);

  if (!pounds || pounds <= 0) {
    return res.status(400).json({ error: "Invalid purchase amount" });
  }

  const creditsToAdd = poundsToCredits(pounds);

  try {
    const { data: profile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("id, display_name, credits_balance, card_brand, card_last4")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (!profile.card_brand || !profile.card_last4) {
      return res.status(400).json({
        error: "Generate a demo card before buying credits.",
        requiresCard: true,
      });
    }

    const currentBalance = Number(profile.credits_balance || 0);
    const nextBalance = currentBalance + creditsToAdd;

    const { data: updated, error: updateErr } = await adminSupabase
      .from("profiles")
      .update({ credits_balance: nextBalance })
      .eq("id", user.id)
      .select("id, display_name, credits_balance, card_brand, card_last4")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to update credit balance",
        detail: updateErr.message,
      });
    }

    const receiptPayload = {
      type: "credit_purchase",
      userId: user.id,
      email: user.email,
      amountPounds: pounds,
      creditsAdded: creditsToAdd,
      newBalance: nextBalance,
      createdAt: new Date().toISOString(),
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(receiptPayload));

    try {
      await sendDemoEmail({
        to: user.email,
        subject: "RollPay credits purchase receipt",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5">
            <h2>RollPay Credits Receipt</h2>
            <p>Hi ${profile.display_name || "Player"},</p>
            <p>You bought <strong>${creditsToAdd} credits</strong>.</p>
            <p>Amount: <strong>£${pounds.toFixed(2)}</strong></p>
            <p>Demo card: <strong>${profile.card_brand} •••• ${
          profile.card_last4
        }</strong></p>
            <p>New balance: <strong>${nextBalance} credits</strong> (£${creditsToPounds(
          nextBalance
        ).toFixed(2)})</p>
            <p>QR receipt:</p>
            <img src="${qrDataUrl}" alt="RollPay receipt QR" style="width:180px;height:180px" />
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[credits/purchase] email skipped/failed:", emailErr);
    }

    res.json({
      ok: true,
      creditsAdded: creditsToAdd,
      creditsBalance: updated.credits_balance,
      qrDataUrl,
      profile: updated,
    });
  } catch (err) {
    console.error("[credits purchase] error:", err);
    res.status(500).json({
      error: "Failed to purchase credits",
      detail: String(err),
    });
  }
});

app.get("/credits/balance", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data, error } = await adminSupabase
    .from("profiles")
    .select("id, display_name, credits_balance, card_brand, card_last4")
    .eq("id", user.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({
    ok: true,
    creditsBalance: Number(data.credits_balance || 0),
    poundsValue: creditsToPounds(data.credits_balance || 0),
    profile: data,
  });
});

/* OLD MINI-MVP GAME LOGIC */
app.post("/game/players", (req, res) => {
  const { players, total_cost, rule } = req.body;

  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Provide at least 2 players." });
  }

  const cleanPlayers = players.map((p) => ({ name: String(p).trim() }));
  const total = Number(total_cost);

  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "Invalid total_cost" });
  }

  currentGame = {
    players: cleanPlayers,
    total_cost: total,
    rule: rule === "even_split" ? "even_split" : "winner_free",
  };

  res.json({ message: "Game created.", game: currentGame });
});

app.post("/game/start", (req, res) => {
  if (!currentGame.players || currentGame.players.length < 2) {
    return res.status(400).json({ error: "No game set." });
  }

  const { players, total_cost, rule } = currentGame;
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  shuffled.forEach((p, i) => {
    p.rank = i + 1;
  });

  let results;

  if (rule === "even_split") {
    const share = total_cost / players.length;
    results = shuffled.map((p) => ({
      ...p,
      recommended: Number(share.toFixed(2)),
    }));
  } else {
    const losers = shuffled.slice(1);
    const loserShare = total_cost / losers.length;

    results = shuffled.map((p, i) => ({
      ...p,
      recommended: i === 0 ? 0 : Number(loserShare.toFixed(2)),
    }));
  }

  currentGame.players = results;

  res.json({ players: results, rule, total_cost });
});

/* SESSIONS */
app.post("/sessions", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { total_cost, rule, host_name } = req.body;
  const total = Number(total_cost);

  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "Invalid cost" });
  }

  let code;

  for (let i = 0; i < 10; i++) {
    const test = generateSessionCode();
    const { data: exists } = await supa
      .from("sessions")
      .select("id")
      .eq("code", test)
      .maybeSingle();

    if (!exists) {
      code = test;
      break;
    }
  }

  const { data: session, error } = await supa
    .from("sessions")
    .insert([
      {
        code,
        host_id: user.id,
        total_cost: total,
        rule,
        status: "waiting",
        current_round: null,
        round_results: [],
        final_results: [],
      },
    ])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (host_name) {
    await supa.from("session_players").insert([
      {
        session_id: session.id,
        user_id: user.id,
        name: host_name,
        is_host: true,
      },
    ]);
  }

  res.json({
    session_id: session.id,
    code: session.code,
    total_cost: session.total_cost,
    rule: session.rule,
  });
});

app.post("/sessions/:code/start", async (req, res) => {
  const { code } = req.params;
  const supa = supaForRequest(req);

  const { data: session, error: sessionErr } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (sessionErr || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({ error: "Session already started" });
  }

  const { error: updateErr } = await supa
    .from("sessions")
    .update({ status: "in_progress" })
    .eq("id", session.id);

  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  res.json({
    success: true,
    message: "Session started!",
    session_id: session.id,
  });
});

app.post("/sessions/:code/start-round", async (req, res) => {
  const { code } = req.params;
  const { round_number } = req.body || {};

  const roundNum = Number(round_number) || 1;

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("*")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({ current_round: roundNum })
      .eq("id", session.id)
      .select("id, code, current_round")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to update current_round",
        detail: updateErr.message,
      });
    }

    return res.json({ ok: true, session: updated });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to update current_round",
      detail: String(err),
    });
  }
});

app.post("/sessions/:code/round-result", async (req, res) => {
  const { code } = req.params;
  const { roundResult } = req.body || {};

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code, round_results, current_round")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!roundResult || typeof roundResult !== "object") {
      return res.status(400).json({ error: "Missing roundResult payload" });
    }

    const currentResults = safeArray(session.round_results);
    const normalizedIncoming = normalizeRoundEntry(
      roundResult,
      Number(session.current_round || 1)
    );

    const nextResults = currentResults.filter(
      (entry) =>
        !(
          Number(entry?.round || 0) === normalizedIncoming.round &&
          String(entry?.gameId || "unknown") === normalizedIncoming.gameId
        )
    );

    nextResults.push(normalizedIncoming);
    nextResults.sort((a, b) => Number(a.round || 0) - Number(b.round || 0));

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({ round_results: nextResults })
      .eq("id", session.id)
      .select("id, code, round_results")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to save round result",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      roundResults: updated.round_results || [],
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to save round result",
      detail: String(err),
    });
  }
});

app.get("/sessions/:code/round-results", async (req, res) => {
  const { code } = req.params;

  try {
    const { data: session, error } = await adminSupabase
      .from("sessions")
      .select("id, code, round_results")
      .eq("code", code)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      ok: true,
      roundResults: session.round_results || [],
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch round results",
      detail: String(err),
    });
  }
});

app.post("/sessions/:code/advance-round", async (req, res) => {
  const { code } = req.params;

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code, current_round")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const currentRound = Number(session.current_round || 1);
    const nextRound = currentRound + 1;

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({ current_round: nextRound })
      .eq("id", session.id)
      .select("id, code, current_round")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to advance round",
        detail: updateErr.message,
      });
    }

    return res.json({ ok: true, session: updated });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to advance round",
      detail: String(err),
    });
  }
});

app.post("/sessions/:code/finish", async (req, res) => {
  const { code } = req.params;

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code, status, total_cost, rule, round_results")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: players, error: playersErr } = await adminSupabase
      .from("session_players")
      .select("*")
      .eq("session_id", session.id)
      .order("is_host", { ascending: false });

    if (playersErr) {
      return res.status(500).json({
        error: "Failed to load players for final results",
        detail: playersErr.message,
      });
    }

    let finalResults = buildFinalResults(players || [], session.round_results || []);

    const totalCost = Number(session.total_cost || 0);
    const rule = session.rule || "winner_free";

    if (finalResults.length > 0) {
      if (rule === "even_split") {
        const share = totalCost / finalResults.length;
        finalResults = finalResults.map((player) => ({
          ...player,
          recommended: Number(share.toFixed(2)),
        }));
      } else {
        const loserCount = Math.max(finalResults.length - 1, 0);
        const loserShare = loserCount > 0 ? totalCost / loserCount : 0;

        finalResults = finalResults.map((player, index) => ({
          ...player,
          recommended: Number((index === 0 ? 0 : loserShare).toFixed(2)),
        }));
      }
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({
        status: "finished",
        final_results: finalResults,
      })
      .eq("id", session.id)
      .select("id, code, status, final_results")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to finish session",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
      finalResults: updated.final_results || [],
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to finish session",
      detail: String(err),
    });
  }
});

app.get("/sessions/:code", async (req, res) => {
  const { code } = req.params;

  let current_user_id = null;

  try {
    const authed = supaForRequest(req);
    const {
      data: { user },
    } = await authed.auth.getUser();
    current_user_id = user ? user.id : null;
  } catch {
    current_user_id = null;
  }

  const { data: session, error } = await adminSupabase
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { data: players, error: playersErr } = await adminSupabase
    .from("session_players")
    .select("*")
    .eq("session_id", session.id)
    .order("is_host", { ascending: false });

  if (playersErr) {
    return res.status(500).json({ error: playersErr.message });
  }

  res.json({
    session,
    players: players || [],
    roundResults: session.round_results || [],
    finalResults: session.final_results || [],
    current_user_id,
  });
});

app.post("/sessions/:code/join", async (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  const supa = supaForRequest(req);

  const {
    data: { user },
  } = await supa.auth.getUser();

  const { data: session, error } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({ error: "Session already started" });
  }

  const { data: row, error: joinErr } = await supa
    .from("session_players")
    .insert([
      {
        session_id: session.id,
        user_id: user?.id || null,
        name,
        is_host: false,
      },
    ])
    .select()
    .single();

  if (joinErr) return res.status(400).json({ error: joinErr.message });

  res.json({
    session_id: session.id,
    player_id: row.id,
    name: row.name,
  });
});

/* CONFIRMED SPLIT */
app.post("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;
  const { confirmedSplit } = req.body || {};

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!confirmedSplit || typeof confirmedSplit !== "object") {
      return res.status(400).json({ error: "Missing confirmedSplit payload" });
    }

    const payload = {
      ...confirmedSplit,
      saved_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({
        confirmed_split: payload,
        split_confirmed_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select("id, code, confirmed_split, split_confirmed_at")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to save confirmed split",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to save confirmed split",
      detail: String(err),
    });
  }
});

app.get("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;

  try {
    const { data: session, error } = await adminSupabase
      .from("sessions")
      .select("id, code, confirmed_split, split_confirmed_at")
      .eq("code", code)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      ok: true,
      confirmedSplit: session.confirmed_split || null,
      splitConfirmedAt: session.split_confirmed_at || null,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch confirmed split",
      detail: String(err),
    });
  }
});

app.delete("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: updated, error: updateErr } = await adminSupabase
      .from("sessions")
      .update({
        confirmed_split: null,
        split_confirmed_at: null,
      })
      .eq("id", session.id)
      .select("id, code, confirmed_split, split_confirmed_at")
      .single();

    if (updateErr) {
      return res.status(500).json({
        error: "Failed to clear confirmed split",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to clear confirmed split",
      detail: String(err),
    });
  }
});

app.post("/sessions/:code/send-final-receipt", async (req, res) => {
  const { code } = req.params;
  const { confirmedSplit } = req.body || {};

  if (!confirmedSplit || typeof confirmedSplit !== "object") {
    return res.status(400).json({ error: "Missing confirmedSplit payload" });
  }

  try {
    const { data: session, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id, code, final_results, confirmed_split")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: sessionPlayers, error: playersErr } = await adminSupabase
      .from("session_players")
      .select("user_id, name")
      .eq("session_id", session.id);

    if (playersErr) {
      return res.status(500).json({ error: playersErr.message });
    }

    const receiptPayload = {
      type: "final_split",
      sessionCode: code,
      rankings: session.final_results || [],
      confirmedSplit,
      createdAt: new Date().toISOString(),
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(receiptPayload));

    const allocationRows = (confirmedSplit.finalAllocation || [])
      .map(
        (p) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">${p.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">Rank ${
              p.rank || "-"
            }</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">£${Number(
              p.total || 0
            ).toFixed(2)}</td>
          </tr>
        `
      )
      .join("");

    const rankingRows = (session.final_results || [])
      .map(
        (p) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">#${p.rank}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${p.name}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${
              p.wins || 0
            } wins</td>
          </tr>
        `
      )
      .join("");

    let sentCount = 0;

    for (const player of sessionPlayers || []) {
      if (!player.user_id) continue;

      let email = null;

      try {
        const { data: authUser } =
          await adminSupabase.auth.admin.getUserById(player.user_id);
        email = authUser?.user?.email || null;
      } catch {
        email = null;
      }

      if (!email) continue;

      try {
        await sendDemoEmail({
          to: email,
          subject: `RollPay final split receipt — ${code}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>RollPay Final Split</h2>
              <p>Session: <strong>${code}</strong></p>

              <h3>Game ranking</h3>
              <table style="border-collapse:collapse;width:100%;max-width:520px">
                ${rankingRows || "<tr><td>No rankings available</td></tr>"}
              </table>

              <h3>Who owes what</h3>
              <table style="border-collapse:collapse;width:100%;max-width:520px">
                ${allocationRows || "<tr><td>No split available</td></tr>"}
              </table>

              <p>Total: <strong>£${Number(
                confirmedSplit.finalTotal || 0
              ).toFixed(2)}</strong></p>

              <p>QR summary:</p>
              <img src="${qrDataUrl}" alt="RollPay final split QR" style="width:180px;height:180px" />
            </div>
          `,
        });

        sentCount += 1;
      } catch (emailErr) {
        console.error("[send-final-receipt] email skipped/failed:", emailErr);
      }
    }

    res.json({
      ok: true,
      sentCount,
      qrDataUrl,
    });
  } catch (err) {
    console.error("[send final receipt] error:", err);

    res.status(500).json({
      error: "Failed to send final receipt",
      detail: String(err),
    });
  }
});

/* SESSION LEVEL ROUTES */
app.use("/sessions", sessionLevelsRoutes);

/* START SERVER */
const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

attachWs(server, { path: "/ws" });

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🧠 WS running at ws://localhost:${PORT}/ws`);
});