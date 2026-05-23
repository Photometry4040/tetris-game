import React, { useEffect, useRef, useState } from 'react';

const COLS = 10;
const ROWS = 20;
const BS = 20; // block size
const CANVAS_W = 960;
const CANVAS_H = 540;

// Board layout
const P1_BOARD_X = 110;
const P2_BOARD_X = 640;
const BOARD_Y = 60;
const BOARD_W = COLS * BS;  // 200
const BOARD_H = ROWS * BS;  // 400

const COLORS = [
  'transparent',
  '#0abdc6', // I
  '#2563eb', // J
  '#f97316', // L
  '#ffd300', // O
  '#22c55e', // S
  '#a855f7', // T
  '#ef4444', // Z
];

const SHAPES = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,0,0],[2,2,2],[0,0,0]],
  [[0,0,3],[3,3,3],[0,0,0]],
  [[4,4],[4,4]],
  [[0,5,5],[5,5,0],[0,0,0]],
  [[0,6,0],[6,6,6],[0,0,0]],
  [[7,7,0],[0,7,7],[0,0,0]],
];

const NAMES = ['', 'I', 'J', 'L', 'O', 'S', 'T', 'Z'];

type Piece = { matrix: number[][]; x: number; y: number; id: number; name: string };

function calcAttackLines(linesCleared: number, isTSpin: boolean, b2b: boolean, combo: number): number {
  let attack = 0;
  if (isTSpin) {
    attack = [0, 2, 4, 6][linesCleared] ?? 0;
  } else {
    attack = [0, 0, 1, 2, 4][linesCleared] ?? 0;
  }
  if (b2b && (linesCleared === 4 || (isTSpin && linesCleared > 0))) attack += 1;
  // combo bonus: 0-combo=0, 1=0, 2=1, 3=1, 4=2...
  const comboBonus = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  if (combo >= 1) attack += comboBonus[Math.min(combo, 11)];
  return attack;
}

