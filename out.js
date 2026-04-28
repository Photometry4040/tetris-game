import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ArrowLeft, ArrowRight, ArrowDown } from "lucide-react";
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const CANVAS_W = 640;
const CANVAS_H = 640;
const BOARD_X = 160;
const BOARD_Y = 0;
const COLORS = [
  "transparent",
  "#0abdc6",
  // Cyan I
  "#2563eb",
  // Blue J
  "#f97316",
  // Orange L
  "#ffd300",
  // Yellow O
  "#22c55e",
  // Green S
  "#a855f7",
  // Purple T
  "#ef4444"
  // Red Z
];
const SHAPES = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
  [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
  [[4, 4], [4, 4]],
  [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
  [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
  [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
];
const NAMES = ["", "I", "J", "L", "O", "S", "T", "Z"];
class AudioController {
  constructor() {
    this.ctx = null;
    this.bgmVolume = null;
    this.sfxVolume = null;
    this.isPlaying = false;
    this.step = 0;
    this.seq = 0;
    this.nextNoteTime = 0;
    this.rafId = null;
    // D minor pentatonic cyberpunk bass pattern
    this.bassPattern = [
      [38, -1, 38, 38, -1, 41, 45, -1],
      // D2, F2, A2
      [38, -1, 38, 38, -1, 36, 43, -1],
      // D2, C2, G2
      [38, -1, 38, 38, -1, 41, 45, -1],
      [48, -1, 45, 41, 38, -1, -1, -1]
    ];
    this.schedule = () => {
      if (!this.ctx || !this.isPlaying) return;
      const tempo = 125;
      const secondsPerBeat = 60 / tempo;
      const rate = secondsPerBeat / 4;
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        const note = this.bassPattern[this.seq][this.step];
        this.playBass(note, this.nextNoteTime);
        if (this.step % 2 !== 0) this.playNoise(this.nextNoteTime, 0.05, 0.15);
        if (this.step % 4 === 0) this.playKick(this.nextNoteTime);
        this.step++;
        if (this.step >= this.bassPattern[0].length) {
          this.step = 0;
          this.seq = (this.seq + 1) % this.bassPattern.length;
        }
        this.nextNoteTime += rate;
      }
      this.rafId = requestAnimationFrame(this.schedule);
    };
  }
  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.bgmVolume = this.ctx.createGain();
    this.bgmVolume.gain.value = 0.2;
    this.bgmVolume.connect(this.ctx.destination);
    this.sfxVolume = this.ctx.createGain();
    this.sfxVolume.gain.value = 0.5;
    this.sfxVolume.connect(this.ctx.destination);
  }
  playBass(note, time) {
    if (!this.ctx || !this.bgmVolume || note === -1) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    osc.frequency.setValueAtTime(freq, time);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(150, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(150, time + 0.2);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(1, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.bgmVolume);
    osc.start(time);
    osc.stop(time + 0.3);
  }
  playNoise(time, duration, vol) {
    if (!this.ctx || !this.bgmVolume) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, time);
    env.gain.exponentialRampToValueAtTime(0.01, time + duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7e3;
    noise.connect(filter);
    filter.connect(env);
    env.connect(this.bgmVolume);
    noise.start(time);
  }
  playKick(time) {
    if (!this.ctx || !this.bgmVolume) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
    env.gain.setValueAtTime(0.6, time);
    env.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    osc.connect(env);
    env.connect(this.bgmVolume);
    osc.start(time);
    osc.stop(time + 0.3);
  }
  startMusic() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.schedule();
    }
  }
  stopMusic() {
    this.isPlaying = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
  playSfxClearLine(tetris = false) {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554.37, t + 0.1);
    if (tetris) {
      osc.frequency.setValueAtTime(659.25, t + 0.2);
      osc.frequency.setValueAtTime(880, t + 0.3);
    }
    const duration = tetris ? 0.6 : 0.3;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.3, t + 0.05);
    env.gain.setValueAtTime(0.3, t + duration - 0.2);
    env.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.connect(env);
    env.connect(this.sfxVolume);
    osc.start(t);
    osc.stop(t + duration);
  }
  playSfxDrop() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(env);
    env.connect(this.sfxVolume);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}
