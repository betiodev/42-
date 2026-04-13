// ============================================================
//  GAME CONSTANTS
// ============================================================
const ALPHA_MODE = true;                 // Feature-flag for alpha builds

// Dot
const DOT_START_SIZE       = 80;         // Starting radius of the dot (px)
const DOT_MIN_SIZE         = 10;         // Floor: smallest the dot can shrink to
const DOT_REDUCTION_TAP    = 4;          // Shrink per tap
const DOT_REDUCTION_IDLE   = 1;          // Shrink per idle tick

// Timers (ms)
const TIMER_GAME_DURATION  = 42000;      // Total round length
const TIMER_IDLE_INTERVAL  = 500;        // How often the idle-shrink fires
const TIMER_SPAWN_INTERVAL = 2700;       // Per-dot countdown (ms)

// Scoring
const SCORE_PER_TAP        = 1;          // Points awarded per successful tap

// Growth / shrink rates
const DOT_GROWTH_ON_TAP    = 6;          // Dot grows back a bit on hit
const DOT_GROWTH_FLOOR     = DOT_START_SIZE;  // Max size after growth
const DOT_GROWTH_MIN       = DOT_MIN_SIZE;    // Min size floor

// Easter-egg score triggers (checked in order, first match wins)
const EASTER_EGG_SCORES = [
  69,    // nice
  100,   // Century club
  142,   // 100 + 42
  256,   // Power of 2
  314,   // Pi day
  420,   // Blaze it
  666,   // Number of the beast
  777,   // Jackpot
  1000,  // Grand
  1337,  // Leet
  4200,  // 42 * 100
];

// Easter-egg messages keyed by score
const EASTER_EGG_MESSAGES = {
  69:   'Nice.',
  100:  'Welcome to the Century Club!',
  142:  '100 + 42 = Enlightenment.',
  256:  'A Perfect Power of Two.',
  314:  'Mmm... Pi.',
  420:  'Blaze it.',
  666:  'The Number of the Beast!',
  777:  'JACKPOT!',
  1000: 'Welcome to the Grand Club.',
  1337: 'H4X0R STATUS: L33T',
  4200: 'The Ultimate Answer x 100.',
};

// Paywall state
const STORAGE_KEY_PRO = '42game_pro';

function isProUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY_PRO) === 'true';
  } catch (e) { return false; }
}

function unlockPro() {
  try { localStorage.setItem(STORAGE_KEY_PRO, 'true'); } catch (e) {}
}

// LIMINAL secret-code state — when unlocked, philosophical death messages
// appear in place of empty endings.
const STORAGE_KEY_LIMINAL = '42game_liminal';

function isLiminalUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY_LIMINAL) === 'true';
  } catch (e) { return false; }
}

function unlockLiminal() {
  try { localStorage.setItem(STORAGE_KEY_LIMINAL, 'true'); } catch (e) {}
}

function lockLiminal() {
  try { localStorage.removeItem(STORAGE_KEY_LIMINAL); } catch (e) {}
}

const LIMINAL_DEATH_MESSAGES = [
  'The hallway has no end.',
  'You were never really here.',
  'Time forgot to keep counting.',
  'Between two thoughts, you slipped.',
  'The room remembers you leaving.',
  'Nothing waits, and waits well.',
  'You answered the wrong question correctly.',
  'The door was open the whole time.',
  'Every exit is also an entrance.',
  'You are the threshold.',
  'Silence kept your place.',
  'The map dissolved in your hand.',
];

function pickLiminalMessage() {
  return LIMINAL_DEATH_MESSAGES[
    Math.floor(Math.random() * LIMINAL_DEATH_MESSAGES.length)
  ];
}

// Haptics helper
function triggerHaptic(style) {
  const settings = loadSettings();
  if (!settings.haptics) return;
  try {
    if (navigator.vibrate) {
      const patterns = { light: 10, medium: 25, heavy: 50 };
      navigator.vibrate(patterns[style] || 15);
    }
  } catch (e) {}
}