function createEngine(boardX: number, onGameOver: () => void, onAttack: (lines: number) => void) {
  const eng = {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    piece: null as Piece | null,
    nextQueue: [] as number[],
    holdId: 0,
    canHold: true,
    bag: [] as number[],
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    b2b: false,
    lastMoveRotate: false,
    dropTimer: 0,
    lockDelayTimer: 0,
    pendingGarbage: 0,
    dead: false,
    boardX,

    getNextBagPiece(): number {
      if (this.bag.length === 0) {
        this.bag = [1,2,3,4,5,6,7].sort(() => Math.random() - 0.5);
      }
      return this.bag.pop()!;
    },

    init() {
      this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      this.score = 0; this.level = 1; this.lines = 0;
      this.combo = -1; this.b2b = false;
      this.holdId = 0; this.canHold = true;
      this.nextQueue = []; this.bag = [];
      this.pendingGarbage = 0; this.dead = false;
      this.dropTimer = 0; this.lockDelayTimer = 0;
      for (let i = 0; i < 5; i++) this.nextQueue.push(this.getNextBagPiece());
      this.spawnPiece();
    },

    spawnPiece(id?: number) {
      // Apply pending garbage before spawning
      if (this.pendingGarbage > 0) {
        this.applyGarbage(this.pendingGarbage);
        this.pendingGarbage = 0;
      }
      const spawnId = id ?? (() => {
        const next = this.nextQueue.shift()!;
        this.nextQueue.push(this.getNextBagPiece());
        return next;
      })();
      this.piece = {
        matrix: SHAPES[spawnId].map(r => [...r]),
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[spawnId][0].length / 2),
        y: 0,
        id: spawnId,
        name: NAMES[spawnId],
      };
      this.lastMoveRotate = false;
      this.dropTimer = 0;
      this.lockDelayTimer = 0;
      if (this.checkCollision(0, 0, this.piece.matrix)) {
        this.dead = true;
        onGameOver();
      }
    },

    applyGarbage(lines: number) {
      const hole = Math.floor(Math.random() * COLS);
      for (let i = 0; i < lines; i++) {
        this.board.shift();
        const garbageLine = Array(COLS).fill(8); // 8 = gray garbage color (using index, COLORS[8] below)
        garbageLine[hole] = 0;
        this.board.push(garbageLine);
      }
    },

    checkCollision(dx: number, dy: number, matrix: number[][]): boolean {
      if (!this.piece) return true;
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (matrix[y][x] !== 0) {
            const nx = this.piece.x + x + dx;
            const ny = this.piece.y + y + dy;
            if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && this.board[ny][nx] !== 0)) {
              return true;
            }
          }
        }
      }
      return false;
    },

    move(dx: number, dy: number): boolean {
      if (!this.piece || this.dead) return false;
      if (!this.checkCollision(dx, dy, this.piece.matrix)) {
        this.piece.x += dx;
        this.piece.y += dy;
        if (dy === 0) {
          this.lastMoveRotate = false;
          this.lockDelayTimer = 0;
        }
        return true;
      }
      return false;
    },

    rotateMatrix(matrix: number[][]): number[][] {
      const N = matrix.length;
      const res = Array.from({ length: N }, () => Array(N).fill(0));
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          res[x][N - 1 - y] = matrix[y][x];
        }
      }
      return res;
    },

    rotate() {
      if (!this.piece || this.dead) return;
      const rotated = this.rotateMatrix(this.piece.matrix);
      const kicks = [[0,0], [-1,0], [1,0], [0,-1], [-2,0], [2,0]];
      for (const [kx, ky] of kicks) {
        if (!this.checkCollision(kx, ky, rotated)) {
          this.piece.matrix = rotated;
          this.piece.x += kx;
          this.piece.y += ky;
          this.lastMoveRotate = true;
          this.lockDelayTimer = 0;
          return;
        }
      }
    },

    getGhostY(): number {
      if (!this.piece) return 0;
      let gy = this.piece.y;
      while (!this.checkCollision(0, gy - this.piece.y + 1, this.piece.matrix)) gy++;
      return gy;
    },

    hardDrop() {
      if (!this.piece || this.dead) return;
      let dist = 0;
      while (!this.checkCollision(0, 1, this.piece.matrix)) {
        this.piece.y++;
        dist++;
      }
      this.score += dist * 2;
      this.lastMoveRotate = false;
      this.lockPiece();
    },

    hold() {
      if (!this.canHold || !this.piece || this.dead) return;
      const currentId = this.piece.id;
      if (this.holdId === 0) {
        this.holdId = currentId;
        this.spawnPiece();
      } else {
        const temp = this.holdId;
        this.holdId = currentId;
        this.spawnPiece(temp);
      }
      this.canHold = false;
    },

    checkTSpin(): boolean {
      if (!this.piece || this.piece.name !== 'T' || !this.lastMoveRotate) return false;
      const cx = this.piece.x + 1;
      const cy = this.piece.y + 1;
      const corners = [[cx-1, cy-1],[cx+1, cy-1],[cx-1, cy+1],[cx+1, cy+1]];
      let filled = 0;
      for (const [nx, ny] of corners) {
        if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && this.board[ny][nx] > 0)) filled++;
      }
      return filled >= 3;
    },

    lockPiece() {
      if (!this.piece) return;
      const isTSpin = this.checkTSpin();

      for (let y = 0; y < this.piece.matrix.length; y++) {
        for (let x = 0; x < this.piece.matrix[y].length; x++) {
          if (this.piece.matrix[y][x] !== 0) {
            const ny = this.piece.y + y;
            const nx = this.piece.x + x;
            if (ny >= 0) this.board[ny][nx] = this.piece.id;
          }
        }
      }

      let linesCleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.board[y].every(v => v !== 0)) {
          linesCleared++;
          this.board.splice(y, 1);
          this.board.unshift(Array(COLS).fill(0));
          y++;
        }
      }

      this.handleScore(linesCleared, isTSpin, onAttack);
      this.canHold = true;
      this.spawnPiece();
    },

    handleScore(linesCleared: number, isTSpin: boolean, attack: (lines: number) => void) {
      if (linesCleared > 0) this.combo++;
      else this.combo = -1;

      const isTetris = linesCleared === 4;
      const isDifficult = isTetris || (isTSpin && linesCleared > 0);

      let baseScore = 0;
      if (isTSpin) {
        baseScore = [400, 800, 1200, 1600][linesCleared] * this.level;
      } else if (linesCleared > 0) {
        baseScore = [0, 100, 300, 500, 800][linesCleared] * this.level;
      }

      if (isDifficult && this.b2b) baseScore = Math.floor(baseScore * 1.5);
      if (isDifficult) this.b2b = true;
      else if (linesCleared > 0) this.b2b = false;

      if (this.combo > 0) baseScore += this.combo * 50 * this.level;
      this.score += baseScore;

      if (linesCleared > 0) {
        this.lines += linesCleared;
        this.level = Math.floor(this.lines / 10) + 1;
        const attackLines = calcAttackLines(linesCleared, isTSpin, this.b2b && isDifficult, this.combo);
        if (attackLines > 0) attack(attackLines);
      }
    },

    update(dt: number) {
      if (this.dead) return;
      this.dropTimer += dt;
      const dropInterval = Math.max(50, 800 * Math.pow(0.85, this.level - 1));
      if (this.piece) {
        const isBottom = this.checkCollision(0, 1, this.piece.matrix);
        if (isBottom) {
          this.lockDelayTimer += dt;
          if (this.lockDelayTimer >= 500 || this.dropTimer > 2000) {
            this.lockPiece();
          }
        } else {
          if (this.dropTimer >= dropInterval) {
            this.move(0, 1);
            this.dropTimer = 0;
          }
        }
      }
    },

    addPendingGarbage(lines: number) {
      // Cancel with outgoing attack queue (simple model: just add)
      this.pendingGarbage = Math.max(0, this.pendingGarbage + lines);
    },
  };

  return eng;
}