const audioController = new AudioController();
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 15;
    this.vy = (Math.random() - 0.5) * 15;
    this.maxLife = 20 + Math.random() * 20;
    this.life = this.maxLife;
    this.size = Math.random() * 4 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}
class FloatingText {
  constructor(text, x, y, color = "#fff", size = 20) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.maxLife = 60;
    this.life = this.maxLife;
  }
  update() {
    this.y -= 1;
    this.life--;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.font = `bold ${this.size}px sans-serif`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
export default function App() {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState("menu");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const engineRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let rafId;
    let lastTime = performance.now();
    const engine = {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: null,
      nextQueue: [],
      holdId: 0,
      canHold: true,
      bag: [],
      particles: [],
      texts: [],
      dropTimer: 0,
      dropInterval: 800,
      lockDelayTimer: 0,
      score: 0,
      level: 1,
      lines: 0,
      combo: -1,
      b2b: false,
      lastMoveRotate: false,
      state: "menu",
      init() {
        this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.combo = -1;
        this.b2b = false;
        this.holdId = 0;
        this.canHold = true;
        this.nextQueue = [];
        this.bag = [];
        this.particles = [];
        this.texts = [];
        for (let i = 0; i < 5; i++) this.nextQueue.push(this.getNextBagPiece());
        this.spawnPiece();
        this.dropInterval = 800;
        this.state = "playing";
        syncReactState();
        audioController.startMusic();
      },
      getNextBagPiece() {
        if (this.bag.length === 0) {
          this.bag = [1, 2, 3, 4, 5, 6, 7];
          this.bag.sort(() => Math.random() - 0.5);
        }
        return this.bag.pop();
      },
      spawnPiece(id) {
        let spawnId = id;
        if (!spawnId) {
          spawnId = this.nextQueue.shift();
          this.nextQueue.push(this.getNextBagPiece());
        }
        this.piece = {
          matrix: SHAPES[spawnId].map((r) => [...r]),
          x: Math.floor(COLS / 2) - Math.floor(SHAPES[spawnId][0].length / 2),
          y: 0,
          id: spawnId,
          name: NAMES[spawnId]
        };
        this.lastMoveRotate = false;
        this.dropTimer = 0;
        this.lockDelayTimer = 0;
        if (this.checkCollision(0, 0, this.piece.matrix)) {
          this.state = "gameover";
          audioController.stopMusic();
          setGameState("gameover");
        }
      },
      hold() {
        if (!this.canHold || !this.piece) return;
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
      rotateMatrix(matrix) {
        const N = matrix.length;
        const res = Array.from({ length: N }, () => Array(N).fill(0));
        for (let y = 0; y < N; ++y) {
          for (let x = 0; x < N; ++x) {
            res[x][N - 1 - y] = matrix[y][x];
          }
        }
        return res;
      },
      checkCollision(dx, dy, matrix) {
        if (!this.piece) return true;
        for (let y = 0; y < matrix.length; y++) {
          for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
              const nx = this.piece.x + x + dx;
              const ny = this.piece.y + y + dy;
              if (nx < 0 || nx >= COLS || ny >= ROWS || ny >= 0 && this.board[ny][nx] !== 0) {
                return true;
              }
            }
          }
        }
        return false;
      },
      move(dx, dy) {
        if (!this.piece || this.state !== "playing") return false;
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
      rotate() {
        if (!this.piece || this.state !== "playing") return;
        const rotated = this.rotateMatrix(this.piece.matrix);
        const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
        for (let [kx, ky] of kicks) {
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
      hardDrop() {
        if (!this.piece || this.state !== "playing") return;
        let dist = 0;
        while (!this.checkCollision(0, 1, this.piece.matrix)) {
          this.piece.y++;
          dist++;
        }
        this.score += dist * 2;
        this.lastMoveRotate = false;
        audioController.playSfxDrop();
        this.lockPiece();
      },
      getGhostY() {
        if (!this.piece) return 0;
        let gy = this.piece.y;
        while (!this.checkCollision(0, gy - this.piece.y + 1, this.piece.matrix)) {
          gy++;
        }
        return gy;
      },
      checkTSpin() {
        if (!this.piece || this.piece.name !== "T" || !this.lastMoveRotate) return false;
        const cx = this.piece.x + 1;
        const cy = this.piece.y + 1;
        const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]];
        let filled = 0;
        for (let [nx, ny] of corners) {
          if (nx < 0 || nx >= COLS || ny >= ROWS || ny >= 0 && this.board[ny][nx] > 0) filled++;
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
          if (this.board[y].every((v) => v !== 0)) {
            linesCleared++;
            for (let x = 0; x < COLS; x++) {
              for (let i = 0; i < 4; i++) {
                this.particles.push(new Particle(BOARD_X + x * BLOCK_SIZE + 16, BOARD_Y + y * BLOCK_SIZE + 16, COLORS[this.board[y][x]]));
              }
            }
            this.board.splice(y, 1);
            this.board.unshift(Array(COLS).fill(0));
            y++;
          }
        }
        this.handleScore(linesCleared, isTSpin);
        this.canHold = true;
        this.spawnPiece();
        syncReactState();
      },
      handleScore(linesCleared, isTSpin) {
        if (linesCleared > 0) this.combo++;
        else this.combo = -1;
        const isTetris = linesCleared === 4;
        let baseScore = 0;
        let alertText = "";
        if (isTSpin) {
          const names = ["T-Spin!", "T-Spin Single!", "T-Spin Double!", "T-Spin Triple!"];
          alertText = names[linesCleared];
          baseScore = (linesCleared === 0 ? 400 : linesCleared === 1 ? 800 : linesCleared === 2 ? 1200 : 1600) * this.level;
          this.texts.push(new FloatingText(alertText, BOARD_X + 160, BOARD_Y + 320, "#a855f7", 30));
        } else if (linesCleared > 0) {
          const names = ["", "Single", "Double", "Triple", "TETRIS!"];
          if (isTetris) {
            alertText = "TETRIS!";
            this.texts.push(new FloatingText(alertText, BOARD_X + 160, BOARD_Y + 320, "#02b8cc", 32));
          }
          baseScore = (linesCleared === 1 ? 100 : linesCleared === 2 ? 300 : linesCleared === 3 ? 500 : 800) * this.level;
        }
        if (linesCleared > 0) {
          audioController.playSfxClearLine(isTetris);
        }
        const isDifficult = isTetris || isTSpin && linesCleared > 0;
        if (isDifficult) {
          if (this.b2b) {
            baseScore = Math.floor(baseScore * 1.5);
            this.texts.push(new FloatingText("Back-to-Back!", BOARD_X + 160, BOARD_Y + 280, "#f97316", 24));
          }
          this.b2b = true;
        } else if (linesCleared > 0) {
          this.b2b = false;
        }
        if (this.combo > 0) {
          baseScore += this.combo * 50 * this.level;
          this.texts.push(new FloatingText(`Combo ${this.combo}`, BOARD_X + 160, BOARD_Y + 240, "#ffd300", 20));
        }
        this.score += baseScore;
        if (linesCleared > 0) {
          this.lines += linesCleared;
          this.level = Math.floor(this.lines / 10) + 1;
          this.dropInterval = Math.max(100, 800 - (this.level - 1) * 50);
        }
      },
      update(dt) {
        if (this.state !== "playing") return;
        this.dropTimer += dt;
        if (this.piece) {
          const isBottom = this.checkCollision(0, 1, this.piece.matrix);
          if (isBottom) {
            this.lockDelayTimer += dt;
            if (this.lockDelayTimer >= 500 || this.dropTimer > 2e3) {
              this.lockPiece();
            }
          } else {
            if (this.dropTimer >= this.dropInterval) {
              this.move(0, 1);
              this.dropTimer = 0;
            }
          }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].update();
          if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
          this.texts[i].update();
          if (this.texts[i].life <= 0) this.texts.splice(i, 1);
        }
      },
      drawBlock(x, y, id, alpha = 1, isGhost = false) {
        if (id === 0) return;
        const color = COLORS[id];
        ctx.save();
        ctx.translate(x, y);
        if (isGhost) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.strokeRect(2, 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(2, 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        } else {
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.fillRect(1, 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(4, 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(2, 2, BLOCK_SIZE - 4, 3);
        }
        ctx.restore();
      },
      drawMiniPiece(px, py, id) {
        if (!id) return;
        const m = SHAPES[id];
        const bs = 24;
        const offsetX = px - m[0].length * bs / 2;
        const offsetY = py - m.length * bs / 2;
        for (let y = 0; y < m.length; y++) {
          for (let x = 0; x < m[y].length; x++) {
            if (m[y][x]) {
              const bx = offsetX + x * bs;
              const by = offsetY + y * bs;
              const c = COLORS[id];
              ctx.shadowBlur = 10;
              ctx.shadowColor = c;
              ctx.fillStyle = c;
              ctx.fillRect(bx + 1, by + 1, bs - 2, bs - 2);
              ctx.shadowBlur = 0;
              ctx.fillStyle = "rgba(0,0,0,0.5)";
              ctx.fillRect(bx + 3, by + 3, bs - 6, bs - 6);
            }
          }
        }
      },
      draw() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= COLS; i++) {
          ctx.moveTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y);
          ctx.lineTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y + ROWS * BLOCK_SIZE);
        }
        for (let i = 0; i <= ROWS; i++) {
          ctx.moveTo(BOARD_X, BOARD_Y + i * BLOCK_SIZE);
          ctx.lineTo(BOARD_X + COLS * BLOCK_SIZE, BOARD_Y + i * BLOCK_SIZE);
        }
        ctx.stroke();
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (this.board[y][x]) {
              this.drawBlock(BOARD_X + x * BLOCK_SIZE, BOARD_Y + y * BLOCK_SIZE, this.board[y][x]);
            }
          }
        }
        if (this.piece) {
          const gy = this.getGhostY();
          for (let y = 0; y < this.piece.matrix.length; y++) {
            for (let x = 0; x < this.piece.matrix[y].length; x++) {
              if (this.piece.matrix[y][x]) {
                this.drawBlock(BOARD_X + (this.piece.x + x) * BLOCK_SIZE, BOARD_Y + (gy + y) * BLOCK_SIZE, this.piece.id, 1, true);
                this.drawBlock(BOARD_X + (this.piece.x + x) * BLOCK_SIZE, BOARD_Y + (this.piece.y + y) * BLOCK_SIZE, this.piece.id);
              }
            }
          }
        }
        ctx.font = "bold 12px Orbitron";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.fillRect(20, 20, 120, 120);
        ctx.strokeRect(20, 20, 120, 120);
        ctx.fillRect(CANVAS_W - 140, 20, 120, 360);
        ctx.strokeRect(CANVAS_W - 140, 20, 120, 360);
        ctx.fillStyle = "#22d3ee";
        ctx.fillText("HOLD PIECE", 80, 45);
        ctx.fillStyle = "#22d3ee";
        ctx.fillText("NEXT QUEUE", CANVAS_W - 80, 45);
        if (this.holdId) this.drawMiniPiece(80, 90, this.holdId);
        else if (!this.canHold) ctx.globalAlpha = 0.3;
        for (let i = 0; i < this.nextQueue.length; i++) {
          this.drawMiniPiece(CANVAS_W - 80, 90 + i * 70, this.nextQueue[i]);
        }
        ctx.fillRect(20, 160, 120, 240);
        ctx.strokeRect(20, 160, 120, 240);
        ctx.textAlign = "left";
        ctx.fillStyle = "#ec4899";
        ctx.font = "bold 12px Orbitron";
        ctx.fillText("STATISTICS", 35, 190);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "12px Orbitron";
        ctx.fillText("SCORE", 35, 230);
        ctx.fillStyle = "#ffffff";
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.score.toString().padStart(6, "0"), 35, 255);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "12px Orbitron";
        ctx.fillText("LEVEL", 35, 300);
        ctx.fillStyle = "#ffffff";
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.level.toString().padStart(2, "0"), 35, 325);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "12px Orbitron";
        ctx.fillText("LINES", 35, 370);
        ctx.fillStyle = "#ffffff";
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.lines.toString(), 35, 395);
        ctx.textAlign = "center";
        this.particles.forEach((p) => p.draw(ctx));
        this.texts.forEach((t) => t.draw(ctx));
      }
    };
    engineRef.current = engine;
    const syncReactState = () => {
      setScore(engine.score);
      setLevel(engine.level);
      setLines(engine.lines);
    };
    function gameLoop(time) {
      const dt = time - lastTime;
      lastTime = time;
      engine.update(dt);
      engine.draw();
      rafId = requestAnimationFrame(gameLoop);
    }
    rafId = requestAnimationFrame(gameLoop);
    engine.draw();
    return () => cancelAnimationFrame(rafId);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      const eng = engineRef.current;
      if (!eng || eng.state !== "playing") return;
      switch (e.code) {
        case "ArrowLeft":
          eng.move(-1, 0);
          break;
        case "ArrowRight":
          eng.move(1, 0);
          break;
        case "ArrowDown":
          eng.move(0, 1);
          eng.score += 1;
          syncReactUI();
          break;
        case "ArrowUp":
        case "KeyX":
          eng.rotate();
          break;
        case "Space":
          eng.hardDrop();
          break;
        case "KeyC":
          eng.hold();
          break;
        case "KeyP":
          togglePause();
          break;
      }
    };
    const handleKeyUp = (e) => {
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  const syncReactUI = () => {
    if (engineRef.current) {
      setScore(engineRef.current.score);
      setLevel(engineRef.current.level);
      setLines(engineRef.current.lines);
    }
  };
  const startGame = () => {
    if (engineRef.current) engineRef.current.init();
    setGameState("playing");
  };
  const togglePause = () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.state === "playing") {
      eng.state = "paused";
      audioController.stopMusic();
      setGameState("paused");
    } else if (eng.state === "paused") {
      eng.state = "playing";
      audioController.startMusic();
      setGameState("playing");
    }
  };
  const touchState = useRef({ x: 0, y: 0, swiped: false });
  const handleTouchStart = (e) => {
    if (gameState !== "playing") return;
    touchState.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, swiped: false };
  };
  const handleTouchMove = (e) => {
    if (gameState !== "playing") return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchState.current.x;
    const dy = e.touches[0].clientY - touchState.current.y;
    if (Math.abs(dx) > 40) {
      engineRef.current?.move(dx > 0 ? 1 : -1, 0);
      touchState.current.x = e.touches[0].clientX;
      touchState.current.swiped = true;
    }
  };
  const handleTouchEnd = (e) => {
    if (gameState !== "playing") return;
    const dx = e.changedTouches[0].clientX - touchState.current.x;
    const dy = e.changedTouches[0].clientY - touchState.current.y;
    if (!touchState.current.swiped) {
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        engineRef.current?.rotate();
      } else if (dy > 40) {
        engineRef.current?.hardDrop();
      } else if (dy < -40) {
        engineRef.current?.hold();
      }
    } else {
      if (dy > 60) engineRef.current?.hardDrop();
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative w-full h-screen bg-[#020205] text-[#e0e0ff] flex flex-col items-center justify-center overflow-hidden font-sans select-none touch-none", children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#020205_100%)] opacity-50 pointer-events-none" }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "relative z-10 p-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl h-[600px]",
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        children: /* @__PURE__ */ jsxs("div", { className: "relative p-1 bg-white/5 border border-white/20 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] h-full", children: [
          /* @__PURE__ */ jsx(
            "canvas",
            {
              ref: canvasRef,
              width: CANVAS_W,
              height: CANVAS_H,
              className: "bg-[#05050a] block max-w-full h-full object-contain rounded"
            }
          ),
          gameState === "menu" && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20", children: [
            /* @__PURE__ */ jsx("h1", { className: "text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 mb-8", children: "NEON TETRIS" }),
            /* @__PURE__ */ jsx("p", { className: "text-white/50 mb-8 tracking-widest text-sm uppercase", children: "Neon Protocol" }),
            /* @__PURE__ */ jsx("button", { onClick: startGame, className: "px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest", children: "START GAME" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-8 grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-white/50 uppercase", children: [
              /* @__PURE__ */ jsx("div", { className: "text-right", children: "Move" }),
              /* @__PURE__ */ jsx("div", { className: "text-cyan-400", children: "Arrow Keys" }),
              /* @__PURE__ */ jsx("div", { className: "text-right", children: "Soft Drop" }),
              /* @__PURE__ */ jsx("div", { className: "text-cyan-400", children: "Arrow Down" }),
              /* @__PURE__ */ jsx("div", { className: "text-right", children: "Hard Drop" }),
              /* @__PURE__ */ jsx("div", { className: "text-cyan-400", children: "Space" }),
              /* @__PURE__ */ jsx("div", { className: "text-right", children: "Rotate" }),
              /* @__PURE__ */ jsx("div", { className: "text-cyan-400", children: "Up / X" }),
              /* @__PURE__ */ jsx("div", { className: "text-right", children: "Hold" }),
              /* @__PURE__ */ jsx("div", { className: "text-cyan-400", children: "C Key" })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-white/50 text-[10px] text-center w-full uppercase", children: "Mobile: Swipe L/R to move, Up to Hold, Down to Drop. Tap to Rotate." })
          ] }),
          gameState === "paused" && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-4xl font-bold text-cyan-400 mb-8 tracking-widest uppercase", children: "PAUSED" }),
            /* @__PURE__ */ jsxs("button", { onClick: togglePause, className: "px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(Play, { fill: "currentColor" }),
              " RESUME"
            ] })
          ] }),
          gameState === "gameover" && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 mb-4 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]", children: "SYSTEM FAILURE" }),
            /* @__PURE__ */ jsxs("div", { className: "text-center mb-8 uppercase text-[10px] tracking-widest text-white/50", children: [
              /* @__PURE__ */ jsxs("p", { className: "text-xl mb-2 text-white", children: [
                "FINAL SCORE: ",
                /* @__PURE__ */ jsx("span", { className: "font-bold text-pink-500", children: score })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "", children: [
                "LEVEL REACHED: ",
                level
              ] })
            ] }),
            /* @__PURE__ */ jsxs("button", { onClick: startGame, className: "px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-pink-500 transition-colors uppercase tracking-widest flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(RotateCcw, { size: 16 }),
              " REBOOT SYSTEM"
            ] })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "md:hidden w-full max-w-[320px] mt-6 grid grid-cols-3 gap-2 opacity-60", children: [
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700", onClick: () => engineRef.current?.move(-1, 0), children: /* @__PURE__ */ jsx(ArrowLeft, {}) }),
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700", onClick: () => engineRef.current?.rotate(), children: /* @__PURE__ */ jsx(RotateCcw, {}) }),
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700", onClick: () => engineRef.current?.move(1, 0), children: /* @__PURE__ */ jsx(ArrowRight, {}) }),
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700", onClick: () => engineRef.current?.hold(), children: "Hold" }),
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700", onClick: () => engineRef.current?.move(0, 1), children: /* @__PURE__ */ jsx(ArrowDown, {}) }),
      /* @__PURE__ */ jsx("button", { className: "bg-slate-800 p-4 rounded-lg flex justify-center active:bg-slate-700 font-bold text-cyan-400", onClick: () => engineRef.current?.hardDrop(), children: "DROP" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "absolute top-4 right-4 z-50", children: gameState === "playing" && /* @__PURE__ */ jsx("button", { onClick: togglePause, className: "p-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 transition", children: /* @__PURE__ */ jsx(Pause, { size: 20 }) }) })
  ] });
}
