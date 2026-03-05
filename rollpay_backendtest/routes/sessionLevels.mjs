import express from "express";
import { supabase } from "../supabaseClient.mjs";



const router = express.Router();

/* -------------------------
   SAVE / UPSERT SELECTED LEVELS
-------------------------- */
router.post("/:sessionCode/levels", async (req, res) => {
  try {
    const { sessionCode } = req.params;
    const { round_number, level_key } = req.body;

    // Get session_id from sessionCode
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", sessionCode)
      .single();

    if (sessionErr || !sessionRow) {
      return res.status(400).json({ error: "Session not found" });
    }

    const session_id = sessionRow.id;

    // UPSERT (replace if that round already exists)
    const { data, error } = await supabase
      .from("session_levels")
      .upsert(
        {
          session_id,
          round_number,
          level_key,
        },
        {
          onConflict: "session_id, round_number",
        }
      )
      .select();

    if (error) return res.status(400).json({ error });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server failure" });
  }
});

/* -------------------------
   FETCH LEVEL PLAN
-------------------------- */
router.get("/:sessionCode/levels", async (req, res) => {
  try {
    const { sessionCode } = req.params;

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", sessionCode)
      .single();

    if (sessionErr || !sessionRow) {
      return res.status(400).json({ error: "Session not found" });
    }

    const session_id = sessionRow.id;

    const { data, error } = await supabase
      .from("session_levels")
      .select("*")
      .eq("session_id", session_id)
      .order("round_number", { ascending: true });

    if (error) return res.status(400).json({ error });

    res.json({ levels: data });
  } catch (err) {
    res.status(500).json({ error: "Server failure" });
  }
});

export default router;
