import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Foam from "../components/foam";
import ConfirmDialog from "../components/ConfirmDialog";
import { parseHints } from "./Questions";

const API = "http://localhost:8000";

// localStorage key per game
const stateKey = (gameId) => `vabak:game-state:${gameId}`;

export default function GameBoard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // teams
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);

  // round
  const [currentRound, setCurrentRound] = useState(0);

  // tile state — keyed by round_question_id
  const [usedTiles, setUsedTiles] = useState({});
  const [activeTile, setActiveTile] = useState(null);

  // modal state
  const [revealedHintCount, setRevealedHintCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // confirmation dialog: { message, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);

  // load game board
  useEffect(() => {
    fetch(`${API}/games/${id}/board`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(data => {
        setBoard(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // restore persisted state for this game (teams, score, used tiles)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(stateKey(id));
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.teams) setTeams(saved.teams);
      if (saved.usedTiles) setUsedTiles(saved.usedTiles);
      if (typeof saved.currentRound === "number") setCurrentRound(saved.currentRound);
      if (saved.gameStarted) setGameStarted(true);
    } catch {
      // ignore corrupted state
    }
  }, [id]);

  // persist on changes
  useEffect(() => {
    if (!gameStarted && teams.length === 0 && Object.keys(usedTiles).length === 0) return;
    try {
      localStorage.setItem(stateKey(id), JSON.stringify({
        teams, usedTiles, currentRound, gameStarted
      }));
    } catch {
      // quota or whatever — fine to ignore
    }
  }, [id, teams, usedTiles, currentRound, gameStarted]);

  // ---- TEAM HANDLERS ----
  const addTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    setTeams([...teams, { id: Date.now() + Math.random(), name, score: 0 }]);
    setNewTeamName("");
  };

  const removeTeam = (teamId) => {
    setTeams(teams.filter(t => t.id !== teamId));
  };

  const startGame = () => {
    if (teams.length === 0) return;
    setGameStarted(true);
  };

  const resetGame = () => {
    setConfirmDialog({
      message: "Reset whole game? Scores and tile progress will be cleared.",
      confirmLabel: "Reset",
      confirmStyle: "danger",
      onConfirm: () => {
        setTeams([]);
        setUsedTiles({});
        setCurrentRound(0);
        setGameStarted(false);
        setActiveTile(null);
        try { localStorage.removeItem(stateKey(id)); } catch {}
      }
    });
  };

  // ---- TILE / MODAL HANDLERS ----
  const openTile = (q) => {
    // allowed even for used tiles (host can review or correct a misjudgment)
    setActiveTile(q);
    setRevealedHintCount(0);
    setShowAnswer(false);
  };

  const markUsedAndClose = () => {
    if (activeTile) {
      setUsedTiles(prev => ({ ...prev, [activeTile.round_question_id]: true }));
    }
    setActiveTile(null);
  };

  const cancelTile = () => {
    // close without marking used (e.g. opened by mistake)
    setActiveTile(null);
  };

  const requestAwardPoints = (team, delta) => {
    const sign = delta >= 0 ? "+" : "−";
    setConfirmDialog({
      message: `Award ${team.name}: ${sign}${Math.abs(delta)} points?`,
      confirmLabel: "Yes, award",
      confirmStyle: "primary",
      onConfirm: () => {
        setTeams(prev => prev.map(t =>
          t.id === team.id ? { ...t, score: t.score + delta } : t
        ));
        markUsedAndClose();
      }
    });
  };

  const skipNoOne = () => {
    markUsedAndClose();
  };

  const requestRevealAnswer = () => {
    if (showAnswer) {
      setShowAnswer(false);
      return;
    }
    setConfirmDialog({
      message: "Reveal the correct answer?",
      confirmLabel: "Reveal",
      confirmStyle: "primary",
      onConfirm: () => setShowAnswer(true)
    });
  };

  const requestRevealHint = () => {
    if (!activeTile) return;
    const total = parseHints(activeTile.hints).length;
    if (revealedHintCount >= total) return;
    const nextIndex = revealedHintCount + 1;
    const msg = total === 1
      ? "Show the hint?"
      : `Show hint ${nextIndex}?`;
    setConfirmDialog({
      message: msg,
      confirmLabel: "Show hint",
      confirmStyle: "primary",
      onConfirm: () => setRevealedHintCount(c => c + 1)
    });
  };

  // ---- RENDER ----
  if (loading) {
    return (
      <div>
        <Foam />
        <div style={{ padding: 20 }}><p>Loading...</p></div>
      </div>
    );
  }

  if (error || !board || !board.rounds) {
    return (
      <div>
        <Foam />
        <div style={{ padding: 20 }}>
          <p>Could not load game.</p>
          <button onClick={() => navigate("/")}>← Back to menu</button>
        </div>
      </div>
    );
  }

  // ---- TEAM SETUP SCREEN ----
  if (!gameStarted) {
    return (
      <div>
        <Foam />

        <div className="teamSetupWrap">
          <h2>{board.name}</h2>
          <p>Add teams</p>

          <div className="teamSetupCard">
            <h3>Teams</h3>

            <div className="teamSetupInputRow">
              <input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTeam(); }}
              />
              <button onClick={addTeam}>+ Add</button>
            </div>

            <div className="teamsSetupList">
              {teams.length === 0 && <p>No teams yet</p>}
              {teams.map((t) => (
                <div key={t.id} className="teamSetupRow">
                  <span>{t.name}</span>
                  <button onClick={() => removeTeam(t.id)}>Remove</button>
                </div>
              ))}
            </div>

            <div className="teamSetupActions">
              <button onClick={() => navigate("/")}>← Back</button>
              <button
                className="main"
                disabled={teams.length === 0}
                onClick={startGame}
              >
                Start Game
              </button>
            </div>
          </div>
        </div>

        {/* Confirm popup also available on this screen (e.g. for resets in the future) */}
        {confirmDialog && (
          <ConfirmDialog
            dialog={confirmDialog}
            onClose={() => setConfirmDialog(null)}
          />
        )}
      </div>
    );
  }

  // ---- BOARD SCREEN ----
  const round = board.rounds[currentRound];

  if (!round) {
    return (
      <div>
        <Foam />
        <div style={{ padding: 20 }}>
          <p>This game has no rounds.</p>
          <button onClick={() => navigate("/")}>← Back</button>
        </div>
      </div>
    );
  }

  const maxRows = Math.max(0, ...round.categories.map(c => c.questions.length));
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  // hints for the active tile
  const activeHints = activeTile ? parseHints(activeTile.hints) : [];
  const totalHints = activeHints.length;
  const canRevealMoreHints = revealedHintCount < totalHints;
  const hintButtonLabel = (() => {
    if (totalHints === 0) return null;
    if (totalHints === 1) return "Show hint";
    return `Show hint ${revealedHintCount + 1}`;
  })();

  return (
    <div>
      <Foam />

      <div className="gameLayout">
        {/* MAIN BOARD AREA */}
        <div className="gameMain">
          <div className="gameTopBar">
            <h2 style={{ margin: 0 }}>{board.name}</h2>

            <div className="gameTopBarActions">
              <button onClick={() => navigate("/")}>Menu</button>
              <button onClick={resetGame}>Reset</button>
            </div>
          </div>

          {board.rounds.length > 1 && (
            <div className="roundTabs">
              {board.rounds.map((r, i) => (
                <button
                  key={r.round_id}
                  className={i === currentRound ? "roundTab active" : "roundTab"}
                  onClick={() => setCurrentRound(i)}
                >
                  Round {r.round_number}
                </button>
              ))}
            </div>
          )}

          {round.categories.length === 0 ? (
            <p>This round has no categories.</p>
          ) : (
            <div
              className="board"
              style={{
                gridTemplateColumns: `repeat(${round.categories.length}, 1fr)`,
              }}
            >
              {/* CATEGORY HEADERS (top row) */}
              {round.categories.map((cat, i) => (
                <div key={`cat-${i}`} className="categoryHeader">
                  {cat.category || <em style={{opacity:.6}}>(no name)</em>}
                </div>
              ))}

              {/* TILES */}
              {Array.from({ length: maxRows }).map((_, rowIdx) =>
                round.categories.map((cat, colIdx) => {
                  const q = cat.questions[rowIdx];
                  if (!q) {
                    return (
                      <div
                        key={`empty-${rowIdx}-${colIdx}`}
                        className="tile empty"
                      />
                    );
                  }
                  const isUsed = !!usedTiles[q.round_question_id];
                  return (
                    <div
                      key={q.round_question_id}
                      className={`tile ${isUsed ? "used" : ""}`}
                      onClick={() => openTile(q)}
                    >
                      {!isUsed && q.value}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* RANKING SIDEBAR */}
        <aside className="ranking">
          <h3>Ranking</h3>
          {sortedTeams.length === 0 && <p>No teams.</p>}
          {sortedTeams.map((t, i) => (
            <div key={t.id} className={`teamRow rank-${i + 1}`}>
              <span className="rank">{i + 1}.</span>
              <span className="teamName" title={t.name}>{t.name}</span>
              <span className="score">{t.score}</span>
            </div>
          ))}
        </aside>
      </div>

      {/* QUESTION MODAL */}
      {activeTile && (
        <div className="modalOverlay" onClick={cancelTile}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <span className="modalCategory">{activeTile.category}</span>
              <span className="modalValue">{activeTile.value}</span>
              <button
                className="modalClose"
                onClick={cancelTile}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>

            <h2 className="modalQuestion">{activeTile.question}</h2>

            <div className="modalActions">
              {hintButtonLabel && canRevealMoreHints && (
                <button onClick={requestRevealHint}>
                  {hintButtonLabel}
                </button>
              )}
              {totalHints > 0 && revealedHintCount > 0 && (
                <button onClick={() => setRevealedHintCount(0)}>
                  Hide hints
                </button>
              )}
              <button onClick={requestRevealAnswer}>
                {showAnswer ? "Hide answer" : "Reveal correct answer"}
              </button>
            </div>

            {/* Revealed hints */}
            {revealedHintCount > 0 && (
              <div className="hintList">
                {activeHints.slice(0, revealedHintCount).map((h, i) => (
                  <div key={i} className="hintBox">
                    <strong>
                      {totalHints === 1 ? "Hint:" : `Hint ${i + 1}:`}
                    </strong>{" "}
                    {h}
                  </div>
                ))}
              </div>
            )}

            {showAnswer && (
              <div className="answerReveal">
                ✅ {activeTile.expected_answer}
              </div>
            )}

            <h4 style={{ marginTop: 16 }}>Who answered?</h4>
            <div className="teamButtons">
              {teams.length === 0 && <p>No teams.</p>}
              {teams.map((t) => (
                <div key={t.id} className="teamButtonGroup">
                  <span className="teamButtonName">{t.name}</span>
                  <button
                    className="correctBtn"
                    onClick={() => requestAwardPoints(t, activeTile.value)}
                  >
                    +{activeTile.value}
                  </button>
                  <button
                    className="wrongBtn"
                    onClick={() => requestAwardPoints(t, -activeTile.value)}
                  >
                    −{activeTile.value}
                  </button>
                </div>
              ))}
            </div>

            <div className="modalBottomActions">
              <button className="secondary" onClick={cancelTile}>
                Cancel (don't mark used)
              </button>
              <button className="secondary" onClick={skipNoOne}>
                No one answered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation popup — sits ABOVE the question modal */}
      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
