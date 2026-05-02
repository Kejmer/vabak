import React from "react";

export default function CategoryEditorBox({
  category,
  setCategory,
  categories,
  availableQuestions,
  selectedQuestions,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRemoveCategory
}) {
  return (
    <div className="editorBox">

      {/* CATEGORY SELECT */}
      <div className="editorHeader">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Choose category</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {onRemoveCategory && (
          <button
            type="button"
            className="categoryRemoveBtn"
            onClick={onRemoveCategory}
            title="Remove this category from the round"
          >
            × Remove category
          </button>
        )}
      </div>

      {/* SPLIT */}
      <div className="editorSplit">

        {/* LEFT - selected */}
        <div className="editorSide">
          <h4>Selected</h4>

          {selectedQuestions.map((q, idx) => (
            <div key={q.id} className="questionCard">
              <div>{q.question}</div>

              <div className="actions">
                <button onClick={() => onMoveUp(idx)}>↑</button>
                <button onClick={() => onMoveDown(idx)}>↓</button>
                <button onClick={() => onRemove(q.id)}>→</button>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT - available */}
        <div className="editorSide">
          <h4>Available</h4>

          {availableQuestions.map(q => (
            <div key={q.id} className="questionCard">
              <div>{q.question}</div>
              <button onClick={() => onAdd(q.id)}>←</button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
