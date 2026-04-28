import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, ArrowLeft, ArrowRight, ArrowDown, Volume2, VolumeX } from 'lucide-react';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 32;
const CANVAS_W = 640;
const CANVAS_H = 640;
const BOARD_X = 160;
const BOARD_Y = 0;

const COLORS = [
  'transparent',
  '#0abdc6', // Cyan I
  '#2563eb', // Blue J
  '#f97316', // Orange L
  '#ffd300', // Yellow O
  '#22c55e', // Green S
  '#a855f7', // Purple T
  '#ef4444'  // Red Z
];

const SHAPES = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,0,0],[2,2,2],[0,0,0]],
  [[0,0,3],[3,3,3],[0,0,0]],
  [[4,4],[4,4]],
  [[0,5,5],[5,5,0],[0,0,0]],
  [[0,6,0],[6,6,6],[0,0,0]],
  [[7,7,0],[0,7,7],[0,0,0]]
];

const NAMES = ['', 'I', 'J', 'L', 'O', 'S', 'T', 'Z'];

class AudioController {
  ctx: AudioContext | null = null;
  bgmVolume: GainNode | null = null;
  sfxVolume: GainNode | null = null;
  isPlaying = false;
  isMuted = false;
  
  step = 0;
  seq = 0;
  nextNoteTime = 0;
  rafId: number | null = null;
  
