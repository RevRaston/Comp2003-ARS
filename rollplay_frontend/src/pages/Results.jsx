// src/pages/Results.jsx
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

export default function Results() {
  const navigate = useNavigate();

  const {
    results,
    splitMode,
    sessionPot,
    sessionItems,
    paymentRequired,
    confirmedSplit,
    saveConfirmedSplit,
    clearConfirmedSplit,
    sessionCode,
    rule,
  } = useGame();

  const code = sessionCode || localStorage.getItem("session_code");

  const [sessionData, setSessionData] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [itemAssignments, setItemAssignments] = useState([]);
  const [manualTotals, setManualTotals] = useState([]);
  const [isConfirmed, setIsConfirmed] = useState(Boolean(confirmedSplit));
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    async function loadSession() {
      if (!code) {
        setLoadingSession(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/sessions/${code}`, { headers });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.session) {
          setSessionData(data);
        }
      } catch (err) {
        console.error("Failed to load session for results:", err);
      } finally {
        setLoadingSession(false);
      }
    }

    loadSession();
  }, [code]);

  const backendSession = sessionData?.session || null;
  const backendPlayers = sessionData?.players || [];

  const hasRealResults = Array.isArray(results) && results.length > 0;

  const itemsTotal = useMemo(() => {
    return (sessionItems || []).reduce(
      (sum, item) => sum + Number(item.cost || 0),
      0
    );
  }, [sessionItems]);

  const backendTotal = Number(backendSession?.total_cost || 0);

  const effectiveTotal =
    splitMode === "items"
      ? itemsTotal
      : Number(sessionPot || backendTotal || 0);

  const effectiveRule = backendSession?.rule || rule || "winner_free";

  const fallbackResults = useMemo(() => {
    if (!backendPlayers.length) return [];

    const total = Number(backendSession?.total_cost || sessionPot || 0);
    const playerCount = backendPlayers.length;

    const safePlayers = backendPlayers.map((p, index) => ({
      name: p.name || p.display_name || `Player ${index + 1}`,
      rank: index + 1,
    }));

    if (effectiveRule === "even_split") {
      const share = playerCount > 0 ? total / playerCount : 0;
      return safePlayers.map((p) => ({
        ...p,
        recommended: Number(share.toFixed(2)),
      }));
    }

    const loserCount = Math.max(playerCount - 1, 0);
    const loserShare = loserCount > 0 ? total / loserCount : 0;

    return safePlayers.map((p, index) => ({
      ...p,
      recommended: Number((index === 0 ? 0 : loserShare).toFixed(2)),
    }));
  }, [backendPlayers, backendSession, sessionPot, effectiveRule]);

  const finalResults = hasRealResults ? results : fallbackResults;
  const hasAnyResults = Array.isArray(finalResults) && finalResults.length > 0;
  const winner = hasAnyResults ? finalResults[0] : null;

  const modeLabel =
    splitMode === "items"
      ? "Specific Items / Receipt"
      : splitMode === "pot"
      ? "Total Pot"
      : splitMode === "pseudo"
      ? "Pseudo Tab / No Payment"
      : "Session Summary";

  const recommendedAllocation = useMemo(() => {
    if (!hasAnyResults) return [];

    const base = finalResults.map((p) => ({
      name: p.name,
      rank: p.rank,
      items: [],
      total: 0,
    }));

    if (splitMode === "items") {
      const items = [...(sessionItems || [])];
      if (base.length <= 1) return base;

      let playerIndex = 1;

      for (const item of items) {
        if (!base[playerIndex]) break;

        base[playerIndex].items.push(item);
        base[playerIndex].total += Number(item.cost || 0);

        playerIndex += 1;
        if (playerIndex >= base.length) playerIndex = 1;
      }

      return base;
    }

    if (splitMode === "pot") {
      const loserCount = Math.max(base.length - 1, 0);
      if (loserCount === 0) return base;

      const share = Number(sessionPot || backendTotal || 0) / loserCount;

      return base.map((p, index) => ({
        ...p,
        total: index === 0 ? 0 : share,
      }));
    }

    if (splitMode === "pseudo") {
      return base.map((p) => ({
        ...p,
        total: 0,
      }));
    }

    const loserCount = Math.max(base.length - 1, 0);
    if (loserCount === 0) return base;

    const share = Number(backendTotal || 0) / loserCount;

    return base.map((p, index) => ({
      ...p,
      total: index === 0 ? 0 : share,
    }));
  }, [
    hasAnyResults,
    finalResults,
    splitMode,
    sessionItems,
    sessionPot,
    backendTotal,
  ]);

  useEffect(() => {
    if (!hasAnyResults && !confirmedSplit) return;

    if (confirmedSplit) {
      setIsConfirmed(true);

      if (confirmedSplit.mode === "items") {
        setItemAssignments(confirmedSplit.itemAssignments || []);
        setManualTotals([]);
      } else {
        setManualTotals(confirmedSplit.manualTotals || []);
        setItemAssignments([]);
      }
      return;
    }

    if (splitMode === "items") {
      const assignments = (sessionItems || []).map((item) => {
        const recommendedOwner =
          recommendedAllocation.find((player) =>
            player.items.some((i) => i.id === item.id)
          )?.name || finalResults[0]?.name || "";

        return {
          ...item,
          assignedTo: recommendedOwner ? [recommendedOwner] : [],
        };
      });

      setItemAssignments(assignments);
      setManualTotals([]);
      setIsConfirmed(false);
      setConfirmError("");
      return;
    }

    if (splitMode === "pot" || splitMode === "pseudo") {
      setManualTotals(
        recommendedAllocation.map((player) => ({
          name: player.name,
          rank: player.rank,
          total: Number(player.total || 0),
        }))
      );
      setItemAssignments([]);
      setIsConfirmed(false);
      setConfirmError("");
    }
  }, [
    hasAnyResults,
    splitMode,
    sessionItems,
    recommendedAllocation,
    finalResults,
    confirmedSplit,
  ]);

  const finalAllocation = useMemo(() => {
    if (!hasAnyResults) return [];

    if (splitMode === "items") {
      return finalResults.map((player) => {
        const ownedItems = itemAssignments
          .filter((item) => item.assignedTo.includes(player.name))
          .map((item) => {
            const shareCount = item.assignedTo.length || 1;
            const shareValue = Number(item.cost || 0) / shareCount;

            return {
              ...item,
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

    if (splitMode === "pot" || splitMode === "pseudo") {
      return manualTotals.map((player) => ({
        name: player.name,
        rank: player.rank,
        items: [],
        total: Number(player.total || 0),
      }));
    }

    return recommendedAllocation;
  }, [
    hasAnyResults,
    splitMode,
    finalResults,
    itemAssignments,
    manualTotals,
    recommendedAllocation,
  ]);

  const finalTotal = useMemo(() => {
    return finalAllocation.reduce(
      (sum, player) => sum + Number(player.total || 0),
      0
    );
  }, [finalAllocation]);

  const totalsMatch = useMemo(() => {
    return Math.abs(finalTotal - effectiveTotal) < 0.01;
  }, [finalTotal, effectiveTotal]);

  const allItemsAssigned = useMemo(() => {
    if (splitMode !== "items") return true;
    return itemAssignments.every(
      (item) => Array.isArray(item.assignedTo) && item.assignedTo.length > 0
    );
  }, [splitMode, itemAssignments]);

  function toggleItemAssignment(itemId, playerName) {
    if (isConfirmed) return;

    setItemAssignments((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const alreadyAssigned = item.assignedTo.includes(playerName);

        return {
          ...item,
          assignedTo: alreadyAssigned
            ? item.assignedTo.filter((name) => name !== playerName)
            : [...item.assignedTo, playerName],
        };
      })
    );
  }

  function updateManualTotal(playerName, value) {
    if (isConfirmed) return;

    setManualTotals((prev) =>
      prev.map((player) =>
        player.name === playerName
          ? { ...player, total: Number(value) || 0 }
          : player
      )
    );
  }

  async function handleConfirmSplit() {
    setConfirmError("");

    if (splitMode === "items" && !allItemsAssigned) {
      setConfirmError(
        "Every item must be assigned to at least one player before confirmation."
      );
      return;
    }

    if (!totalsMatch && splitMode !== "pseudo") {
      setConfirmError(
        "Final split total must match the session total before confirmation."
      );
      return;
    }

    const payload = {
      mode: splitMode,
      modeLabel,
      paymentRequired,
      sessionTotal: effectiveTotal,
      finalTotal,
      winnerName: winner?.name || null,
      finalAllocation,
      itemAssignments,
      manualTotals,
      confirmedAt: new Date().toISOString(),
    };

    try {
      saveConfirmedSplit(payload);

      if (code) {
        const res = await fetch(`${API_BASE}/sessions/${code}/confirmed-split`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmedSplit: payload,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.error || `Failed to save confirmed split (HTTP ${res.status})`
          );
        }
      }

      setIsConfirmed(true);
    } catch (err) {
      console.error(err);
      setConfirmError(err?.message || "Failed to save confirmed split");
    }
  }

  function handleUnlockSplit() {
    setIsConfirmed(false);
    setConfirmError("");
    clearConfirmedSplit();
  }

  const showEmptyState =
    !loadingSession && !hasAnyResults && !confirmedSplit && !backendSession;

  return (
    <div style={page}>
      <div style={container}>
        <h1 style={title}>Game Results & Split Summary</h1>

        {loadingSession ? (
          <div style={emptyBox}>
            <h2 style={{ marginTop: 0 }}>Loading session results...</h2>
          </div>
        ) : showEmptyState ? (
          <div style={emptyBox}>
            <h2 style={{ marginTop: 0 }}>No results to show yet.</h2>
            <button onClick={() => navigate("/lobby")} style={primaryBtn}>
              Back to Lobby
            </button>
          </div>
        ) : (
          <>
            {!hasRealResults && hasAnyResults && (
              <div style={sectionBox}>
                <p style={mutedText}>
                  Live multiplayer rankings were not persisted for this session,
                  so this page is showing a fallback session summary using the
                  shared session player order and bill rule.
                </p>
              </div>
            )}

            {winner && (
              <div style={winnerCard}>
                <h2 style={{ margin: 0 }}>🏆 Winner</h2>
                <h1 style={{ margin: "10px 0", fontSize: 40 }}>{winner.name}</h1>
                <p style={{ margin: 0, fontSize: 20 }}>
                  Recommended: £{Number(winner.recommended || 0).toFixed(2)}
                </p>
              </div>
            )}

            {hasAnyResults && (
              <div style={sectionBox}>
                <h2 style={sectionTitle}>Rankings</h2>

                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Rank</th>
                      <th style={th}>Name</th>
                      <th style={th}>Recommended Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalResults.map((p) => (
                      <tr key={p.name}>
                        <td style={td}>{p.rank}</td>
                        <td style={td}>{p.name}</td>
                        <td style={td}>
                          £{Number(p.recommended || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={sectionBox}>
              <h2 style={sectionTitle}>Split Setup Summary</h2>

              <div style={summaryGrid}>
                <div style={summaryCard}>
                  <div style={summaryLabel}>Mode</div>
                  <div style={summaryValue}>{modeLabel}</div>
                </div>

                <div style={summaryCard}>
                  <div style={summaryLabel}>Payment Required</div>
                  <div style={summaryValue}>
                    {paymentRequired ? "Yes" : "No"}
                  </div>
                </div>

                <div style={summaryCard}>
                  <div style={summaryLabel}>Session Total</div>
                  <div style={summaryValue}>
                    £{Number(effectiveTotal || backendTotal || 0).toFixed(2)}
                  </div>
                </div>

                <div style={summaryCard}>
                  <div style={summaryLabel}>Current Final Total</div>
                  <div style={summaryValue}>
                    £{Number(finalTotal || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {splitMode === "items" && (
              <div style={sectionBox}>
                <h2 style={sectionTitle}>Bill Items</h2>

                {!sessionItems || sessionItems.length === 0 ? (
                  <p style={mutedText}>No items were added for this session.</p>
                ) : (
                  <>
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={th}>Item</th>
                          <th style={th}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionItems.map((item) => (
                          <tr key={item.id}>
                            <td style={td}>{item.name}</td>
                            <td style={td}>
                              £{Number(item.cost || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <h3 style={{ marginTop: 18 }}>
                      Items Total: £{Number(itemsTotal || 0).toFixed(2)}
                    </h3>
                  </>
                )}
              </div>
            )}

            {splitMode === "pot" && (
              <div style={sectionBox}>
                <h2 style={sectionTitle}>Total Pot</h2>
                <p style={mutedText}>
                  This session uses a single overall cost instead of individual
                  items.
                </p>
                <h3>Pot Total: £{Number(sessionPot || backendTotal || 0).toFixed(2)}</h3>
              </div>
            )}

            {splitMode === "pseudo" && (
              <div style={sectionBox}>
                <h2 style={sectionTitle}>Pseudo Tab</h2>
                <p style={mutedText}>
                  This session does not require real payment processing.
                </p>

                {Number(sessionPot || backendTotal || 0) > 0 && (
                  <h3>
                    Notional Total: £
                    {Number(sessionPot || backendTotal || 0).toFixed(2)}
                  </h3>
                )}
              </div>
            )}

            {hasAnyResults && (
              <div style={sectionBox}>
                <h2 style={sectionTitle}>Recommended Allocation</h2>
                <p style={mutedText}>
                  This is the system’s suggested split based on the available
                  session result data and the chosen session mode.
                </p>

                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Player</th>
                      <th style={th}>Rank</th>
                      <th style={th}>Assigned Items</th>
                      <th style={th}>Suggested Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendedAllocation.map((player) => (
                      <tr key={player.name}>
                        <td style={td}>{player.name}</td>
                        <td style={td}>{player.rank}</td>
                        <td style={td}>
                          {player.items.length === 0
                            ? "-"
                            : player.items.map((item) => item.name).join(", ")}
                        </td>
                        <td style={td}>
                          £{Number(player.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hasAnyResults && (
              <>
                <div style={sectionBox}>
                  <h2 style={sectionTitle}>Editable Final Split</h2>
                  <p style={mutedText}>
                    Adjust the suggested split before final confirmation.
                  </p>

                  {splitMode === "items" && (
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={th}>Item</th>
                          <th style={th}>Cost</th>
                          <th style={th}>Split Across</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemAssignments.map((item) => (
                          <tr key={item.id}>
                            <td style={td}>{item.name}</td>
                            <td style={td}>
                              £{Number(item.cost || 0).toFixed(2)}
                            </td>
                            <td style={td}>
                              <div style={checkboxWrap}>
                                {finalResults.map((player) => {
                                  const checked = item.assignedTo.includes(
                                    player.name
                                  );

                                  return (
                                    <label key={player.name} style={checkboxLabel}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isConfirmed}
                                        onChange={() =>
                                          toggleItemAssignment(
                                            item.id,
                                            player.name
                                          )
                                        }
                                      />
                                      <span>{player.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {(splitMode === "pot" || splitMode === "pseudo") && (
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={th}>Player</th>
                          <th style={th}>Rank</th>
                          <th style={th}>Final Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualTotals.map((player) => (
                          <tr key={player.name}>
                            <td style={td}>{player.name}</td>
                            <td style={td}>{player.rank}</td>
                            <td style={td}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={player.total}
                                onChange={(e) =>
                                  updateManualTotal(
                                    player.name,
                                    e.target.value
                                  )
                                }
                                style={inputStyle}
                                disabled={isConfirmed}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={sectionBox}>
                  <h2 style={sectionTitle}>Final Allocation Preview</h2>
                  <p style={mutedText}>
                    This is the current split after your edits.
                  </p>

                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Player</th>
                        <th style={th}>Rank</th>
                        <th style={th}>Final Items</th>
                        <th style={th}>Final Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalAllocation.map((player) => (
                        <tr key={player.name}>
                          <td style={td}>{player.name}</td>
                          <td style={td}>{player.rank}</td>
                          <td style={td}>
                            {player.items.length === 0
                              ? "-"
                              : player.items
                                  .map((item) =>
                                    item.shared
                                      ? `${item.name} (£${Number(
                                          item.shareValue || 0
                                        ).toFixed(2)} share)`
                                      : item.name
                                  )
                                  .join(", ")}
                          </td>
                          <td style={td}>
                            £{Number(player.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h3 style={{ marginTop: 18 }}>
                    Final Split Total: £{Number(finalTotal || 0).toFixed(2)}
                  </h3>

                  {splitMode === "items" && !allItemsAssigned && (
                    <p
                      style={{
                        marginTop: 10,
                        color: "#FF9A9A",
                        fontWeight: 600,
                      }}
                    >
                      Every item must be assigned to at least one player.
                    </p>
                  )}

                  {splitMode !== "pseudo" && (
                    <p
                      style={{
                        marginTop: 10,
                        color: totalsMatch ? "#9BE39B" : "#FF9A9A",
                        fontWeight: 600,
                      }}
                    >
                      {totalsMatch
                        ? "Final total matches session total."
                        : "Final total does NOT match session total."}
                    </p>
                  )}
                </div>

                <div style={sectionBox}>
                  <h2 style={sectionTitle}>Final Confirmation</h2>

                  {!isConfirmed ? (
                    <>
                      <p style={mutedText}>
                        Confirm the final split once you are happy with the
                        allocation.
                      </p>

                      {confirmError && (
                        <p style={{ color: "#FF9A9A", fontWeight: 600 }}>
                          {confirmError}
                        </p>
                      )}

                      <button onClick={handleConfirmSplit} style={primaryBtn}>
                        Confirm Final Split
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ color: "#9BE39B", fontWeight: 700 }}>
                        Final split confirmed.
                      </p>

                      <p style={mutedText}>
                        {paymentRequired
                          ? "This session is now ready for payment processing."
                          : "No real payment is required for this session."}
                      </p>

                      {confirmedSplit?.confirmedAt && (
                        <p style={mutedText}>
                          Confirmed at:{" "}
                          {new Date(
                            confirmedSplit.confirmedAt
                          ).toLocaleString()}
                        </p>
                      )}

                      <button onClick={handleUnlockSplit} style={secondaryBtn}>
                        Unlock and Edit Again
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {isConfirmed && confirmedSplit && (
              <div style={receiptBox}>
                <h2 style={receiptTitle}>Saved Final Session Summary</h2>

                <div style={receiptRow}>
                  <span>Mode</span>
                  <strong>{confirmedSplit.modeLabel}</strong>
                </div>

                <div style={receiptRow}>
                  <span>Winner</span>
                  <strong>{confirmedSplit.winnerName || "N/A"}</strong>
                </div>

                <div style={receiptRow}>
                  <span>Payment Required</span>
                  <strong>
                    {confirmedSplit.paymentRequired ? "Yes" : "No"}
                  </strong>
                </div>

                <div style={receiptDivider} />

                {confirmedSplit.finalAllocation.map((player) => (
                  <div key={player.name} style={receiptPlayerBlock}>
                    <div style={receiptRow}>
                      <span>
                        {player.name} (Rank {player.rank})
                      </span>
                      <strong>£{Number(player.total || 0).toFixed(2)}</strong>
                    </div>

                    {player.items?.length > 0 && (
                      <div style={receiptItems}>
                        {player.items.map((item) => (
                          <div
                            key={`${player.name}-${item.id}`}
                            style={receiptItem}
                          >
                            <span>
                              {item.name}
                              {item.shared
                                ? ` (shared, £${Number(
                                    item.shareValue || 0
                                  ).toFixed(2)} share)`
                                : ""}
                            </span>
                            <span>
                              £
                              {Number(
                                item.shared ? item.shareValue : item.cost || 0
                              ).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div style={receiptDivider} />

                <div style={receiptRow}>
                  <span>Final Total</span>
                  <strong>
                    £{Number(confirmedSplit.finalTotal || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            )}

            <div style={footerRow}>
              <button onClick={() => navigate("/lobby")} style={secondaryBtn}>
                Back to Lobby
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* styles */
const page = {
  minHeight: "100vh",
  paddingTop: 80,
  color: "white",
};

const container = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: 20,
};

const title = {
  textAlign: "center",
  marginBottom: 24,
};

const emptyBox = {
  textAlign: "center",
  padding: 24,
  borderRadius: 18,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const winnerCard = {
  padding: 18,
  borderRadius: 16,
  background: "#222",
  color: "white",
  marginBottom: 24,
  textAlign: "center",
};

const sectionBox = {
  marginBottom: 22,
  padding: 18,
  borderRadius: 18,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const sectionTitle = {
  marginTop: 0,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCard = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const summaryLabel = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 6,
};

const summaryValue = {
  fontSize: 16,
  fontWeight: 700,
};

const mutedText = {
  opacity: 0.8,
  lineHeight: 1.5,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  borderBottom: "2px solid rgba(255,255,255,0.18)",
  padding: 10,
  textAlign: "left",
};

const td = {
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  padding: 10,
};

const footerRow = {
  display: "flex",
  justifyContent: "center",
  marginTop: 10,
  marginBottom: 30,
};

const primaryBtn = {
  padding: "10px 18px",
  fontSize: 16,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 18px",
  fontSize: 16,
  cursor: "pointer",
};

const inputStyle = {
  padding: "8px 10px",
  fontSize: 15,
  width: 120,
};

const checkboxWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
};

const receiptBox = {
  marginBottom: 22,
  padding: 22,
  borderRadius: 18,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const receiptTitle = {
  marginTop: 0,
  marginBottom: 18,
  textAlign: "center",
};

const receiptRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
};

const receiptDivider = {
  height: 1,
  background: "rgba(255,255,255,0.14)",
  margin: "14px 0",
};

const receiptPlayerBlock = {
  marginBottom: 10,
};

const receiptItems = {
  marginTop: 8,
  marginLeft: 10,
  opacity: 0.86,
};

const receiptItem = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "3px 0",
  fontSize: 14,
};