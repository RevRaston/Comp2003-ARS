import express from "express";
import { adminSupabase } from "../server.mjs";

const router = express.Router();

/* -------------------------
   SAVE / UPSERT SELECTED LEVELS
-------------------------- */
router.post("/:sessionCode/levels", async (req, res) => {
  try {
    const { sessionCode } = req.params;
    const { round_number, level_key } = req.body || {};

    if (!round_number || !level_key) {
      return res.status(400).json({
        error: "round_number and level_key are required",
      });
    }

    const { data: sessionRow, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id")
      .eq("code", sessionCode)
      .single();

    if (sessionErr || !sessionRow) {
      console.error("[session levels POST] session lookup error:", sessionErr);
      return res.status(404).json({ error: "Session not found" });
    }

    const session_id = sessionRow.id;

    const { data, error } = await adminSupabase
      .from("session_levels")
      .upsert(
        {
          session_id,
          round_number,
          level_key,
        },
        {
          onConflict: "session_id,round_number",
        }
      )
      .select();

    if (error) {
      console.error("[session levels POST] upsert error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("[session levels POST] unexpected error:", err);
    res.status(500).json({ error: "Server failure" });
  }
});

/* -------------------------
   FETCH LEVEL PLAN
-------------------------- */
router.get("/:sessionCode/levels", async (req, res) => {
  try {
    const { sessionCode } = req.params;

    const { data: sessionRow, error: sessionErr } = await adminSupabase
      .from("sessions")
      .select("id")
      .eq("code", sessionCode)
      .single();

    if (sessionErr || !sessionRow) {
      console.error("[session levels GET] session lookup error:", sessionErr);
      return res.status(404).json({ error: "Session not found" });
    }

    const session_id = sessionRow.id;

    const { data, error } = await adminSupabase
      .from("session_levels")
      .select("*")
      .eq("session_id", session_id)
      .order("round_number", { ascending: true });

    if (error) {
      console.error("[session levels GET] fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ levels: data || [] });
  } catch (err) {
    console.error("[session levels GET] unexpected error:", err);
    res.status(500).json({ error: "Server failure" });
  }
});

export default router;