  // D minor pentatonic cyberpunk bass pattern
  bassPattern = [
    [38, -1, 38, 38, -1, 41, 45, -1], // D2, F2, A2
    [38, -1, 38, 38, -1, 36, 43, -1], // D2, C2, G2
    [38, -1, 38, 38, -1, 41, 45, -1],
    [48, -1, 45, 41, 38, -1, -1, -1],
  ];

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.bgmVolume && this.sfxVolume) {
      this.bgmVolume.gain.setValueAtTime(muted ? 0 : 0.2, this.ctx.currentTime);
      this.sfxVolume.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    
    this.bgmVolume = this.ctx.createGain();
    this.bgmVolume.gain.value = this.isMuted ? 0 : 0.2; 
    this.bgmVolume.connect(this.ctx.destination);
    
    this.sfxVolume = this.ctx.createGain();
    this.sfxVolume.gain.value = this.isMuted ? 0 : 0.5;
    this.sfxVolume.connect(this.ctx.destination);
  }

  playBass(note: number, time: number) {
    if (!this.ctx || !this.bgmVolume || note === -1) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
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

  playNoise(time: number, duration: number, vol: number) {
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
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    
    noise.connect(filter);
    filter.connect(env);
    env.connect(this.bgmVolume);
    
    noise.start(time);
  }

  playKick(time: number) {
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

  schedule = () => {
    if (!this.ctx || !this.isPlaying) return;
    const tempo = 125; 
    const secondsPerBeat = 60.0 / tempo;
    const rate = secondsPerBeat / 4; 
    
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      const note = this.bassPattern[this.seq][this.step];
      this.playBass(note, this.nextNoteTime);
      
      if (this.step % 2 !== 0) this.playNoise(this.nextNoteTime, 0.05, 0.15); // off-beat hi-hat
      if (this.step % 4 === 0) this.playKick(this.nextNoteTime); // on-beat kick
      
      this.step++;
      if (this.step >= this.bassPattern[0].length) {
        this.step = 0;
        this.seq = (this.seq + 1) % this.bassPattern.length;
      }
      this.nextNoteTime += rate;
    }
    this.rafId = requestAnimationFrame(this.schedule);
  }

  startMusic() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.schedule();
    }
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  playSfxClearLine(tetris: boolean = false) {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554.37, t + 0.1);
    if(tetris) {
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
      osc.type = 'sine';
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
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  constructor(x: number, y: number, color: string) {
    this.x = x; this.y = y; this.color = color;
    this.vx = (Math.random() - 0.5) * 15;
    this.vy = (Math.random() - 0.5) * 15;
    this.maxLife = 20 + Math.random() * 20;
    this.life = this.maxLife;
    this.size = Math.random() * 4 + 2;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life--; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  text: string; x: number; y: number;
  life: number; maxLife: number; color: string; size: number;
  constructor(text: string, x: number, y: number, color: string = '#fff', size: number = 20) {
    this.text = text; this.x = x; this.y = y; this.color = color; this.size = size;
    this.maxLife = 60; this.life = this.maxLife;
  }
  update() { this.y -= 1; this.life--; }
  draw(ctx: CanvasRenderingContext2D) {
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

type Piece = { matrix: number[][]; x: number; y: number; id: number; name: string };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioController.setMute(nextMuted);
  };

  // Engine refs to avoid stale closures in listeners
  const engineRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let lastTime = performance.now();

    const engine = {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: null as Piece | null,
      nextQueue: [] as number[],
      holdId: 0,
      canHold: true,
      bag: [] as number[],
      particles: [] as Particle[],
      texts: [] as FloatingText[],

      dropTimer: 0,
      dropInterval: 800,
      lockDelayTimer: 0,
      
      score: 0, level: 1, lines: 0, combo: -1, b2b: false, lastMoveRotate: false,
      state: 'menu' as 'menu' | 'playing' | 'paused' | 'gameover',

      init() {
        this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        this.score = 0; this.level = 1; this.lines = 0; this.combo = -1; this.b2b = false;
        this.holdId = 0; this.canHold = true; this.nextQueue = []; this.bag = [];
        this.particles = []; this.texts = [];
        for (let i=0; i<5; i++) this.nextQueue.push(this.getNextBagPiece());
        this.spawnPiece();
        this.dropInterval = 800;
        this.state = 'playing';
        syncReactState();
        audioController.startMusic();
      },

      getNextBagPiece() {
        return Math.floor(Math.random() * 7) + 1;
      },

      spawnPiece(id?: number) {
        let spawnId = id;
        if (!spawnId) {
          spawnId = this.nextQueue.shift()!;
          this.nextQueue.push(this.getNextBagPiece());
        }
        this.piece = {
          matrix: SHAPES[spawnId].map(r => [...r]),
          x: Math.floor(COLS/2) - Math.floor(SHAPES[spawnId][0].length/2),
          y: 0,
          id: spawnId,
          name: NAMES[spawnId]
        };
        this.lastMoveRotate = false;
        this.dropTimer = 0;
        this.lockDelayTimer = 0;
        if (this.checkCollision(0, 0, this.piece.matrix)) {
          this.state = 'gameover';
          audioController.stopMusic();
          setGameState('gameover');
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

      rotateMatrix(matrix: number[][]) {
        const N = matrix.length;
        const res = Array.from({ length: N }, () => Array(N).fill(0));
        for (let y = 0; y < N; ++y) {
          for (let x = 0; x < N; ++x) {
            res[x][N - 1 - y] = matrix[y][x];
          }
        }
        return res;
      },

      checkCollision(dx: number, dy: number, matrix: number[][]) {
        if(!this.piece) return true;
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

      move(dx: number, dy: number) {
        if (!this.piece || this.state !== 'playing') return false;
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
        if (!this.piece || this.state !== 'playing') return;
        const rotated = this.rotateMatrix(this.piece.matrix);
        // Basic wall kicks
        const kicks = [[0,0], [-1,0], [1,0], [0,-1], [-2,0], [2,0]];
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
        if (!this.piece || this.state !== 'playing') return;
        let dist = 0;
        while (!this.checkCollision(0, 1, this.piece.matrix)) {
          this.piece.y++;
          dist++;
        }
        this.score += dist * 2; // Hard drop score
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
        if (!this.piece || this.piece.name !== 'T' || !this.lastMoveRotate) return false;
        const cx = this.piece.x + 1; 
        const cy = this.piece.y + 1;
        const corners = [[cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1]];
        let filled = 0;
        for (let [nx, ny] of corners) {
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
            // Explode particles
            for (let x = 0; x < COLS; x++) {
              for (let i=0; i<4; i++) {
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

      handleScore(linesCleared: number, isTSpin: boolean) {
        if (linesCleared > 0) this.combo++;
        else this.combo = -1;

        const isTetris = linesCleared === 4;
        let baseScore = 0;
        let alertText = "";

        if (isTSpin) {
          const names = ["T-Spin!", "T-Spin Single!", "T-Spin Double!", "T-Spin Triple!"];
          alertText = names[linesCleared];
          baseScore = (linesCleared === 0 ? 400 : (linesCleared === 1 ? 800 : (linesCleared === 2 ? 1200 : 1600))) * this.level;
          this.texts.push(new FloatingText(alertText, BOARD_X + 160, BOARD_Y + 320, '#a855f7', 30));
        } else if (linesCleared > 0) {
          const names = ["", "Single", "Double", "Triple", "TETRIS!"];
          if (isTetris) {
              alertText = "TETRIS!";
              this.texts.push(new FloatingText(alertText, BOARD_X + 160, BOARD_Y + 320, '#02b8cc', 32));
          }
          baseScore = (linesCleared === 1 ? 100 : (linesCleared === 2 ? 300 : (linesCleared === 3 ? 500 : 800))) * this.level;
        }

        if (linesCleared > 0) {
          audioController.playSfxClearLine(isTetris);
        }

        const isDifficult = isTetris || (isTSpin && linesCleared > 0);
        if (isDifficult) {
          if (this.b2b) {
            baseScore = Math.floor(baseScore * 1.5);
            this.texts.push(new FloatingText("Back-to-Back!", BOARD_X + 160, BOARD_Y + 280, '#f97316', 24));
          }
          this.b2b = true;
        } else if (linesCleared > 0) {
          this.b2b = false;
        }

        if (this.combo > 0) {
          baseScore += this.combo * 50 * this.level;
          this.texts.push(new FloatingText(`Combo ${this.combo}`, BOARD_X + 160, BOARD_Y + 240, '#ffd300', 20));
        }

        this.score += baseScore;
        if (linesCleared > 0) {
          this.lines += linesCleared;
          this.level = Math.floor(this.lines / 10) + 1;
          this.dropInterval = Math.max(50, 800 * Math.pow(0.85, this.level - 1));
        }
      },

      update(dt: number) {
        if (this.state !== 'playing') return;

        // Soft drop speed-up is handled in keydown
        this.dropTimer += dt;
        if (this.piece) {
          const isBottom = this.checkCollision(0, 1, this.piece.matrix);
          if (isBottom) {
             this.lockDelayTimer += dt;
             // 500ms lock delay standard
             if (this.lockDelayTimer >= 500 || this.dropTimer > 2000) {
                this.lockPiece();
             }
          } else {
             if (this.dropTimer >= this.dropInterval) {
               this.move(0, 1);
               this.dropTimer = 0;
             }
          }
        }

        for (let i=this.particles.length-1; i>=0; i--) {
          this.particles[i].update();
          if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i=this.texts.length-1; i>=0; i--) {
          this.texts[i].update();
          if (this.texts[i].life <= 0) this.texts.splice(i, 1);
        }
      },

      drawBlock(x: number, y: number, id: number, alpha: number = 1, isGhost: boolean = false) {
        if (id === 0) return;
        const color = COLORS[id];
        ctx.save();
        ctx.translate(x, y);
        if (isGhost) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
          ctx.strokeRect(2, 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(2, 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        } else {
          ctx.globalAlpha = alpha;
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          ctx.fillStyle = color;
          ctx.fillRect(1, 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(4, 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(2, 2, BLOCK_SIZE - 4, 3);
        }
        ctx.restore();
      },

      drawMiniPiece(px: number, py: number, id: number) {
        if (!id) return;
        const m = SHAPES[id];
        const bs = 24;
        const offsetX = px - (m[0].length * bs)/2;
        const offsetY = py - (m.length * bs)/2;
        for (let y=0; y<m.length; y++) {
          for (let x=0; x<m[y].length; x++) {
             if (m[y][x]) {
                const bx = offsetX + x * bs;
                const by = offsetY + y * bs;
                const c = COLORS[id];
                ctx.shadowBlur = 10; ctx.shadowColor = c; ctx.fillStyle = c;
                ctx.fillRect(bx+1, by+1, bs-2, bs-2);
                ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(bx+3, by+3, bs-6, bs-6);
             }
          }
        }
      },

      draw() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Draw Board Background Grid
        // Fill game area background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(BOARD_X, BOARD_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<=COLS; i++) {
          ctx.moveTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y);
          ctx.lineTo(BOARD_X + i * BLOCK_SIZE, BOARD_Y + ROWS * BLOCK_SIZE);
        }
        for(let i=0; i<=ROWS; i++) {
           ctx.moveTo(BOARD_X, BOARD_Y + i * BLOCK_SIZE);
           ctx.lineTo(BOARD_X + COLS * BLOCK_SIZE, BOARD_Y + i * BLOCK_SIZE);
        }
        ctx.stroke();

        // Draw Game Area Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(BOARD_X, BOARD_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

        // Draw Placed Blocks
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (this.board[y][x]) {
               this.drawBlock(BOARD_X + x * BLOCK_SIZE, BOARD_Y + y * BLOCK_SIZE, this.board[y][x]);
            }
          }
        }

        // Draw Ghost & Active Piece
        if (this.piece) {
           const gy = this.getGhostY();
           for (let y = 0; y < this.piece.matrix.length; y++) {
             for (let x = 0; x < this.piece.matrix[y].length; x++) {
                if (this.piece.matrix[y][x]) {
                   this.drawBlock(BOARD_X + (this.piece.x + x)*BLOCK_SIZE, BOARD_Y + (gy + y)*BLOCK_SIZE, this.piece.id, 1, true);
                   this.drawBlock(BOARD_X + (this.piece.x + x)*BLOCK_SIZE, BOARD_Y + (this.piece.y + y)*BLOCK_SIZE, this.piece.id);
                }
             }
           }
        }

        // Draw Side UI Base
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        
        // Boxes (bg-white/5 border border-white/10 rounded)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        ctx.fillRect(20, 20, 120, 120);
        ctx.strokeRect(20, 20, 120, 120);

        ctx.fillRect(CANVAS_W - 140, 20, 120, 360);
        ctx.strokeRect(CANVAS_W - 140, 20, 120, 360);
        
        // Hold Title
        ctx.fillStyle = '#22d3ee'; // cyan-400
        ctx.fillText('HOLD PIECE', 80, 45);
        
        // Next Title 
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('NEXT QUEUE', CANVAS_W - 80, 45);

        if (this.holdId) this.drawMiniPiece(80, 90, this.holdId);
        else if (!this.canHold) ctx.globalAlpha = 0.3; // Dim if can't hold

        for(let i=0; i<this.nextQueue.length; i++) {
           this.drawMiniPiece(CANVAS_W - 80, 90 + i * 70, this.nextQueue[i]);
        }

        // Left Stats
        ctx.fillRect(20, 160, 120, 240);
        ctx.strokeRect(20, 160, 120, 240);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ec4899'; // pink-500
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText('STATISTICS', 35, 190);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Orbitron';
        ctx.fillText('SCORE', 35, 230);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.score.toString().padStart(6, '0'), 35, 255);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Orbitron';
        ctx.fillText('LEVEL', 35, 300);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.level.toString().padStart(2, '0'), 35, 325);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px Orbitron';
        ctx.fillText('LINES', 35, 370);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px "JetBrains Mono", monospace';
        ctx.fillText(this.lines.toString(), 35, 395);

        // Draw Particles & Texts
        ctx.textAlign = 'center';
        this.particles.forEach(p => p.draw(ctx));
        this.texts.forEach(t => t.draw(ctx));
      }
    };

    engineRef.current = engine;

    const syncReactState = () => {
       setScore(engine.score);
       setLevel(engine.level);
       setLines(engine.lines);
    };

    function gameLoop(time: number) {
      const dt = time - lastTime;
      lastTime = time;
      engine.update(dt);
      engine.draw();
      rafId = requestAnimationFrame(gameLoop);
    }
    
    rafId = requestAnimationFrame(gameLoop);

    engine.draw(); // initial draw

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Controls bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng || eng.state !== 'playing') return;
      
      switch(e.code) {
        case 'ArrowLeft': eng.move(-1, 0); break;
        case 'ArrowRight': eng.move(1, 0); break;
        case 'ArrowDown': eng.move(0, 1); eng.score += 1; syncReactUI(); break;
        case 'ArrowUp': 
        case 'KeyX': eng.rotate(); break;
        case 'Space': eng.hardDrop(); break;
        case 'KeyC': eng.hold(); break;
        case 'KeyP': togglePause(); break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Could implement soft drop reset if we modified dropInterval directly
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const syncReactUI = () => {
     if(engineRef.current) {
         setScore(engineRef.current.score);
         setLevel(engineRef.current.level);
         setLines(engineRef.current.lines);
     }
  }

  const startGame = () => {
     if(engineRef.current) engineRef.current.init();
     setGameState('playing');
  };

  const togglePause = () => {
     const eng = engineRef.current;
     if (!eng) return;
     if (eng.state === 'playing') {
        eng.state = 'paused';
        audioController.stopMusic();
        setGameState('paused');
     } else if (eng.state === 'paused') {
        eng.state = 'playing';
        audioController.startMusic();
        setGameState('playing');
     }
  };

  // Touch handlers for Mobile
  const touchState = useRef({ x: 0, y: 0, swiped: false });
  const handleTouchStart = (e: React.TouchEvent) => {
    if(gameState !== 'playing') return;
    touchState.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, swiped: false };
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if(gameState !== 'playing') return;
    e.preventDefault(); // prevent scroll
    const dx = e.touches[0].clientX - touchState.current.x;
    const dy = e.touches[0].clientY - touchState.current.y;
    
    // Continuous swipe logic for horizontal
    if (Math.abs(dx) > 40) {
       engineRef.current?.move(dx > 0 ? 1 : -1, 0);
       touchState.current.x = e.touches[0].clientX; // reset to allow continuous movement
       touchState.current.swiped = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if(gameState !== 'playing') return;
    const dx = e.changedTouches[0].clientX - touchState.current.x;
    const dy = e.changedTouches[0].clientY - touchState.current.y;
    
    if (!touchState.current.swiped) {
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        // Tap
        engineRef.current?.rotate();
      } else if (dy > 40) {
        // Swipe Down
        engineRef.current?.hardDrop();
      } else if (dy < -40) {
        // Swipe Up
        engineRef.current?.hold();
      }
    } else {
       if (dy > 60) engineRef.current?.hardDrop(); // large swipe down
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#020205] text-[#e0e0ff] flex flex-col items-center justify-center overflow-hidden font-sans select-none touch-none">
      
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#020205_100%)] opacity-50 pointer-events-none" />

      {/* Main Game Container */}
      <div 
         className="relative z-10 p-2 md:p-6 w-[96vw] max-w-[640px] md:w-auto md:h-[680px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-3xl shadow-2xl flex justify-center"
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
      >
        <div className="relative p-1 bg-white/5 border border-white/20 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full aspect-square md:w-auto md:h-full flex items-center justify-center">
            <canvas 
               ref={canvasRef} 
               width={CANVAS_W} 
               height={CANVAS_H} 
               className="bg-[#05050a] block w-full h-full object-contain rounded"
            />

            {/* DOM Overlays */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20">
            <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 mb-8">NEON TETRIS</h1>
            <p className="text-white/50 mb-8 tracking-widest text-sm uppercase">Neon Protocol</p>
            <button onClick={startGame} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest">
              START GAME
            </button>
            
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-white/50 uppercase">
              <div className="text-right">Move</div><div className="text-cyan-400">Arrow Keys</div>
              <div className="text-right">Soft Drop</div><div className="text-cyan-400">Arrow Down</div>
              <div className="text-right">Hard Drop</div><div className="text-cyan-400">Space</div>
              <div className="text-right">Rotate</div><div className="text-cyan-400">Up / X</div>
              <div className="text-right">Hold</div><div className="text-cyan-400">C Key</div>
            </div>
            <p className="mt-4 text-white/50 text-[10px] text-center w-full uppercase">Mobile: Swipe L/R to move, Up to Hold, Down to Drop. Tap to Rotate.</p>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20">
            <h2 className="text-4xl font-bold text-cyan-400 mb-8 tracking-widest uppercase">PAUSED</h2>
            <button onClick={togglePause} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-2">
              <Play fill="currentColor" /> RESUME
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-lg z-20">
            <h2 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 mb-4 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]">SYSTEM FAILURE</h2>
            <div className="text-center mb-8 uppercase text-[10px] tracking-widest text-white/50">
               <p className="text-xl mb-2 text-white">FINAL SCORE: <span className="font-bold text-pink-500">{score}</span></p>
               <p className="">LEVEL REACHED: {level}</p>
            </div>
            <button onClick={startGame} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-pink-500 transition-colors uppercase tracking-widest flex items-center gap-2">
              <RotateCcw size={16} /> REBOOT SYSTEM
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Removed Mobile On-Screen Controls Backup */}

      {/* Floating Header */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
         <button onClick={toggleMute} className="p-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 transition">
             {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
         </button>
         {gameState === 'playing' && (
            <button onClick={togglePause} className="p-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 transition">
              <Pause size={20} />
            </button>
         )}
      </div>
    </div>
  );
}