type Engine = ReturnType<typeof createEngine>;

// Add gray garbage color to COLORS lookup
const ALL_COLORS = [...COLORS, '#555566']; // index 8 = garbage gray

function drawBlock(ctx: CanvasRenderingContext2D, px: number, py: number, id: number, ghost = false) {
  if (id === 0) return;
  const color = ALL_COLORS[id] ?? '#888';
  ctx.save();
  ctx.translate(px, py);
  if (ghost) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, BS - 2, BS - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(1, 1, BS - 2, BS - 2);
  } else {
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(1, 1, BS - 2, BS - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(3, 3, BS - 6, BS - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(2, 2, BS - 4, 2);
  }
  ctx.restore();
}

function drawMiniPiece(ctx: CanvasRenderingContext2D, cx: number, cy: number, id: number) {
  if (!id) return;
  const m = SHAPES[id];
  const ms = 12;
  const ox = cx - (m[0].length * ms) / 2;
  const oy = cy - (m.length * ms) / 2;
  const c = COLORS[id];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) {
        ctx.shadowBlur = 6; ctx.shadowColor = c; ctx.fillStyle = c;
        ctx.fillRect(ox + x * ms + 1, oy + y * ms + 1, ms - 2, ms - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(ox + x * ms + 3, oy + y * ms + 3, ms - 6, ms - 6);
      }
    }
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, eng: Engine, bx: number) {
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(bx, BOARD_Y, BOARD_W, BOARD_H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i <= COLS; i++) {
    ctx.moveTo(bx + i * BS, BOARD_Y);
    ctx.lineTo(bx + i * BS, BOARD_Y + BOARD_H);
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.moveTo(bx, BOARD_Y + i * BS);
    ctx.lineTo(bx + BOARD_W, BOARD_Y + i * BS);
  }
  ctx.stroke();

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, BOARD_Y, BOARD_W, BOARD_H);

  // Placed blocks
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (eng.board[y][x]) {
        drawBlock(ctx, bx + x * BS, BOARD_Y + y * BS, eng.board[y][x]);
      }
    }
  }

  // Ghost + active piece
  if (eng.piece) {
    const gy = eng.getGhostY();
    for (let y = 0; y < eng.piece.matrix.length; y++) {
      for (let x = 0; x < eng.piece.matrix[y].length; x++) {
        if (eng.piece.matrix[y][x]) {
          drawBlock(ctx, bx + (eng.piece.x + x) * BS, BOARD_Y + (gy + y) * BS, eng.piece.id, true);
          drawBlock(ctx, bx + (eng.piece.x + x) * BS, BOARD_Y + (eng.piece.y + y) * BS, eng.piece.id);
        }
      }
    }
  }
}

