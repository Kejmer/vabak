import React from "react";

export default function Foam() {
  const letters = [
    { char: "V", rot: -10, top: 40, left: 30 },
    { char: "A", rot: 8, top: 45, left: 37 },
    { char: " ", rot: 0 },
    { char: "B", rot: -6, top: 50, left: 50 },
    { char: "A", rot: 10, top: 42, left: 57 },
    { char: "K", rot: -8, top: 48, left: 64 },
  ];

  return (
    <>
      {/* GLOBAL BUBBLES — fixed-position background, visible on every page */}
      <div className="bubbles">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bubble" />
        ))}
      </div>

      <div className="foam" style={{margin: "calc(-1 * var(--space-lg))", marginBottom: "0px"}}>
        {letters.map((l, i) => {
          if (l.char === " ") return null;

          return (
            <span
              key={i}
              className="foam-title-letter"
              style={{
                left: `${l.left}%`,
                top: `${l.top}%`,
                transform: `rotate(${l.rot}deg)`,
              }}
            >
              {l.char}
            </span>
          );
        })}
      </div>
    </>
  );
}
