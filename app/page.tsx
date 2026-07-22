"use client";

import React, { useState, useRef } from "react";

const SUITS = [
  { symbol: "♠", color: "text-slate-900", name: "spades" },
  { symbol: "♥", color: "text-rose-600", name: "hearts" },
  { symbol: "♦", color: "text-rose-600", name: "diamonds" },
  { symbol: "♣", color: "text-slate-900", name: "clubs" },
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const CARD_W = 84;
const CARD_H = 118;
const BOARD_W = 900;
const BOARD_H = 560;
const DECK_X = 30;
const DECK_Y = BOARD_H / 2 - CARD_H / 2;
const DOUBLE_CLICK_MS = 350;

type Suit = { symbol: string; color: string; name: string };
type DeckCard = { id: number; suit: Suit; rank: string };
type TableCard = DeckCard & { x: number; y: number; z: number; faceUp: boolean };

function freshDeck(): DeckCard[] {
  const deck: DeckCard[] = [];
  let id = 0;
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({ id: id++, suit, rank });
    });
  });
  return deck;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

function CardBack() {
  return (
    <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 border-2 border-indigo-400/40 flex flex-col items-center justify-center gap-1">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-300/50" />
      <div className="text-indigo-200/70 text-[8px] font-bold tracking-[0.2em] uppercase">
        Vicious
      </div>
    </div>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="text-slate-300/40 text-[9px] font-extrabold tracking-[0.15em] uppercase -rotate-12">
        Vicious
      </span>
    </div>
  );
}

