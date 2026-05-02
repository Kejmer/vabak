import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Foam from "../components/foam";
import CategoryEditorBox from "../components/categoryEditorBox";

const API = "http://localhost:8000";

const stateKey = (gameId) => `vabak:game-state:${gameId}`;

export default function GameSelection() {
  const navigate = useNavigate();
  const { id: editingId } = useParams(); // present iff /game-selection/:id
  const isEditMode = !!editingId;

  const [roundCount, setRoundCount] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [gameName, setGameName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);

  // LOAD QUESTIONS
  useEffect(() => {
    fetch(`${API}/questions`)
      .then(res => res.json())
      .then(data => {
        const withIds = data.map((q, i) => ({
          ...q,
          id: q.id ?? i
        }));

        setQuestions(withIds);

        const uniqueCategories = [...new Set(withIds.map(q => q.category))];
        setCategories(uniqueCategories);
      });
  }, []);

  // LOAD EXISTING GAME (edit mode)
  useEffect(() => {
    if (!isEditMode) return;

    fetch(`${API}/games/${editingId}/board`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load game");
        return res.json();
      })
      .then(data => {
        setGameName(data.name || "");

        // Convert board structure -> editor structure:
        // editor stores each category as { category, questions: [questionId, ...] }
        // (sorted by value asc — index 0 = lowest value = the "100" tile)
        const loadedRounds = (data.rounds || []).map(r => ({
          categories: (r.categories || []).map(c => ({
            category: c.category,
            questions: c.questions
              .slice()
              .sort((a, b) => a.value - b.value)
              .map(q => q.question_id)
          }))
        }));

        setRounds(loadedRounds);
        setRoundCount(loadedRounds.length || 1);

        // Make sure all categories used in the game appear in the dropdown,
        // even if no current question references them anymore.
        setCategories(prev => {
          const set = new Set(prev);
          loadedRounds.forEach(r => r.categories.forEach(c => {
            if (c.category) set.add(c.category);
          }));
          return [...set];
        });

        setLoadingExisting(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingExisting(false);
      });
  }, [editingId, isEditMode]);

  // INIT / RESIZE ROUNDS based on roundCount.
  // Smart: preserves existing rounds when extending or shrinking, instead
  // of wiping everything (which the old code did).
  useEffect(() => {
    setRounds(prev => {
      if (prev.length === roundCount) return prev;
      if (roundCount > prev.length) {
        return [
          ...prev,
          ...Array.from(
            { length: roundCount - prev.length },
            () => ({ categories: [] })
          )
        ];
      }
      return prev.slice(0, roundCount);
    });
  }, [roundCount]);

  // HELPERS
  const getUsedQuestionIds = () => {
    const used = new Set();

    rounds.forEach(r => {
      r.categories.forEach(c => {
        c.questions?.forEach(id => used.add(id));
      });
    });

    return used;
  };

  const getAvailableQuestions = (category) => {
    const used = getUsedQuestionIds();

    return questions.filter(
      q => q.category === category && !used.has(q.id)
    );
  };

  // CATEGORY HANDLING

  const addCategory = (roundIndex) => {
    const updated = [...rounds];

    if (updated[roundIndex].categories.length >= 5) return;

    updated[roundIndex].categories.push({
      category: "",
      questions: []
    });

    setRounds(updated);
  };

  const removeCategory = (roundIndex, catIndex) => {
    const updated = [...rounds];
    updated[roundIndex].categories.splice(catIndex, 1);
    setRounds(updated);
  };

  const setCategory = (roundIndex, catIndex, category) => {
    const updated = [...rounds];

    updated[roundIndex].categories[catIndex].category = category;
    updated[roundIndex].categories[catIndex].questions = [];

    setRounds(updated);
  };

  // QUESTION HANDLING

  const addQuestion = (roundIndex, catIndex, questionId) => {
    const updated = [...rounds];
    const cat = updated[roundIndex].categories[catIndex];

    if (!cat.questions.includes(questionId)) {
      cat.questions.push(questionId);
    }

    setRounds(updated);
  };

  const removeQuestion = (roundIndex, catIndex, questionId) => {
    const updated = [...rounds];
    const cat = updated[roundIndex].categories[catIndex];

    cat.questions = cat.questions.filter(q => q !== questionId);

    setRounds(updated);
  };

  const moveUp = (roundIndex, catIndex, index) => {
    const updated = [...rounds];
    const arr = updated[roundIndex].categories[catIndex].questions;

    if (index === 0) return;

    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];

    setRounds(updated);
  };

  const moveDown = (roundIndex, catIndex, index) => {
    const updated = [...rounds];
    const arr = updated[roundIndex].categories[catIndex].questions;

    if (index === arr.length - 1) return;

    [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];

    setRounds(updated);
  };

  const saveGame = async () => {
    setSaving(true);

    const payload = {
      name: gameName,
      rounds: rounds.map((r, roundIndex) => ({
        round_number: roundIndex + 1,
        categories: r.categories.map((c) => ({
          category: c.category,
          questions: c.questions.map((qid, index) => {
            const value = (index + 1) * 100; // 100,200,300...

            return {
              question_id: qid,
              value
            };
          })
        }))
      }))
    };

    try {
      const url = isEditMode
        ? `${API}/games/${editingId}/full`
        : `${API}/games/full`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        console.log("GAME SAVED:", data);

        // After editing, the round_question IDs change — clear any saved
        // play-state for this game so a stale "used" set doesn't haunt it.
        if (isEditMode) {
          try { localStorage.removeItem(stateKey(editingId)); } catch {}
        }

        navigate("/");
      } else {
        console.error("Save failed:", await res.text());
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <div>
        <Foam />
        <div style={{ padding: 20 }}><p>Loading game...</p></div>
      </div>
    );
  }

  return (
    <div>
      <Foam />

      <div style={{ padding: 20 }}>
        <div className="gameTopBar">
          <h2 style={{ margin: 0 }}>
            {isEditMode ? "Edit game" : "Game configuration"}
          </h2>
          <div className="gameTopBarActions">
            <button onClick={() => navigate("/")}>← Back</button>
          </div>
        </div>

        <div style={{ marginBottom: 20, marginTop: 16 }}>
          <input
            placeholder="Game name"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />

          <button
            className="main"
            onClick={saveGame}
            disabled={!gameName || saving}
          >
            {saving
              ? (isEditMode ? "Updating..." : "Saving...")
              : (isEditMode ? "Update Game" : "Save Game")}
          </button>
        </div>

        <label>Number of rounds: </label>
        <input
          type="number"
          min="1"
          value={roundCount}
          onChange={(e) => setRoundCount(Math.max(1, Number(e.target.value) || 1))}
        />

        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} style={{ marginTop: 30 }}>
            <h3>Round {roundIndex + 1}</h3>

            {round.categories.map((cat, catIndex) => (
              <CategoryEditorBox
                key={catIndex}
                category={cat.category}
                categories={categories.filter(c =>
                  !round.categories.some(
                    (x, i) => i !== catIndex && x.category === c
                  )
                )}
                availableQuestions={getAvailableQuestions(cat.category)}
                selectedQuestions={cat.questions
                  .map(id => questions.find(q => q.id === id))
                  .filter(Boolean)}

                setCategory={(val) =>
                  setCategory(roundIndex, catIndex, val)
                }

                onAdd={(id) =>
                  addQuestion(roundIndex, catIndex, id)
                }

                onRemove={(id) =>
                  removeQuestion(roundIndex, catIndex, id)
                }

                onMoveUp={(i) =>
                  moveUp(roundIndex, catIndex, i)
                }

                onMoveDown={(i) =>
                  moveDown(roundIndex, catIndex, i)
                }

                onRemoveCategory={() =>
                  removeCategory(roundIndex, catIndex)
                }
              />
            ))}

            {round.categories.length < 5 && (
              <button onClick={() => addCategory(roundIndex)}>
                + Add category
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
