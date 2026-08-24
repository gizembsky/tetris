'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const COLS = 8;
const ROWS = 11;
const COLORS = ['coral', 'lemon', 'aqua', 'violet'] as const;
type Color = (typeof COLORS)[number];
type Cell = Color | null;

const STARTING_ROWS: Cell[][] = [
  [null, 'coral', 'coral', null, 'aqua', 'aqua', null, null],
  ['lemon', 'lemon', null, 'violet', 'violet', null, 'coral', null],
  [null, 'aqua', 'aqua', 'aqua', null, 'lemon', 'lemon', null],
];

function blankBoard(): Cell[][] {
  return Array.from({ length: ROWS - STARTING_ROWS.length }, () => Array(COLS).fill(null)).concat(STARTING_ROWS.map((row) => [...row]));
}

function createIncoming(): Cell[] {
  const row: Cell[] = Array(COLS).fill(null);
  const count = 4 + Math.floor(Math.random() * 3);
  const slots = Array.from({ length: COLS }, (_, index) => index);
  for (let i = 0; i < count; i += 1) {
    const slot = slots.splice(Math.floor(Math.random() * slots.length), 1)[0];
    row[slot] = COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  return row;
}

function shiftRow(row: Cell[], direction: -1 | 1): Cell[] {
  const next = Array<Cell>(COLS).fill(null);
  row.forEach((cell, index) => {
    if (cell) next[(index + direction + COLS) % COLS] = cell;
  });
  return next;
}

export default function Home() {
  const [board, setBoard] = useState<Cell[][]>(() => blankBoard());
  const [incoming, setIncoming] = useState<Cell[]>([null, 'aqua', 'coral', null, 'lemon', null, 'violet', 'violet']);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => typeof window === 'undefined' ? 0 : Number(window.localStorage.getItem('uplift-best') || 0));
  const [turn, setTurn] = useState(1);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMuted] = useState(false);
  const [clearedRows, setClearedRows] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (gameOver) return;
      if (event.key === 'ArrowLeft') setIncoming((row) => shiftRow(row, -1));
      if (event.key === 'ArrowRight') setIncoming((row) => shiftRow(row, 1));
      if (event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        document.getElementById('raise-button')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameOver]);

  const filled = useMemo(() => board.flat().filter(Boolean).length, [board]);
  const danger = board.slice(0, 3).some((row) => row.some(Boolean));

  const raise = useCallback(() => {
    if (gameOver) return;
    const stacked = board.map((row) => [...row]);
    let overflow = false;
    incoming.forEach((cell, column) => {
      if (!cell) return;
      let target = ROWS - 1;
      while (target >= 0 && stacked[target][column]) target -= 1;
      if (target < 0) overflow = true;
      else stacked[target][column] = cell;
    });
    const fullRows = stacked.reduce<number[]>((all, row, index) => row.every(Boolean) ? [...all, index] : all, []);
    const remaining = stacked.filter((_, index) => !fullRows.includes(index));
    const next = Array.from({ length: fullRows.length }, () => Array<Cell>(COLS).fill(null)).concat(remaining);

    if (fullRows.length) {
      setClearedRows(fullRows);
      window.setTimeout(() => setClearedRows([]), 440);
      const nextCombo = combo + 1;
      const nextScore = score + fullRows.length * 800 * nextCombo;
      setScore(nextScore);
      setBest((current) => {
        const value = Math.max(current, nextScore);
        window.localStorage.setItem('uplift-best', String(value));
        return value;
      });
      setCombo(nextCombo);
    } else {
      setScore((current) => current + 25);
      setCombo(0);
    }

    setBoard(next);
    setIncoming(createIncoming());
    setTurn((current) => current + 1);
    if (overflow) setGameOver(true);
  }, [board, combo, gameOver, incoming, score]);

  const reset = () => {
    setBoard(blankBoard()); setIncoming(createIncoming()); setScore(0); setTurn(1); setCombo(0); setGameOver(false);
  };

  const continueGame = () => {
    setBoard((current) => current.map((row, index) => index < 3 ? Array<Cell>(COLS).fill(null) : row));
    setGameOver(false); setCombo(0);
  };

  return (
    <main className="game-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <section className="game-card" aria-label="Yukarı oyun alanı">
        <header className="topbar">
          <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><div><h1>YUKARI</h1><p>Bir sıra daha.</p></div></div>
          <div className="header-actions"><button className="icon-button" onClick={() => setShowHelp(true)} aria-label="Nasıl oynanır">?</button><button className="icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}>{muted ? '×' : '♪'}</button></div>
        </header>
        <div className="stats" aria-label="Oyun istatistikleri">
          <div><span>SKOR</span><strong>{score.toLocaleString('tr-TR')}</strong></div><div className="turn"><span>HAMLE</span><strong>{String(turn).padStart(2, '0')}</strong></div><div><span>REKOR</span><strong>{best.toLocaleString('tr-TR')}</strong></div>
        </div>
        <div className={`board-wrap ${danger ? 'is-danger' : ''}`}>
          <div className="danger-line"><span>TEHLİKE SINIRI</span></div>
          <div className="board" role="grid" aria-label={`${filled} blok bulunan oyun tahtası`}>
            {board.map((row, rowIndex) => row.map((cell, colIndex) => <div key={`${rowIndex}-${colIndex}`} role="gridcell" className={`cell ${cell ? `block ${cell}` : ''} ${clearedRows.includes(rowIndex) ? 'clearing' : ''}`}>{cell && <span className="block-shine" />}</div>))}
          </div>
          {combo > 0 && <div className="combo-badge">x{combo} KOMBO</div>}
        </div>
        <div className="incoming-label"><span>SIRADAKİ</span><i /></div>
        <div className="incoming-row" aria-label="Gelecek blok sırası">{incoming.map((cell, index) => <div key={index} className={`preview-cell ${cell ? `block ${cell}` : ''}`}>{cell && <span className="block-shine" />}</div>)}</div>
        <div className="controls">
          <button onClick={() => setIncoming((row) => shiftRow(row, -1))} aria-label="Sırayı sola kaydır"><span>←</span><small>SOLA</small></button>
          <button id="raise-button" className="raise-button" onClick={raise}><span>↑</span><small>YÜKSELT</small></button>
          <button onClick={() => setIncoming((row) => shiftRow(row, 1))} aria-label="Sırayı sağa kaydır"><span>→</span><small>SAĞA</small></button>
        </div>
        <p className="hint">Sırayı kaydır · Boşlukları hizala · Yukarı it</p>
      </section>
      {showHelp && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="modal"><button className="close" onClick={() => setShowHelp(false)} aria-label="Kapat">×</button><span className="eyebrow">NASIL OYNANIR?</span><h2 id="help-title">Boşluğu gör.<br />Sırayı kaydır.</h2><div className="steps"><p><b>01</b> Alttaki renkli sırayı sağa veya sola kaydır.</p><p><b>02</b> Yükselt ile tahtaya ekle.</p><p><b>03</b> Eksiksiz yatay sıra oluştur ve patlat.</p></div><button className="primary" onClick={() => setShowHelp(false)}>ANLADIM, OYNA</button></div></div>}
      {gameOver && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gameover-title"><div className="modal game-over"><span className="eyebrow">TEPEYE ULAŞTIN</span><h2 id="gameover-title">İyi gittin!</h2><p className="final-score"><span>SKORUN</span>{score.toLocaleString('tr-TR')}</p><button className="reward" onClick={continueGame}><span className="play-icon">▶</span><span><b>1 SIRA SİLEREK DEVAM ET</b><small>Ödüllü reklamı izle</small></span></button><button className="secondary" onClick={reset}>YENİDEN BAŞLA</button><p className="ad-note">Tam ekran reklam alanı</p></div></div>}
    </main>
  );
}