// Secret-code DOM prompt — used by SettingsScene's hidden LIMINAL unlock.
// Renders a full-screen overlay with a real <input> so mobile keyboards work.
function showSecretCodePrompt(onSubmit) {
  // Don't double-mount
  if (document.getElementById('secret-code-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'secret-code-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.92);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'z-index:9999;font-family:monospace;color:#fff;';

  const label = document.createElement('div');
  label.textContent = 'enter code';
  label.style.cssText = 'font-size:14px;letter-spacing:0.3em;opacity:0.6;margin-bottom:14px;';
  overlay.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 16;
  input.style.cssText =
    'background:transparent;border:none;border-bottom:1px solid #fff;' +
    'color:#fff;font-family:monospace;font-size:28px;letter-spacing:0.4em;' +
    'text-align:center;width:240px;padding:8px 0;outline:none;';
  overlay.appendChild(input);

  const hint = document.createElement('div');
  hint.textContent = 'tap outside to cancel';
  hint.style.cssText = 'font-size:11px;letter-spacing:0.2em;opacity:0.35;margin-top:24px;';
  overlay.appendChild(hint);

  const close = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  const submit = () => {
    const value = (input.value || '').trim().toUpperCase();
    close();
    onSubmit(value);
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  });

  // Tap outside the input cancels
  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.target === overlay) close();
  });

  document.body.appendChild(overlay);
  // Defer focus to next frame so iOS Safari opens the keyboard
  setTimeout(() => input.focus(), 50);
}

// Shared button factory (used across scenes)
function createButton(scene, x, y, label, color, callback, opts) {
  const W = (opts && opts.width) || 240;
  const H = (opts && opts.height) || 56;
  const R = 14;

  const bg = scene.add.graphics();
  bg.lineStyle(1.5, 0xffffff, 1);
  bg.strokeRoundedRect(x - W / 2, y - H / 2, W, H, R);

  const text = scene.add.text(x, y, label, {
    fontSize: '24px', fill: '#ffffff', fontStyle: 'bold',
    fontFamily: 'Arial, sans-serif',
  }).setOrigin(0.5);

  const hitZone = scene.add.zone(x, y, W, H).setInteractive({ useHandCursor: true });

  hitZone.on('pointerdown', () => {
    triggerHaptic('light');
    bg.setAlpha(0.6);
    text.setAlpha(0.6);
  });
  hitZone.on('pointerup', () => {
    bg.setAlpha(1);
    text.setAlpha(1);
    callback();
  });
  hitZone.on('pointerout', () => {
    bg.setAlpha(1);
    text.setAlpha(1);
  });

  return { bg, text, hitZone };
}

// ============================================================
//  LOCALSTORAGE HELPERS
// ============================================================
const STORAGE_KEY_HIGH = '42game_highscore';
const STORAGE_KEY_SETTINGS = '42game_settings';

function saveHighScore(score) {
  try {
    const current = loadHighScore();
    if (score > current) {
      localStorage.setItem(STORAGE_KEY_HIGH, JSON.stringify(score));
      return true; // new record
    }
    return false;
  } catch (e) {
    console.warn('localStorage unavailable', e);
    return false;
  }
}

function loadHighScore() {
  try {
    const val = localStorage.getItem(STORAGE_KEY_HIGH);
    return val ? JSON.parse(val) : 0;
  } catch (e) {
    return 0;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('localStorage unavailable', e);
  }
}

function loadSettings() {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return val ? JSON.parse(val) : { sfx: true, haptics: true };
  } catch (e) {
    return { sfx: true, haptics: true };
  }
}

// ============================================================
//  DAILY PLAY LIMIT
// ============================================================
const DAILY_PLAY_LIMIT = 20;
const STORAGE_KEY_DAILY = '42game_daily';

function getDailyPlayCount() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) return 0;
    return data.count || 0;
  } catch (e) { return 0; }
}

function incrementDailyPlayCount() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_DAILY) || '{}');
    if (data.date !== today) {
      localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify({ date: today, count: 1 }));
    } else {
      data.count = (data.count || 0) + 1;
      localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(data));
    }
  } catch (e) {}
}

// ============================================================
//  AUDIO (Web Audio API beeps — no asset files needed)
// ============================================================
let audioCtx = null;

function playBeep(freq, duration, type) {
  const s = loadSettings();
  if (!s.sfx) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type || 'sine';
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// Head-start flag (set by TitleScene 42-tap easter egg)
window.HEAD_START_ACTIVE = false;
