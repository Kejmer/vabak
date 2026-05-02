import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Foam from "../components/foam";
import ConfirmDialog from "../components/ConfirmDialog";

const API = "http://localhost:8000";

const stateKey = (gameId) => `vabak:game-state:${gameId}`;

export default function Home() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadGames = () => {
    fetch(`${API}/games`)
      .then(res => res.json())
      .then(setGames);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const requestDelete = (game) => {
    setConfirmDialog({
      message: `Delete "${game.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmStyle: "danger",
      onConfirm: async () => {
        try {
          await fetch(`${API}/games/${game.id}`, { method: "DELETE" });
          // also wipe any saved play-state for this game
          try { localStorage.removeItem(stateKey(game.id)); } catch {}
          loadGames();
        } catch (err) {
          console.error("Delete failed:", err);
        }
      }
    });
  };

  return (
    <div>
      <Foam />

      <div className="content">
        <div style={{ width: "100%", maxWidth: 1000 }}>
          <div className="buttonRow" style={{ justifyContent: "center" }}>
            <button className="main" onClick={() => navigate("/game-selection")}>
              New Game
            </button>

            <button className="main" onClick={() => navigate("/questions")}>
              Edit Questions
            </button>
          </div>

          <div style={{ marginTop: 40 }}>
            <h3>Saved Games</h3>

            <div className="gamesGrid">
              {games.length === 0 && <p>No games yet</p>}

              {games.map(game => (
                <div key={game.id} className="gameCard">
                  <strong>{game.name}</strong>

                  <div className="gameCardActions">
                    <button
                      onClick={() => navigate(`/game/${game.id}`)}
                    >
                      Play
                    </button>
                    <button
                      className="gameCardEdit"
                      onClick={() => navigate(`/game-selection/${game.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      className="gameCardDelete"
                      onClick={() => requestDelete(game)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