export default function CardDeckApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [deck, setDeck] = useState<DeckCard[]>(freshDeck);
  const [tableCards, setTableCards] = useState<TableCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [deckPos, setDeckPos] = useState({ x: DECK_X, y: DECK_Y });
  const zRef = useRef(1000);
  const boardRef = useRef<HTMLDivElement>(null);

  const dragState = useRef<{
    id: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const deckClickState = useRef({ count: 0, lastTime: 0 });
  const deckDragState = useRef<{
    mode: "single" | "stack";
    startClientX: number;
    startClientY: number;
    startDeckX: number;
    startDeckY: number;
    moved: boolean;
    drawnCardId: number | null;
  } | null>(null);

  const nextZ = () => {
    zRef.current += 1;
    return zRef.current;
  };

  const shuffleDeck = () => {
    setIsShuffling(true);
    setDeck((d) => shuffleArray(d));
    setTimeout(() => setIsShuffling(false), 450);
  };

  const drawCardToTable = () => {
    if (deck.length === 0) return;
    const [drawn, ...rest] = deck;
    setDeck(rest);
    const jitterX = Math.random() * 30 - 15;
    const jitterY = Math.random() * 30 - 15;
    let x = deckPos.x + CARD_W + 20 + jitterX;
    let y = deckPos.y + jitterY;
    x = clamp(0, BOARD_W - CARD_W, x);
    y = clamp(0, BOARD_H - CARD_H, y);
    setTableCards((cs) => [...cs, { ...drawn, x, y, z: nextZ(), faceUp: false }]);
  };

  const flipCard = (id: number) => {
    setTableCards((cs) => cs.map((c) => (c.id === id ? { ...c, faceUp: !c.faceUp } : c)));
  };

  const bringToFront = (id: number) => {
    const z = nextZ();
    setTableCards((cs) => cs.map((c) => (c.id === id ? { ...c, z } : c)));
  };

  // ---- Table card drag (single already-drawn card) ----
  const handlePointerDown = (e: React.PointerEvent, card: TableCard) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      id: card.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: card.x,
      startY: card.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true;
    if (!ds.moved) return;

    let newX = clamp(0, BOARD_W - CARD_W, ds.startX + dx);
    let newY = clamp(0, BOARD_H - CARD_H, ds.startY + dy);

    setTableCards((cs) => cs.map((c) => (c.id === ds.id ? { ...c, x: newX, y: newY } : c)));
  };

  const handlePointerUp = (e: React.PointerEvent, card: TableCard) => {
    const ds = dragState.current;
    if (ds && ds.id === card.id && ds.moved) {
      bringToFront(card.id);
    }
    dragState.current = null;
  };

  const handleDoubleClick = (card: TableCard) => {
    bringToFront(card.id);
    flipCard(card.id);
  };

  // ---- Deck gestures: single click+hold = one card, double click+hold = whole stack ----
  const handleDeckPointerDown = (e: React.PointerEvent) => {
    if (deck.length === 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const now = Date.now();
    const cs = deckClickState.current;
    const isDouble = now - cs.lastTime < DOUBLE_CLICK_MS;
    cs.count = isDouble ? cs.count + 1 : 1;
    cs.lastTime = now;

    deckDragState.current = {
      mode: cs.count >= 2 ? "stack" : "single",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDeckX: deckPos.x,
      startDeckY: deckPos.y,
      moved: false,
      drawnCardId: null,
    };
  };

  const handleDeckPointerMove = (e: React.PointerEvent) => {
    const ds = deckDragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true;
    if (!ds.moved) return;

    if (ds.mode === "stack") {
      const newX = clamp(0, BOARD_W - CARD_W, ds.startDeckX + dx);
      const newY = clamp(0, BOARD_H - CARD_H, ds.startDeckY + dy);
      setDeckPos({ x: newX, y: newY });
    } else {
      if (ds.drawnCardId === null) {
        if (deck.length === 0) return;
        const drawn = deck[0];
        setDeck((d) => d.slice(1));
        const z = nextZ();
        setTableCards((cs) => [
          ...cs,
          { ...drawn, x: ds.startDeckX, y: ds.startDeckY, z, faceUp: false },
        ]);
        ds.drawnCardId = drawn.id;
      }
      const newX = clamp(0, BOARD_W - CARD_W, ds.startDeckX + dx);
      const newY = clamp(0, BOARD_H - CARD_H, ds.startDeckY + dy);
      setTableCards((cs) =>
        cs.map((c) => (c.id === ds.drawnCardId ? { ...c, x: newX, y: newY } : c))
      );
    }
  };

  const handleDeckPointerUp = () => {
    const ds = deckDragState.current;
    if (ds && !ds.moved && ds.mode === "single") {
      drawCardToTable();
    }
    deckDragState.current = null;
  };

  const resetAll = () => {
    setDeck(freshDeck());
    setTableCards([]);
    setDeckPos({ x: DECK_X, y: DECK_Y });
    zRef.current = 1000;
  };

  const collectToDeck = () => {
    setDeck((d) => [
      ...tableCards.map(({ x, y, z, faceUp, ...rest }) => rest),
      ...d,
    ]);
    setTableCards([]);
    setDeckPos({ x: DECK_X, y: DECK_Y });
  };

  if (showSplash) {
    return (
      <div
        onClick={() => setShowSplash(false)}
        className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-emerald-900 to-black flex flex-col items-center justify-center text-center px-6 cursor-pointer"
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[0.25em] text-amber-400 drop-shadow-lg mb-3">
          VICIOUS DECK
        </h1>
        <p className="text-emerald-200 text-sm mb-10 animate-pulse">Tap anywhere to enter</p>
        <div className="max-w-md text-emerald-400/60 text-[11px] leading-relaxed space-y-2">
          <p>© 2026 Vicious Deck. All rights reserved.</p>
          <p>
            Licensed for personal use only. Unauthorized reproduction, distribution, or
            modification of this software or its contents is strictly prohibited without
            express permission from the developer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 flex flex-col items-center py-6 px-4 font-sans">
      <h1 className="text-2xl font-bold text-emerald-50 mb-1 tracking-tight">Card Deck</h1>
      <p className="text-emerald-200 text-sm mb-4 text-center max-w-xl">
        Click once & hold to drag a single card · Click twice & hold to drag the whole stack ·
        Double-click a card on the table to flip it
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4 bg-emerald-950/40 backdrop-blur px-4 py-3 rounded-xl border border-emerald-700/50">
        <button
          onClick={shuffleDeck}
          disabled={isShuffling}
          className="bg-amber-400 hover:bg-amber-300 active:scale-95 transition text-emerald-950 font-semibold px-4 py-2 rounded-lg shadow disabled:opacity-60"
        >
          {isShuffling ? "Shuffling…" : "Shuffle deck"}
        </button>
        <button
          onClick={collectToDeck}
          className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 transition text-emerald-50 font-medium px-3 py-2 rounded-lg text-sm"
        >
          Collect cards
        </button>
        <button
          onClick={resetAll}
          className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 transition text-emerald-50 font-medium px-3 py-2 rounded-lg text-sm"
        >
          New deck
        </button>
        <span className="text-emerald-200 text-sm font-mono">{deck.length} cards left</span>
      </div>

      <div
        ref={boardRef}
        onPointerMove={handlePointerMove}
        className="relative bg-emerald-800/60 rounded-2xl border-4 border-emerald-700 shadow-2xl touch-none"
        style={{ width: BOARD_W, height: BOARD_H, maxWidth: "95vw" }}
      >
        {deck.length > 0 && (
          <div
            onPointerDown={handleDeckPointerDown}
            onPointerMove={handleDeckPointerMove}
            onPointerUp={handleDeckPointerUp}
            className="absolute cursor-grab active:cursor-grabbing"
            style={{ left: deckPos.x, top: deckPos.y, width: CARD_W, height: CARD_H }}
            title="Click & hold: one card · click twice & hold: whole stack"
          >
            {Array.from({ length: Math.min(6, deck.length) }).map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-lg shadow-md ${
                  isShuffling ? "transition-transform duration-300" : ""
                }`}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  left: -i * 1.5 + (isShuffling ? Math.random() * 10 - 5 : 0),
                  top: -i * 1.5 + (isShuffling ? Math.random() * 10 - 5 : 0),
                  zIndex: i,
                }}
              >
                <CardBack />
              </div>
            ))}
          </div>
        )}
        {deck.length === 0 && (
          <div
            className="absolute rounded-lg border-2 border-dashed border-emerald-500/50 flex items-center justify-center text-emerald-400 text-xs"
            style={{ left: deckPos.x, top: deckPos.y, width: CARD_W, height: CARD_H }}
          >
            empty
          </div>
        )}

        {tableCards
          .slice()
          .sort((a, b) => a.z - b.z)
          .map((card) => (
            <div
              key={card.id}
              onPointerDown={(e) => handlePointerDown(e, card)}
              onPointerUp={(e) => handlePointerUp(e, card)}
              onDoubleClick={() => handleDoubleClick(card)}
              className="absolute select-none cursor-grab active:cursor-grabbing rounded-lg shadow-md"
              style={{ width: CARD_W, height: CARD_H, left: card.x, top: card.y, zIndex: card.z }}
              title="Hold & drag to move · double-click to flip"
            >
              {card.faceUp ? (
                <div className="relative w-full h-full bg-white rounded-lg ring-1 ring-slate-300 flex flex-col justify-between p-1.5 overflow-hidden">
                  <Watermark />
                  <div className={`relative text-sm font-bold leading-none ${card.suit.color}`}>
                    {card.rank}
                    <div className="text-xs">{card.suit.symbol}</div>
                  </div>
                  <div className={`relative self-center text-2xl ${card.suit.color}`}>
                    {card.suit.symbol}
                  </div>
                  <div
                    className={`relative text-sm font-bold leading-none self-end rotate-180 ${card.suit.color}`}
                  >
                    {card.rank}
                    <div className="text-xs">{card.suit.symbol}</div>
                  </div>
                </div>
              ) : (
                <CardBack />
              )}
            </div>
          ))}
      </div>

      <p className="text-emerald-300 text-xs mt-3">
        {tableCards.length} card{tableCards.length !== 1 ? "s" : ""} on the table
      </p>
      <p className="text-emerald-500/50 text-[10px] mt-2">© 2026 Vicious Deck — All rights reserved.</p>
    </div>
  );
}