function drawSidePanelLeft(ctx: CanvasRenderingContext2D, eng: Engine) {
  const panelX = 5;
  // Hold box
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.fillRect(panelX, BOARD_Y, 95, 70);
  ctx.strokeRect(panelX, BOARD_Y, 95, 70);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HOLD', panelX + 47, BOARD_Y + 13);
  if (eng.holdId) drawMiniPiece(ctx, panelX + 47, BOARD_Y + 43, eng.holdId);

  // Stats box
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(panelX, BOARD_Y + 80, 95, 150);
  ctx.strokeRect(panelX, BOARD_Y + 80, 95, 150);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAYER 2', panelX + 47, BOARD_Y + 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('SCORE', panelX + 8, BOARD_Y + 118);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.score.toString().padStart(6,'0'), panelX + 8, BOARD_Y + 132);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('LEVEL', panelX + 8, BOARD_Y + 152);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.level.toString().padStart(2,'0'), panelX + 8, BOARD_Y + 166);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('LINES', panelX + 8, BOARD_Y + 186);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.lines.toString(), panelX + 8, BOARD_Y + 200);

  // Keys hint
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A W D S', panelX + 47, BOARD_Y + 250);
  ctx.fillText('LShift=Drop Q=Hold', panelX + 47, BOARD_Y + 263);
}

function drawSidePanelRight(ctx: CanvasRenderingContext2D, eng: Engine) {
  const panelX = P2_BOARD_X + BOARD_W + 5;
  // Next box
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.fillRect(panelX, BOARD_Y, 95, 200);
  ctx.strokeRect(panelX, BOARD_Y, 95, 200);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', panelX + 47, BOARD_Y + 13);
  for (let i = 0; i < Math.min(eng.nextQueue.length, 3); i++) {
    drawMiniPiece(ctx, panelX + 47, BOARD_Y + 40 + i * 55, eng.nextQueue[i]);
  }

  // Stats box
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(panelX, BOARD_Y + 210, 95, 150);
  ctx.strokeRect(panelX, BOARD_Y + 210, 95, 150);
  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAYER 1', panelX + 47, BOARD_Y + 226);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('SCORE', panelX + 8, BOARD_Y + 248);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.score.toString().padStart(6,'0'), panelX + 8, BOARD_Y + 262);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('LEVEL', panelX + 8, BOARD_Y + 282);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.level.toString().padStart(2,'0'), panelX + 8, BOARD_Y + 296);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px Orbitron, monospace';
  ctx.fillText('LINES', panelX + 8, BOARD_Y + 316);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(eng.lines.toString(), panelX + 8, BOARD_Y + 330);

  // Keys hint
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('← ↑ → ↓', panelX + 47, BOARD_Y + 380);
  ctx.fillText('SPACE=Drop C=Hold', panelX + 47, BOARD_Y + 393);
}

// Next queue for P1 is right of P1 board; hold for P2 is left of P2 board
function drawNextP1(ctx: CanvasRenderingContext2D, eng: Engine) {
  const panelX = P1_BOARD_X + BOARD_W + 5;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.fillRect(panelX, BOARD_Y, 80, 200);
  ctx.strokeRect(panelX, BOARD_Y, 80, 200);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', panelX + 40, BOARD_Y + 13);
  for (let i = 0; i < Math.min(eng.nextQueue.length, 3); i++) {
    drawMiniPiece(ctx, panelX + 40, BOARD_Y + 40 + i * 55, eng.nextQueue[i]);
  }
}

function drawHoldP2(ctx: CanvasRenderingContext2D, eng: Engine) {
  const panelX = P2_BOARD_X - 85;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.fillRect(panelX, BOARD_Y, 80, 70);
  ctx.strokeRect(panelX, BOARD_Y, 80, 70);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HOLD', panelX + 40, BOARD_Y + 13);
  if (eng.holdId) drawMiniPiece(ctx, panelX + 40, BOARD_Y + 43, eng.holdId);
}

