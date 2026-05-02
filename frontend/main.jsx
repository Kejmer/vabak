import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./global.css"

import Home from "./pages/Home";
import GameSelection from "./pages/GameSelection";
import Questions from "./pages/Questions";
import GameBoard from "./pages/GameBoard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game-selection" element={<GameSelection />} />
        <Route path="/game-selection/:id" element={<GameSelection />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/game/:id" element={<GameBoard />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);
