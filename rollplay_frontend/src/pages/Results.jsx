import { useGame } from "../GameContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

function money(value) {
  return `${Number(value || 0).toFixed(2)} credits`;
}

function getModeLabel(mode) {
  if (mode === "items") return "Specific Items";
  if (mode === "pot") return "Total Pot";
  if (mode === "pseudo") return "Pseudo Tab";
  return "Unknown";
}

export default function Results() {
  const navigate = useNavigate();

  const {
    results,
    sessionItems,
    sessionPot,
    confirmedSplit,
    saveConfirmedSplit,
    clearConfirmedSplit,
    sessionCode,
    profile,
  } = useGame();

  const code = sessionCode || localStorage.getItem("session_code");

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [sessionData, setSessionData] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [localSplitMode, setLocalSplitMode] = useState("items");
  const [itemAssignments, setItemAssignments] = useState([]);
  const [manualTotals, setManualTotals] = useState([]);
  const [isConfirmed, setIsConfirmed] = useState(Boolean(confirmedSplit));

  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanError, setScanError] = useState("");

  const [saveError, setSaveError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 640;
  const isLaptop = screenWidth <= 1100;

  const activeMode = confirmedSplit?.mode || localSplitMode;
  const creditBalance = Number(profile?.credits || profile?.credit_balance || 0);

  const finalResults = useMemo(() => {
    if (
      Array.isArray(sessionData?.finalResults) &&
      sessionData.finalResults.length > 0
    ) {
      return sessionData.finalResults;
    }

    if (
      Array.isArray(sessionData?.session?.final_results) &&
      sessionData.session.final_results.length > 0
    ) {
      return sessionData.session.final_results;
    }

    return Array.isArray(results) ? results : [];
  }, [results, sessionData]);

  const winner = finalResults[0] || null;

  const totalFromDraftItems = useMemo(() => {
    return (sessionItems || []).reduce(
      (sum, item) => sum + Number(item.cost || 0),
      0
    );
  }, [sessionItems]);

  const itemsDraftOrLiveTotal = useMemo(() => {
    return itemAssignments.reduce(
      (sum, item) => sum + Number(item.cost || 0),
      0
    );
  }, [itemAssignments]);

  const effectiveSessionTotal =
    activeMode === "items"
      ? totalFromDraftItems || itemsDraftOrLiveTotal
      : Number(sessionPot || 0);

  const sessionPlayers = useMemo(() => {
    const backendPlayers = sessionData?.players || [];

    if (finalResults.length > 0) {
      return finalResults.map((p, index) => ({
        name: p.name || p.display_name || `Player ${index + 1}`,
        rank: p.rank || index + 1,
        score: p.score ?? p.points ?? null,
      }));
    }

    return backendPlayers.map((p, index) => ({
      name: p.name || p.display_name || `Player ${index + 1}`,
      rank: index + 1,
      score: p.score ?? p.points ?? null,
    }));
  }, [finalResults, sessionData]);

  const nonWinnerPlayers = useMemo(() => {
    if (sessionPlayers.length <= 1) return sessionPlayers;
    return sessionPlayers.slice(1);
  }, [sessionPlayers]);

  useEffect(() => {
    async function loadSession() {
      if (!code) {
        setLoadingSession(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`);
        const data = await res.json().catch(() => null);

        if (res.ok && data) {
          setSessionData(data);

          if (data?.session?.confirmed_split) {
            saveConfirmedSplit(data.session.confirmed_split);
            setIsConfirmed(true);
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      } finally {
        setLoadingSession(false);
      }
    }

    loadSession();
  }, [code, saveConfirmedSplit]);

  useEffect(() => {
    if (!code) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`);
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.session) return;

        setSessionData(data);

        if (data.session.confirmed_split) {
          saveConfirmedSplit(data.session.confirmed_split);
          setIsConfirmed(true);
        } else {
          setIsConfirmed(false);
        }
      } catch {
        // silent polling fail
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [code, saveConfirmedSplit]);

  useEffect(() => {
    if (confirmedSplit) {
      setIsConfirmed(true);

      if (confirmedSplit.mode) {
        setLocalSplitMode(confirmedSplit.mode);
      }

      if (confirmedSplit.mode === "items") {
        const confirmedItems = Array.isArray(confirmedSplit.itemAssignments)
          ? confirmedSplit.itemAssignments
          : [];
        setItemAssignments(confirmedItems);
        setManualTotals([]);
      } else if (confirmedSplit.mode === "pot") {
        const confirmedManual = Array.isArray(confirmedSplit.manualTotals)
          ? confirmedSplit.manualTotals
          : [];
        setManualTotals(confirmedManual);
        setItemAssignments([]);
      } else {
        setManualTotals([]);
      }

      return;
    }

    setIsConfirmed(false);
  }, [confirmedSplit]);

  useEffect(() => {
    if (confirmedSplit) return;

    if (activeMode === "items") {
      if (itemAssignments.length > 0) return;

      const seededItems = (sessionItems || []).map((item) => ({
        id: item.id || crypto.randomUUID(),
        name: item.name || "Item",
        cost: Number(item.cost || 0),
        assignedTo: [],
      }));

      setItemAssignments(seededItems);
    }
  }, [activeMode, sessionItems, itemAssignments.length, confirmedSplit]);

  useEffect(() => {
    if (confirmedSplit) return;

    if (activeMode === "pot") {
      setManualTotals((prev) => {
        if (prev.length === sessionPlayers.length && prev.length > 0) {
          return prev;
        }

        const nonWinnerCount = Math.max(sessionPlayers.length - 1, 0);
        const splitTotal = Number(sessionPot || 0);
        const loserShare =
          nonWinnerCount > 0 ? splitTotal / nonWinnerCount : 0;

        return sessionPlayers.map((player, index) => ({
          name: player.name,
          rank: player.rank,
          total: index === 0 ? 0 : Number(loserShare.toFixed(2)),
        }));
      });
    }
  }, [activeMode, sessionPlayers, sessionPot, confirmedSplit]);

  function toggleItem(itemId, playerName) {
    if (isConfirmed) return;

    setItemAssignments((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const alreadyAssigned = item.assignedTo.includes(playerName);

        return {
          ...item,
          assignedTo: alreadyAssigned
            ? item.assignedTo.filter((p) => p !== playerName)
            : [...item.assignedTo, playerName],
        };
      })
    );
  }

  function updateManual(playerName, value) {
    if (isConfirmed) return;

    setManualTotals((prev) =>
      prev.map((player) =>
        player.name === playerName
          ? { ...player, total: Number(value) || 0 }
          : player
      )
    );
  }

  function addManualItem() {
    if (isConfirmed) return;
    if (!newItemName.trim()) return;
    if (!newItemCost || Number(newItemCost) <= 0) return;

    const item = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      cost: Number(newItemCost),
      assignedTo: [],
    };

    setItemAssignments((prev) => [...prev, item]);
    setNewItemName("");
    setNewItemCost("");
  }

  function updateItemName(itemId, value) {
    if (isConfirmed) return;

    setItemAssignments((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, name: value } : item
      )
    );
  }

  function updateItemCost(itemId, value) {
    if (isConfirmed) return;

    setItemAssignments((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, cost: Number(value) || 0 } : item
      )
    );
  }

  function removeItem(itemId) {
    if (isConfirmed) return;
    setItemAssignments((prev) => prev.filter((item) => item.id !== itemId));
  }

  function clearAllAssignments() {
    if (isConfirmed) return;

    setItemAssignments((prev) =>
      prev.map((item) => ({
        ...item,
        assignedTo: [],
      }))
    );
  }

  function autoAssignUnassignedItems() {
    if (isConfirmed) return;
    if (!itemAssignments.length) return;

    const targets =
      nonWinnerPlayers.length > 0 ? nonWinnerPlayers : sessionPlayers;

    if (!targets.length) return;

    let cursor = 0;

    setItemAssignments((prev) =>
      prev.map((item) => {
        if (Array.isArray(item.assignedTo) && item.assignedTo.length > 0) {
          return item;
        }

        const assignedPlayer = targets[cursor % targets.length];
        cursor += 1;

        return {
          ...item,
          assignedTo: assignedPlayer ? [assignedPlayer.name] : [],
        };
      })
    );
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanLoading(true);
      setScanMessage("");
      setScanError("");

      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch(`${API_BASE}/scan-receipt`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to scan receipt");
      }

      const parsedItems = Array.isArray(data?.items) ? data.items : [];

      if (!parsedItems.length) {
        setScanMessage(data?.warning || "No receipt items detected.");
        return;
      }

      setItemAssignments((prev) => [
        ...prev,
        ...parsedItems.map((item) => ({
          id: item.id || crypto.randomUUID(),
          name: item.name || "Receipt item",
          cost: Number(item.cost || 0),
          assignedTo: [],
        })),
      ]);

      setScanMessage(
        `Added ${parsedItems.length} item${
          parsedItems.length === 1 ? "" : "s"
        } from receipt.`
      );
    } catch (err) {
      console.error(err);
      setScanError(err.message || "Receipt scan failed");
    } finally {
      setScanLoading(false);
      e.target.value = "";
    }
  }

  const finalAllocation = useMemo(() => {
    if (!sessionPlayers.length) return [];

    if (activeMode === "items") {
      return sessionPlayers.map((player) => {
        const ownedItems = itemAssignments
          .filter((item) => item.assignedTo.includes(player.name))
          .map((item) => {
            const shareCount = item.assignedTo.length || 1;
            const shareValue = Number(item.cost || 0) / shareCount;

            return {
              ...item,
              shareCount,
              shareValue,
              shared: shareCount > 1,
            };
          });

        return {
          name: player.name,
          rank: player.rank,
          items: ownedItems,
          total: ownedItems.reduce(
            (sum, item) => sum + Number(item.shareValue || 0),
            0
          ),
        };
      });
    }

    if (activeMode === "pot") {
      return manualTotals.map((player) => ({
        name: player.name,
        rank: player.rank,
        items: [],
        total: Number(player.total || 0),
      }));
    }

    return sessionPlayers.map((player) => ({
      name: player.name,
      rank: player.rank,
      items: [],
      total: 0,
    }));
  }, [activeMode, itemAssignments, manualTotals, sessionPlayers]);

  const finalTotal = useMemo(() => {
    return finalAllocation.reduce(
      (sum, player) => sum + Number(player.total || 0),
      0
    );
  }, [finalAllocation]);

  const unassignedItems = useMemo(() => {
    if (activeMode !== "items") return [];

    return itemAssignments.filter(
      (item) => !Array.isArray(item.assignedTo) || item.assignedTo.length === 0
    );
  }, [activeMode, itemAssignments]);

  const allItemsAssigned = useMemo(() => {
    if (activeMode !== "items") return true;
    return unassignedItems.length === 0;
  }, [activeMode, unassignedItems]);

  const totalsMatch = useMemo(() => {
    if (activeMode === "pseudo") return true;

    return (
      Math.abs(Number(finalTotal || 0) - Number(effectiveSessionTotal || 0)) <
      0.01
    );
  }, [activeMode, finalTotal, effectiveSessionTotal]);

  const playerOwes = useMemo(() => {
    if (!profile) return 0;

    const names = [
      profile.displayName,
      profile.display_name,
      profile.email,
    ].filter(Boolean);

    const matched = finalAllocation.find((player) =>
      names.some((name) => String(name) === String(player.name))
    );

    return Number(matched?.total || 0);
  }, [finalAllocation, profile]);

  const canAffordOwnShare = creditBalance >= playerOwes;

  async function handleConfirm() {
    setSaveError("");

    if (activeMode === "items" && !allItemsAssigned) {
      setSaveError("Every item must be assigned before confirming.");
      return;
    }

    if (!totalsMatch) {
      setSaveError("Final total must match the session total before confirming.");
      return;
    }

    const confirmedAt = new Date().toISOString();
    const receiptId = `RP-${Date.now()}`;

    const basePayload = {
      receiptId,
      mode: activeMode,
      modeLabel: getModeLabel(activeMode),
      paymentRequired: activeMode !== "pseudo",
      currency: "credits",
      winnerName: winner?.name || null,
      rankings: sessionPlayers,
      sessionCode: code || null,
      sessionTotal: effectiveSessionTotal,
      finalAllocation,
      finalTotal,
      itemAssignments,
      manualTotals,
      confirmedAt,
    };

    const qrPayload = {
      type: "rollpay_final_split_receipt",
      receiptId,
      sessionCode: code || null,
      mode: activeMode,
      modeLabel: getModeLabel(activeMode),
      winnerName: winner?.name || null,
      rankings: sessionPlayers,
      finalTotal,
      finalAllocation,
      confirmedAt,
    };

    let payload = {
      ...basePayload,
      qrPayload,
      qrDataUrl: null,
      receiptEmailStatus: "pending",
      splitEmailStatus: "pending",
    };

    try {
      setSaveLoading(true);

      if (code) {
        const saveRes = await fetch(`${API_BASE}/sessions/${code}/confirmed-split`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmedSplit: payload,
          }),
        });

        const saveData = await saveRes.json().catch(() => null);

        if (!saveRes.ok) {
          throw new Error(saveData?.error || "Failed to save confirmed split");
        }

        const emailRes = await fetch(
          `${API_BASE}/sessions/${code}/send-final-receipt`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              confirmedSplit: payload,
            }),
          }
        );

        const emailData = await emailRes.json().catch(() => null);

        if (!emailRes.ok) {
          throw new Error(emailData?.error || "Failed to send receipt email");
        }

        payload = {
          ...payload,
          qrDataUrl: emailData?.qrDataUrl || null,
          receiptEmailStatus: "sent",
          splitEmailStatus: "sent",
          emailSentCount: emailData?.sentCount || 0,
        };

        await fetch(`${API_BASE}/sessions/${code}/confirmed-split`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmedSplit: payload,
          }),
        });
      }

      saveConfirmedSplit(payload);
      setIsConfirmed(true);
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Failed to confirm split");
    } finally {
      setSaveLoading(false);
    }
  }

  async function unlock() {
    try {
      setSaveError("");
      setSaveLoading(true);

      if (code) {
        const res = await fetch(`${API_BASE}/sessions/${code}/confirmed-split`, {
          method: "DELETE",
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to unlock split");
        }
      }

      clearConfirmedSplit();
      setIsConfirmed(false);
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Failed to unlock split");
    } finally {
      setSaveLoading(false);
    }
  }

  const hostName =
    profile?.displayName ||
    profile?.display_name ||
    profile?.email ||
    "Host";

  return (
    <div style={page}>
      <div style={heroGlowOne} />
      <div style={heroGlowTwo} />

      <section
        style={{
          ...heroSection,
          padding: isPhone ? "28px 14px 40px" : "42px 20px 52px",
        }}
      >
        <div
          style={{
            ...resultsLayout,
            gridTemplateColumns:
              isPhone || isLaptop
                ? "1fr"
                : "minmax(320px, 0.84fr) minmax(0, 1.16fr)",
            gap: isPhone ? 18 : 24,
          }}
        >
          <div style={sideCard}>
            <p style={sectionEyebrow}>Session results</p>
            <h1
              style={{
                ...pageTitle,
                fontSize: isPhone ? 40 : isLaptop ? 52 : 64,
              }}
            >
              Final split
            </h1>

            <p style={introText}>
              Review the game ranking, build the receipt, assign what everyone
              owes, and lock the final credit split for the session.
            </p>

            <div style={profileCard}>
              <div style={avatarCircle}>
                {String(hostName).slice(0, 2).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={profileLabel}>Session viewer</div>
                <div style={profileName}>{hostName}</div>
                <div style={profileSubtext}>
                  Session code: {code || "Not available"}
                </div>
              </div>
            </div>

            <div style={summaryPanel}>
              <div style={summaryRow}>
                <span style={summaryLabel}>Your credits</span>
                <strong style={summaryValue}>{money(creditBalance)}</strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Your share</span>
                <strong
                  style={{
                    ...summaryValue,
                    color: playerOwes > 0 && !canAffordOwnShare ? "#FF9A9A" : "#fff",
                  }}
                >
                  {money(playerOwes)}
                </strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Split mode</span>
                <strong style={summaryValue}>{getModeLabel(activeMode)}</strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Session total</span>
                <strong style={summaryValue}>
                  {money(effectiveSessionTotal)}
                </strong>
              </div>

              <div style={summaryRow}>
                <span style={summaryLabel}>Current final total</span>
                <strong style={summaryValue}>{money(finalTotal)}</strong>
              </div>

              {activeMode === "items" && (
                <div style={summaryRow}>
                  <span style={summaryLabel}>Unassigned items</span>
                  <strong
                    style={{
                      ...summaryValue,
                      color: unassignedItems.length ? "#FF9A9A" : "#9BE39B",
                    }}
                  >
                    {unassignedItems.length}
                  </strong>
                </div>
              )}
            </div>

            {playerOwes > 0 && !canAffordOwnShare && (
              <div style={warningBanner}>
                You do not currently have enough credits for your share. Buy
                more credits from your profile before real payment simulation is
                enabled.
              </div>
            )}

            {winner && (
              <div style={winnerCard}>
                <div style={winnerEyebrow}>Winner</div>
                <div style={winnerName}>🏆 {winner.name}</div>
                <div style={winnerSubtext}>Top player this session</div>
              </div>
            )}
          </div>

          <div style={mainColumn}>
            {loadingSession ? (
              <div style={contentCard}>
                <p style={sectionEyebrow}>Loading</p>
                <h2 style={cardHeading}>Loading session results...</h2>
              </div>
            ) : (
              <>
                <div style={contentCard}>
                  <p style={sectionEyebrow}>Rankings</p>
                  <h2 style={cardHeading}>Game ranking</h2>

                  {!sessionPlayers.length ? (
                    <p style={helperIntro}>No rankings available yet.</p>
                  ) : (
                    <div style={leaderboardList}>
                      {sessionPlayers.map((player, index) => (
                        <div
                          key={`${player.name}-${index}`}
                          style={{
                            ...leaderboardRow,
                            ...(index === 0 ? leaderboardRowWinner : null),
                          }}
                        >
                          <div style={leaderboardLeft}>
                            <div style={leaderboardRank}>#{player.rank}</div>
                            <div>
                              <div style={leaderboardName}>{player.name}</div>
                              <div style={leaderboardMeta}>
                                {index === 0
                                  ? "Session winner"
                                  : player.score !== null
                                  ? `Score: ${player.score}`
                                  : "Participant"}
                              </div>
                            </div>
                          </div>

                          <div style={leaderboardRight}>
                            {index === 0 ? "🏆" : "•"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={contentCard}>
                  <p style={sectionEyebrow}>Split method</p>
                  <h2 style={cardHeading}>Choose how to split</h2>
                  <p style={helperIntro}>
                    Everything is counted in RollPay credits. Once confirmed,
                    the payment summary will hold the receipt skeleton, ranking,
                    QR payload, and final split.
                  </p>

                  <div style={modeGrid}>
                    {["items", "pot", "pseudo"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={isConfirmed}
                        onClick={() => setLocalSplitMode(mode)}
                        style={{
                          ...modeCard,
                          ...(activeMode === mode ? modeCardActive : null),
                          ...(isConfirmed ? disabledCard : null),
                        }}
                      >
                        <h3 style={modeTitle}>{getModeLabel(mode)}</h3>
                        <p style={modeText}>
                          {mode === "items"
                            ? "Assign receipt items directly to players."
                            : mode === "pot"
                            ? "Manually choose how many credits each player owes."
                            : "No payment required, just keep the results."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {activeMode === "items" && (
                  <>
                    <div style={contentCard}>
                      <p style={sectionEyebrow}>Receipt builder</p>
                      <h2 style={cardHeading}>Add or scan items</h2>
                      <p style={helperIntro}>
                        Build the receipt manually or upload a photo to scan it.
                        Values entered here are treated as credits.
                      </p>

                      {!isConfirmed && (
                        <>
                          <div
                            style={{
                              ...builderRow,
                              flexDirection: isPhone ? "column" : "row",
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Item name"
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              style={builderInput}
                            />

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Credits"
                              value={newItemCost}
                              onChange={(e) => setNewItemCost(e.target.value)}
                              style={{
                                ...builderInput,
                                width: isPhone ? "100%" : 160,
                              }}
                            />

                            <button
                              type="button"
                              onClick={addManualItem}
                              style={{
                                ...primaryButton,
                                minWidth: isPhone ? "100%" : 160,
                              }}
                            >
                              Add Item
                            </button>
                          </div>

                          <div style={receiptToolRow}>
                            <button
                              type="button"
                              onClick={autoAssignUnassignedItems}
                              style={secondaryButton}
                            >
                              Auto-Assign Unassigned
                            </button>

                            <button
                              type="button"
                              onClick={clearAllAssignments}
                              style={ghostButton}
                            >
                              Clear Assignments
                            </button>
                          </div>

                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptUpload}
                            style={fileInputStyle}
                          />
                        </>
                      )}

                      {scanLoading ? (
                        <p style={mutedText}>Scanning receipt...</p>
                      ) : null}

                      {scanMessage ? (
                        <p style={successText}>{scanMessage}</p>
                      ) : null}

                      {scanError ? <p style={errorText}>{scanError}</p> : null}

                      {unassignedItems.length > 0 && (
                        <div style={warningBanner}>
                          {unassignedItems.length} item
                          {unassignedItems.length === 1 ? "" : "s"} still need
                          assigning.
                        </div>
                      )}
                    </div>

                    <div style={contentCard}>
                      <p style={sectionEyebrow}>Item assignment</p>
                      <h2 style={cardHeading}>Assign items to players</h2>
                      <p style={helperIntro}>
                        Tap player chips to assign each item. Shared items split
                        evenly across everyone selected.
                      </p>

                      {!itemAssignments.length ? (
                        <p style={mutedText}>
                          No items yet. Add items manually or upload a receipt.
                        </p>
                      ) : (
                        <div style={assignmentList}>
                          {itemAssignments.map((item) => {
                            const isUnassigned =
                              !Array.isArray(item.assignedTo) ||
                              item.assignedTo.length === 0;

                            return (
                              <div
                                key={item.id}
                                style={{
                                  ...assignmentCard,
                                  ...(isUnassigned
                                    ? assignmentCardWarning
                                    : null),
                                }}
                              >
                                {!isConfirmed ? (
                                  <div
                                    style={{
                                      ...editableItemRow,
                                      flexDirection: isPhone ? "column" : "row",
                                    }}
                                  >
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) =>
                                        updateItemName(item.id, e.target.value)
                                      }
                                      style={editableInput}
                                    />

                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.cost}
                                      onChange={(e) =>
                                        updateItemCost(item.id, e.target.value)
                                      }
                                      style={{
                                        ...editableInput,
                                        width: isPhone ? "100%" : 140,
                                      }}
                                    />

                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.id)}
                                      style={deleteButton}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <div style={assignmentHeader}>
                                    <div>
                                      <div style={assignmentItemName}>
                                        {item.name}
                                      </div>
                                      <div style={assignmentItemCost}>
                                        {money(item.cost)}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {isUnassigned && (
                                  <div style={inlineWarningText}>
                                    Unassigned item
                                  </div>
                                )}

                                <div style={chipWrap}>
                                  {sessionPlayers.map((player) => {
                                    const active = item.assignedTo.includes(
                                      player.name
                                    );

                                    return (
                                      <button
                                        key={`${item.id}-${player.name}`}
                                        type="button"
                                        disabled={isConfirmed}
                                        onClick={() =>
                                          toggleItem(item.id, player.name)
                                        }
                                        style={{
                                          ...playerChip,
                                          ...(active ? playerChipActive : null),
                                          ...(isConfirmed
                                            ? playerChipDisabled
                                            : null),
                                        }}
                                      >
                                        {player.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeMode === "pot" && (
                  <div style={contentCard}>
                    <p style={sectionEyebrow}>Manual totals</p>
                    <h2 style={cardHeading}>Set credit contributions</h2>
                    <p style={helperIntro}>
                      Adjust how many credits each player should contribute
                      toward the total.
                    </p>

                    <div style={manualTotalsList}>
                      {manualTotals.map((player) => (
                        <div key={player.name} style={manualRow}>
                          <div>
                            <div style={manualName}>{player.name}</div>
                            <div style={manualMeta}>Rank {player.rank}</div>
                          </div>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={player.total}
                            disabled={isConfirmed}
                            onChange={(e) =>
                              updateManual(player.name, e.target.value)
                            }
                            style={manualInput}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeMode === "pseudo" && (
                  <div style={contentCard}>
                    <p style={sectionEyebrow}>Pseudo tab</p>
                    <h2 style={cardHeading}>No payment required</h2>
                    <p style={helperIntro}>
                      This session is being treated as a non-payment result.
                      Rankings are saved, but contributions stay at zero.
                    </p>
                  </div>
                )}

                <div style={contentCard}>
                  <p style={sectionEyebrow}>Final allocation</p>
                  <h2 style={cardHeading}>Preview the split</h2>
                  <p style={helperIntro}>
                    This is the current final breakdown. The confirmed summary
                    will include ranking, receipt, credits owed, and QR payload.
                  </p>

                  <div style={allocationList}>
                    {finalAllocation.map((player) => (
                      <div key={player.name} style={allocationCard}>
                        <div style={allocationHeader}>
                          <div>
                            <div style={allocationName}>{player.name}</div>
                            <div style={allocationMeta}>Rank {player.rank}</div>
                          </div>
                          <div style={allocationTotal}>
                            {money(player.total)}
                          </div>
                        </div>

                        {player.items?.length > 0 && (
                          <div style={allocationItems}>
                            {player.items.map((item) => (
                              <div
                                key={`${player.name}-${item.id}`}
                                style={allocationItemRow}
                              >
                                <span>
                                  {item.name}
                                  {item.shared
                                    ? ` (${item.shareCount} way split)`
                                    : ""}
                                </span>
                                <strong>{money(item.shareValue)}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={finalCheckBox}>
                    <div
                      style={{
                        ...finalCheckLine,
                        color: totalsMatch ? "#9BE39B" : "#FF9A9A",
                      }}
                    >
                      {totalsMatch
                        ? "Final total matches session total."
                        : "Final total does not match session total."}
                    </div>

                    {activeMode === "items" && !allItemsAssigned && (
                      <div style={{ ...finalCheckLine, color: "#FF9A9A" }}>
                        Every item must be assigned before confirmation.
                      </div>
                    )}
                  </div>
                </div>

                <div style={contentCard}>
                  <p style={sectionEyebrow}>Confirm</p>
                  <h2 style={cardHeading}>Lock the final split</h2>
                  <p style={helperIntro}>
                    Once confirmed, everyone will see the same saved split. The
                    payment summary page will show the skeleton receipt, QR
                    payload, and email-ready data.
                  </p>

                  {saveError ? <p style={errorText}>{saveError}</p> : null}

                  {!isConfirmed ? (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={saveLoading}
                      style={{
                        ...primaryButton,
                        ...(saveLoading ? disabledButton : null),
                      }}
                    >
                      {saveLoading ? "Saving..." : "Confirm Final Split"}
                    </button>
                  ) : (
                    <div style={confirmedBox}>
                      <div style={confirmedText}>Final split confirmed.</div>

                      <div style={receiptToolRow}>
                        <button
                          type="button"
                          onClick={() => navigate("/payment-summary")}
                          style={primaryButton}
                        >
                          View Payment Summary
                        </button>

                        <button
                          type="button"
                          onClick={unlock}
                          disabled={saveLoading}
                          style={{
                            ...secondaryButton,
                            ...(saveLoading ? disabledButton : null),
                          }}
                        >
                          {saveLoading ? "Unlocking..." : "Unlock"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={footerRow}>
                  <button
                    type="button"
                    onClick={() => navigate("/lobby")}
                    style={ghostButton}
                  >
                    Back to Lobby
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
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

const heroSection = {
  position: "relative",
  display: "flex",
  justifyContent: "center",
};

const resultsLayout = {
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

const helperIntro = {
  margin: "0 0 18px",
  fontSize: 15,
  lineHeight: 1.7,
  opacity: 0.86,
};

const mutedText = {
  opacity: 0.78,
  lineHeight: 1.6,
};

const profileCard = {
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
  width: 64,
  height: 64,
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

const summaryPanel = {
  marginTop: 18,
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

const winnerCard = {
  marginTop: 20,
  padding: 22,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.16), rgba(255,255,255,0.04))",
  border: "1px solid rgba(244,196,49,0.26)",
};

const winnerEyebrow = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#f6cf64",
  fontWeight: 800,
  marginBottom: 8,
};

const winnerName = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.1,
};

const winnerSubtext = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.82,
};

const leaderboardList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const leaderboardRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const leaderboardRowWinner = {
  background: "rgba(244,196,49,0.12)",
  border: "1px solid rgba(244,196,49,0.24)",
};

const leaderboardLeft = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const leaderboardRank = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
  fontWeight: 900,
  flexShrink: 0,
};

const leaderboardName = {
  fontSize: 18,
  fontWeight: 800,
};

const leaderboardMeta = {
  fontSize: 13,
  opacity: 0.76,
  marginTop: 4,
};

const leaderboardRight = {
  fontSize: 24,
  fontWeight: 900,
};

const modeGrid = {
  display: "grid",
  gap: 14,
};

const modeCard = {
  textAlign: "left",
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
};

const modeCardActive = {
  background: "rgba(244,196,49,0.12)",
  border: "1px solid rgba(244,196,49,0.28)",
};

const disabledCard = {
  opacity: 0.72,
  cursor: "default",
};

const modeTitle = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 20,
};

const modeText = {
  margin: 0,
  opacity: 0.82,
  lineHeight: 1.55,
  fontSize: 15,
};

const builderRow = {
  display: "flex",
  gap: 12,
  marginBottom: 14,
};

const builderInput = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  boxSizing: "border-box",
};

const receiptToolRow = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const fileInputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const successText = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 14,
  color: "#9BE39B",
  fontWeight: 700,
};

const errorText = {
  marginTop: 12,
  marginBottom: 0,
  fontSize: 14,
  color: "#FF9A9A",
  fontWeight: 700,
};

const warningBanner = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,120,120,0.10)",
  border: "1px solid rgba(255,120,120,0.22)",
  color: "#FFB3B3",
  fontWeight: 700,
  fontSize: 14,
};

const assignmentList = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const assignmentCard = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const assignmentCardWarning = {
  border: "1px solid rgba(255,120,120,0.26)",
  background: "rgba(255,120,120,0.06)",
};

const assignmentHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 12,
};

const editableItemRow = {
  display: "flex",
  gap: 12,
  marginBottom: 12,
};

const editableInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const deleteButton = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,120,120,0.24)",
  background: "rgba(255,120,120,0.10)",
  color: "#FFB3B3",
  cursor: "pointer",
  fontWeight: 700,
};

const assignmentItemName = {
  fontSize: 17,
  fontWeight: 800,
};

const assignmentItemCost = {
  fontSize: 14,
  opacity: 0.8,
  marginTop: 4,
};

const inlineWarningText = {
  marginBottom: 12,
  color: "#FFB3B3",
  fontSize: 13,
  fontWeight: 700,
};

const chipWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const playerChip = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const playerChipActive = {
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.32)",
  color: "#f6cf64",
};

const playerChipDisabled = {
  cursor: "default",
};

const manualTotalsList = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const manualRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const manualName = {
  fontSize: 17,
  fontWeight: 800,
};

const manualMeta = {
  fontSize: 13,
  opacity: 0.76,
  marginTop: 4,
};

const manualInput = {
  width: 140,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 16,
  boxSizing: "border-box",
};

const allocationList = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const allocationCard = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const allocationHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const allocationName = {
  fontSize: 17,
  fontWeight: 800,
};

const allocationMeta = {
  fontSize: 13,
  opacity: 0.76,
  marginTop: 4,
};

const allocationTotal = {
  fontSize: 22,
  fontWeight: 900,
  color: "#f6cf64",
};

const allocationItems = {
  marginTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const allocationItemRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 14,
  opacity: 0.9,
};

const finalCheckBox = {
  marginTop: 18,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const finalCheckLine = {
  fontSize: 14,
  fontWeight: 700,
};

const confirmedBox = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  alignItems: "flex-start",
};

const confirmedText = {
  color: "#9BE39B",
  fontWeight: 800,
  fontSize: 16,
};

const footerRow = {
  display: "flex",
  justifyContent: "flex-start",
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
  minWidth: 220,
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
  minWidth: 170,
};

const disabledButton = {
  opacity: 0.65,
  cursor: "not-allowed",
};