function drawMiddlePanel(ctx: CanvasRenderingContext2D, pending1: number, pending2: number) {
  const mx = P1_BOARD_X + BOARD_W + 90; // center x of middle zone
  const midW = P2_BOARD_X - 85 - (P1_BOARD_X + BOARD_W + 90) + 40;
  // VS label
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = 'bold 22px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VS', mx + midW / 2, BOARD_Y + BOARD_H / 2);

  // P1 incoming garbage (shown as red blocks on P2 side indicator)
  // pending1 = lines queued to send to P2
  // pending2 = lines queued to send to P1
  const barX = mx + midW / 2 - 10;
  const blockH = 8;
  const gap = 2;

  // P2's incoming (P1 attacking P2): draw from bottom up on right of VS
  for (let i = 0; i < Math.min(pending1, 20); i++) {
    const alpha = Math.min(1, 0.4 + (i / 20) * 0.6);
    ctx.fillStyle = `rgba(239,68,68,${alpha})`;
    ctx.fillRect(barX + 15, BOARD_Y + BOARD_H - (i + 1) * (blockH + gap), 12, blockH);
  }

  // P1's incoming (P2 attacking P1): draw from bottom up on left of VS
  for (let i = 0; i < Math.min(pending2, 20); i++) {
    const alpha = Math.min(1, 0.4 + (i / 20) * 0.6);
    ctx.fillStyle = `rgba(239,68,68,${alpha})`;
    ctx.fillRect(barX - 12, BOARD_Y + BOARD_H - (i + 1) * (blockH + gap), 12, blockH);
  }
}

