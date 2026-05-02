import React, { useEffect, useState } from "react";
import Foam from "../components/foam"

const API = "http://localhost:8000";

// Parse stored hints into an array.
// Backward compatible: if stored value is a JSON array, use it; otherwise treat
// the whole string as a single hint (so questions saved before this change
// still display correctly).
export function parseHints(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter(h => typeof h === "string");
  } catch {
    // not JSON — fall through
  }
  return [raw];
}

// Serialize an array of hints back to a string for the DB.
export function serializeHints(arr) {
  return JSON.stringify((arr || []).map(h => (h || "").trim()).filter(Boolean));
}

const emptyForm = () => ({
  category: "",
  question: "",
  expected_answer: "",
  hints: [""]
});

export default function Questions() {
  const [questions, setQuestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);

  // fetch all questions
  const fetchQuestions = async () => {
    const res = await fetch(`${API}/questions`);
    const data = await res.json();
    setQuestions(data);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // unique categories
  const categories = [...new Set(questions.map(q => q.category))];

  // filtered questions
  const filtered = questions.filter(q => q.category === selectedCategory);

  // handle simple text fields
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // handle hint list
  const updateHint = (index, value) => {
    const next = [...form.hints];
    next[index] = value;
    setForm({ ...form, hints: next });
  };

  const addHint = () => {
    setForm({ ...form, hints: [...form.hints, ""] });
  };

  const removeHint = (index) => {
    if (form.hints.length === 1) {
      setForm({ ...form, hints: [""] });
      return;
    }
    setForm({ ...form, hints: form.hints.filter((_, i) => i !== index) });
  };

  // add or update
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      category: form.category,
      question: form.question,
      expected_answer: form.expected_answer,
      hints: serializeHints(form.hints)
    };

    if (editingId) {
      // UPDATE in place — preserves the question id so any saved games
      // referencing this question keep working.
      await fetch(`${API}/questions/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }

    setForm(emptyForm());
    setEditingId(null);
    fetchQuestions();
  };

  // delete
  const handleDelete = async (id) => {
    await fetch(`${API}/questions/${id}`, {
      method: "DELETE"
    });
    fetchQuestions();
  };

  // edit — parse stored hints into the editable array
  const handleEdit = (q) => {
    const hints = parseHints(q.hints);
    setForm({
      category: q.category || "",
      question: q.question || "",
      expected_answer: q.expected_answer || "",
      hints: hints.length > 0 ? hints : [""]
    });
    setEditingId(q.id);
  };

  const cancelEdit = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  // QUESTIONS VIEW
  return (
  <div>
    <Foam />

    {/* GLOBAL HEADER (always visible) */}
    <h1>Questions Manager</h1>

    {/* CREATE QUESTION FORM (always visible) */}
    <div style={{ marginBottom: 20, padding: 10, border: "1px solid #ccc" }}>
      <h3>{editingId ? "Edit Question" : "Add Question"}</h3>

      <form onSubmit={handleSubmit}>

        <input
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
        />


        <input
          name="question"
          placeholder="Question"
          value={form.question}
          onChange={handleChange}
        />

        <input
          name="expected_answer"
          placeholder="Expected answer"
          value={form.expected_answer}
          onChange={handleChange}
        />

        {/* HINTS — list of inputs */}
        <div className="hintsEditor">
          <label className="hintsEditorLabel">Hints</label>

          {form.hints.map((h, i) => (
            <div key={i} className="hintEditorRow">
              <input
                placeholder={`Hint ${i + 1}`}
                value={h}
                onChange={(e) => updateHint(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeHint(i)}
                title="Remove hint"
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="hintAddBtn"
            onClick={addHint}
          >
            + Add hint
          </button>
        </div>

        <button type="submit">
          {editingId ? "Update" : "Add"}
        </button>

        {editingId && (
          <button type="button" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </form>
    </div>

    {/* CATEGORY VIEW OR QUESTION VIEW */}
    {!selectedCategory ? (
      <div>
        <h2>Categories</h2>

        {categories.map((cat) => (
          <div key={cat}>
            <button onClick={() => setSelectedCategory(cat)}>
              {cat}
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div>
        <button onClick={() => setSelectedCategory(null)}>
          ← Back
        </button>

        <h2>{selectedCategory}</h2>

        {filtered.map((q) => {
          const hintsList = parseHints(q.hints);
          return (
            <div key={q.id} style={{ borderBottom: "1px solid #ccc", padding: 10 }}>
              <div><b>Q:</b> {q.question}</div>
              <div><b>A:</b> {q.expected_answer}</div>
              <div>
                <b>H:</b>{" "}
                {hintsList.length === 0 ? (
                  <em>(none)</em>
                ) : hintsList.length === 1 ? (
                  hintsList[0]
                ) : (
                  <ul style={{ margin: "4px 0 0 20px" }}>
                    {hintsList.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>

              <button onClick={() => handleEdit(q)}>Edit</button>
              <button onClick={() => handleDelete(q.id)}>Delete</button>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
}