export default function TwoPlayerGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng1Ref = useRef<Engine | null>(null);
  const eng2Ref = useRef<Engine | null>(null);
  const gameStateRef = useRef<'playing' | 'paused' | 'gameover'>('playing');
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [displaySize, setDisplaySize] = useState({ w: CANVAS_W, h: CANVAS_H });

  useEffect(() => {
    const updateSize = () => {
      const ratio = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H);
      setDisplaySize({ w: Math.floor(CANVAS_W * ratio), h: Math.floor(CANVAS_H * ratio) });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let rafId: number;
    let lastTime = performance.now();

    // eng1 = left board = P2(WASD), eng2 = right board = P1(Arrow)
    const handleGameOver1 = () => {
      if (gameStateRef.current === 'gameover') return;
      gameStateRef.current = 'gameover';
      setWinner(1); // P2 died → P1 wins
    };
    const handleGameOver2 = () => {
      if (gameStateRef.current === 'gameover') return;
      gameStateRef.current = 'gameover';
      setWinner(2); // P1 died → P2 wins
    };

    const eng1 = createEngine(P1_BOARD_X, handleGameOver1, (lines) => {
      if (eng2Ref.current) eng2Ref.current.addPendingGarbage(lines);
    });
    const eng2 = createEngine(P2_BOARD_X, handleGameOver2, (lines) => {
      if (eng1Ref.current) eng1Ref.current.addPendingGarbage(lines);
    });

    eng1.init();
    eng2.init();
    eng1Ref.current = eng1;
    eng2Ref.current = eng2;

    function draw() {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Player labels
      ctx.font = 'bold 11px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f97316';
      ctx.fillText('P2', P1_BOARD_X + BOARD_W / 2, BOARD_Y - 10);
      ctx.fillStyle = '#ec4899';
      ctx.fillText('P1', P2_BOARD_X + BOARD_W / 2, BOARD_Y - 10);

      drawBoard(ctx, eng1, P1_BOARD_X);
      drawBoard(ctx, eng2, P2_BOARD_X);

      drawSidePanelLeft(ctx, eng1);
      drawNextP1(ctx, eng1);
      drawHoldP2(ctx, eng2);
      drawSidePanelRight(ctx, eng2);

      drawMiddlePanel(ctx, eng1.pendingGarbage, eng2.pendingGarbage);
    }

    function gameLoop(time: number) {
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      if (gameStateRef.current === 'playing') {
        eng1.update(dt);
        eng2.update(dt);
        draw();
      }
      rafId = requestAnimationFrame(gameLoop);
    }

    rafId = requestAnimationFrame(gameLoop);
    draw();

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng1 = eng1Ref.current;
      const eng2 = eng2Ref.current;

      // Pause toggle
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === 'playing') {
          gameStateRef.current = 'paused';
          setIsPaused(true);
        } else if (gameStateRef.current === 'paused') {
          gameStateRef.current = 'playing';
          setIsPaused(false);
        }
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      // Prevent scroll for P1 keys
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (!eng1 || !eng2) return;

      // P2: WASD → left board (eng1) — WASD is on the LEFT side of keyboard
      if (e.code === 'KeyA') eng1.move(-1, 0);
      else if (e.code === 'KeyD') eng1.move(1, 0);
      else if (e.code === 'KeyS') { eng1.move(0, 1); eng1.score += 1; }
      else if (e.code === 'KeyW') eng1.rotate();
      else if (e.code === 'ShiftLeft') { e.preventDefault(); eng1.hardDrop(); }
      else if (e.code === 'KeyQ') eng1.hold();

      // P1: Arrow keys → right board (eng2) — Arrow keys are on the RIGHT side of keyboard
      else if (e.code === 'ArrowLeft') eng2.move(-1, 0);
      else if (e.code === 'ArrowRight') eng2.move(1, 0);
      else if (e.code === 'ArrowDown') { eng2.move(0, 1); eng2.score += 1; }
      else if (e.code === 'ArrowUp' || e.code === 'KeyX') eng2.rotate();
      else if (e.code === 'Space') eng2.hardDrop();
      else if (e.code === 'KeyC') eng2.hold();
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const restart = () => {
    const eng1 = eng1Ref.current;
    const eng2 = eng2Ref.current;
    if (!eng1 || !eng2) return;
    gameStateRef.current = 'playing';
    setWinner(null);
    setIsPaused(false);
    eng1.init();
    eng2.init();
  };

  return (
    <div className="w-screen h-screen bg-[#020205] text-[#e0e0ff] flex items-center justify-center overflow-hidden select-none relative">
      {/* Glow background */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, #0a1a3a 0%, #020205 70%)' }} />

      {/* Canvas wrapper — size matches displayed canvas so overlays align */}
      <div className="relative z-10" style={{ width: displaySize.w, height: displaySize.h }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block rounded"
          style={{ width: displaySize.w, height: displaySize.h }}
        />

        {/* Paused overlay */}
        {isPaused && !winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl z-20">
            <h2 className="text-4xl font-bold text-cyan-400 mb-8 tracking-widest">PAUSED</h2>
            <div className="flex gap-4">
              <button
                onClick={() => { gameStateRef.current = 'playing'; setIsPaused(false); }}
                className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest"
              >
                RESUME
              </button>
              <button
                onClick={onExit}
                className="px-6 py-2 bg-transparent border border-white/40 text-white/60 font-bold rounded-full hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                MENU
              </button>
            </div>
            <p className="mt-4 text-white/30 text-xs">P: Resume / Esc: Resume</p>
          </div>
        )}

        {/* Game Over overlay */}
        {winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-2xl z-20">
            <div className={`text-6xl font-black tracking-tight mb-2 ${winner === 1 ? 'text-pink-400' : 'text-orange-400'}`}
              style={{ textShadow: `0 0 30px ${winner === 1 ? '#ec4899' : '#f97316'}` }}>
              P{winner} WINS!
            </div>
            <p className="text-white/40 text-sm mb-8 uppercase tracking-widest">
              {winner === 1 ? 'Player 1 stack overflow' : 'Player 2 stack overflow'}
            </p>
            <div className="flex gap-4">
              <button
                onClick={restart}
                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest"
              >
                REMATCH
              </button>
              <button
                onClick={onExit}
                className="px-8 py-3 bg-transparent border border-white/40 text-white/60 font-bold rounded-full hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                MENU
              </button>
            </div>
          </div>
        )}
      </div>{/* end canvas wrapper */}

      {/* Top right exit */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 z-50 p-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 text-xs px-3"
      >
        MENU
      </button>
    </div>
  );
}
