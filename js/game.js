class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- Game state ----
    this.score = 0;
    this.gameActive = true;
    this.isPaused = false;
    this.currentDotSize = DOT_START_SIZE;
    this.currentSpawnInterval = TIMER_SPAWN_INTERVAL;
    this.dotCountdown = 0;
    this.dotCountdownMax = 0;
    this.lastDotPos = null;
    this.totalTaps = 0;
    this.currentDot = null;
    this.isCurrentDotRed = false;
    this.is42RedDot = false;
    this.redDot42Done = false;
    this.spawnsSinceLastRed = 0;
    this.redTrap = null;
    this.redPhaseActive = false;
    this.redVariationTimer = null;
    this.isMorphedWhite = false;
    this.deathMessage = '';

    // ---- Daily play limit ----
    if (!ALPHA_MODE) {
      const plays = getDailyPlayCount();
      if (plays >= DAILY_PLAY_LIMIT) {
        this.gameActive = false;
        this.add.text(W / 2, H * 0.38, 'Daily limit reached!', {
          fontSize: '34px', fill: '#ffffff', fontStyle: 'bold',
          fontFamily: 'Arial Black, sans-serif',
        }).setOrigin(0.5);
        this.add.text(W / 2, H * 0.46, 'Come back tomorrow\nfor more games.', {
          fontSize: '20px', fill: '#ffffff', align: 'center',
          fontFamily: 'Arial, sans-serif',
        }).setOrigin(0.5);
        createButton(this, W / 2, H * 0.60, 'BACK', '#0f3460', () => {
          this.scene.start('TitleScene');
        });
        return;
      }
    }
    incrementDailyPlayCount();

    // ---- Timer bar (top of screen) ----
    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(0x222222, 1);
    this.timerBarBg.fillRect(0, 0, W, 8);
    this.timerBar = this.add.graphics();
    this.updateTimerBar();

    // ---- Score text ----
    this.scoreText = this.add.text(W / 2, 46, '' + this.score, {
      fontSize: '52px', fill: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5);

    // ---- Background miss zone (tap anywhere except dot = game over) ----
    this.missZone = this.add.zone(W / 2, H / 2, W, H).setInteractive();
    this.missZone.on('pointerdown', () => {
      if (!this.gameActive || this.isPaused || this.redPhaseActive) return;
      this.endGame();
    });

    // ---- Head start indicator ----
    if (window.HEAD_START_ACTIVE) {
      const hsText = this.add.text(W / 2, 116, 'Head Start +11', {
        fontSize: '18px', fill: '#ffffff', fontStyle: 'italic',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({
        targets: hsText, alpha: 1,
        duration: 400, yoyo: true, hold: 2000,
        onComplete: () => hsText.destroy(),
      });
    }

    // ---- Spawn first dot ----
    this.spawnDot();

    // ---- Page Visibility API ----
    this.boundVisHandler = this.handleVisibility.bind(this);
    document.addEventListener('visibilitychange', this.boundVisHandler);
  }

  // ================================================================
  //  UPDATE LOOP
  // ================================================================
  update(time, delta) {
    if (!this.gameActive || this.isPaused || this.redPhaseActive) return;

    this.dotCountdown -= delta;
    if (this.dotCountdown <= 0) {
      this.dotCountdown = 0;
      this.updateTimerBar();
      // 42 red dot expiring just despawns it
      if (this.is42RedDot) {
        this.redDot42Done = true;
        this.is42RedDot = false;
        this.spawnDot();
        return;
      }
      // Score 42 timer expiry = sky explosion
      if (this.score === 42) {
        this.deathMessage = 'Hello there';
        const cx = this.currentDot ? this.currentDot.x : this.scale.width / 2;
        const cy = this.currentDot ? this.currentDot.y : this.scale.height / 2;
        this.skyExplosion(cx, cy);
        return;
      }
      this.endGame();
      return;
    }
    this.updateTimerBar();
  }

  // ================================================================
  //  TIMER BAR
  // ================================================================
  updateTimerBar() {
    const W = this.scale.width;
    const ratio = this.dotCountdownMax > 0
      ? Math.max(0, this.dotCountdown / this.dotCountdownMax) : 1;
    this.timerBar.clear();

    let color;
    if (ratio <= 0.2)      color = 0xff3333;   // red warning
    else                   color = 0xffffff;   // white

    this.timerBar.fillStyle(color, 1);
    this.timerBar.fillRect(0, 0, W * ratio, 8);
  }

  // ================================================================
  //  DOT SPAWNING
  // ================================================================
  getValidPosition() {
    const W = this.scale.width;
    const H = this.scale.height;
    const margin = 0.10;
    const pad = this.currentDotSize;
    const minX = W * margin + pad;
    const maxX = W * (1 - margin) - pad;
    const minY = H * margin + pad + 110; // clear the HUD
    const maxY = H * (1 - margin) - pad;
    const minDist = Math.min(W, H) * 0.30;

    for (let a = 0; a < 50; a++) {
      const x = Phaser.Math.Between(minX, maxX);
      const y = Phaser.Math.Between(minY, maxY);
      if (this.lastDotPos) {
        const d = Phaser.Math.Distance.Between(x, y, this.lastDotPos.x, this.lastDotPos.y);
        if (d < minDist) continue;
      }
      return { x, y };
    }
    return { x: Phaser.Math.Between(minX, maxX), y: Phaser.Math.Between(minY, maxY) };
  }

  spawnDot() {
    if (this.currentDot) { this.currentDot.destroy(); this.currentDot = null; }
    this.cleanupRedVariation();

    // ---- Decide if red dot ----
    this.isCurrentDotRed = false;
    this.is42RedDot = false;

    if (this.score >= 42 && !this.redDot42Done) {
      // Special 42 red dot
      this.isCurrentDotRed = true;
      this.is42RedDot = true;
    } else if (this.redDot42Done) {
      // Frequency-phase red variations
      this.spawnsSinceLastRed++;
      const freq = this.getRedDotFrequency();
      if (this.spawnsSinceLastRed >= freq) {
        this.spawnsSinceLastRed = 0;
        this.runRedVariation();
        return;
      }
    }

    // ---- Create the dot (normal white or 42 red) ----
    const pos = this.getValidPosition();
    this.lastDotPos = pos;

    const fill = this.isCurrentDotRed ? 0xff0000 : 0xffffff;
    this.currentDot = this.add.circle(pos.x, pos.y, this.currentDotSize, fill);
    this.currentDot.setInteractive({ useHandCursor: true });

    // Pop-in entrance
    this.currentDot.setScale(0);
    this.tweens.add({
      targets: this.currentDot,
      scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Back.easeOut',
    });

    // ---- Per-dot countdown ----
    this.dotCountdown = this.currentSpawnInterval;
    this.dotCountdownMax = this.currentSpawnInterval;

    // ---- Tap handler ----
    this.currentDot.on('pointerdown', (pointer) => {
      if (!this.gameActive || this.isPaused) return;
      this.onDotTap(pointer);
    });
  }

  // ================================================================
  //  RED DOT VARIATIONS (post-42)
  // ================================================================
  runRedVariation() {
    const v = Phaser.Math.Between(1, 3);
    if (v === 1) this.redVariationSequential();
    else if (v === 2) this.redVariationSimultaneous();
    else this.redVariationMorph();
  }

  // Variation 1 — Sequential: red appears alone, then white after
  redVariationSequential() {
    this.redPhaseActive = true;

    const pos = this.getValidPosition();
    this.lastDotPos = pos;
    this.redTrap = this.add.circle(pos.x, pos.y, this.currentDotSize, 0xff0000);
    this.redTrap.setInteractive({ useHandCursor: true });
    this.redTrap.setScale(0);
    this.tweens.add({
      targets: this.redTrap, scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Back.easeOut',
    });

    this.redTrap.on('pointerdown', () => {
      if (!this.gameActive || this.isPaused) return;
      triggerHaptic('heavy');
      playBeep(150, 0.3, 'square');
      this.endGame();
    });

    this.redVariationTimer = this.time.delayedCall(this.currentSpawnInterval * 0.7, () => {
      this.cleanupRedVariation();
      this.spawnDot();
    });
  }

  // Variation 2 — Simultaneous: red + white at same time
  redVariationSimultaneous() {
    // White dot (normal gameplay)
    const whitePos = this.getValidPosition();
    this.lastDotPos = whitePos;
    this.currentDot = this.add.circle(whitePos.x, whitePos.y, this.currentDotSize, 0xffffff);
    this.currentDot.setInteractive({ useHandCursor: true });
    this.currentDot.setScale(0);
    this.tweens.add({
      targets: this.currentDot, scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Back.easeOut',
    });
    this.dotCountdown = this.currentSpawnInterval;
    this.dotCountdownMax = this.currentSpawnInterval;
    this.currentDot.on('pointerdown', (pointer) => {
      if (!this.gameActive || this.isPaused) return;
      this.onDotTap(pointer);
    });

    // Red trap at different position
    const redPos = this.getValidPosition();
    this.redTrap = this.add.circle(redPos.x, redPos.y, this.currentDotSize, 0xff0000);
    this.redTrap.setInteractive({ useHandCursor: true });
    this.redTrap.setScale(0);
    this.tweens.add({
      targets: this.redTrap, scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Back.easeOut',
    });
    this.redTrap.on('pointerdown', () => {
      if (!this.gameActive || this.isPaused) return;
      triggerHaptic('heavy');
      playBeep(150, 0.3, 'square');
      this.endGame();
    });

    // Red trap auto-disappears after 70% of countdown
    this.redVariationTimer = this.time.delayedCall(this.currentSpawnInterval * 0.7, () => {
      if (this.redTrap) { this.redTrap.destroy(); this.redTrap = null; }
      this.redVariationTimer = null;
    });
  }

  // Variation 3 — Morph: red dot transforms into white
  redVariationMorph() {
    this.redPhaseActive = true;
    this.isMorphedWhite = false;

    const pos = this.getValidPosition();
    this.lastDotPos = pos;
    this.currentDot = this.add.circle(pos.x, pos.y, this.currentDotSize, 0xff0000);
    this.currentDot.setInteractive({ useHandCursor: true });
    this.currentDot.setScale(0);
    this.tweens.add({
      targets: this.currentDot, scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Back.easeOut',
    });

    this.currentDot.on('pointerdown', (pointer) => {
      if (!this.gameActive || this.isPaused) return;
      if (!this.isMorphedWhite) {
        triggerHaptic('heavy');
        playBeep(150, 0.3, 'square');
        this.endGame();
      } else {
        this.onDotTap(pointer);
      }
    });

    // After half the interval, morph red → white
    const morphDelay = Math.max(275, this.currentSpawnInterval * 0.35);
    this.redVariationTimer = this.time.delayedCall(morphDelay, () => {
      if (!this.gameActive || !this.currentDot) return;
      this.isMorphedWhite = true;
      this.redPhaseActive = false;
      this.currentDot.setFillStyle(0xffffff);
      this.tweens.add({
        targets: this.currentDot,
        scaleX: 1.3, scaleY: 1.3,
        duration: 100, yoyo: true, ease: 'Cubic.easeOut',
      });
      this.dotCountdown = this.currentSpawnInterval;
      this.dotCountdownMax = this.currentSpawnInterval;
      this.redVariationTimer = null;
    });
  }

  cleanupRedVariation() {
    if (this.redTrap) { this.redTrap.destroy(); this.redTrap = null; }
    if (this.redVariationTimer) { this.redVariationTimer.remove(); this.redVariationTimer = null; }
    this.redPhaseActive = false;
    this.isMorphedWhite = false;
  }

  getRedDotFrequency() {
    if (this.score < 60)  return 10;
    if (this.score < 80)  return 7;
    if (this.score < 100) return 5;
    return 3;
  }

  // ================================================================
  //  TAP HANDLING
  // ================================================================
  onDotTap(pointer) {
    const dotX = this.currentDot.x;
    const dotY = this.currentDot.y;
    const dotSize = this.currentDotSize;

    // ---- Red dot tap ----
    if (this.isCurrentDotRed) {
      this.onRedDotTap(dotX, dotY);
      return;
    }

    // ---- Normal tap ----
    // Two-finger detection: award 2 points
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    const twoFinger = p1 && p2 && p1.isDown && p2.isDown;

    let points;
    let headStartUsed = false;
    if (window.HEAD_START_ACTIVE) {
      points = 11;
      this.score += 11;
      window.HEAD_START_ACTIVE = false;
      headStartUsed = true;
    } else {
      points = twoFinger ? 2 : SCORE_PER_TAP;
      this.score += points;
    }
    this.totalTaps++;

    // Update score display with pop
    this.scoreText.setText('' + this.score);
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2, scaleY: 1.2,
      duration: 80, yoyo: true, ease: 'Cubic.easeOut',
    });

    // Floating "+N" text
    const plusColor = headStartUsed ? '#ffd700' : (twoFinger ? '#ffff00' : '#ffffff');
    const plusText = this.add.text(dotX, dotY - 20, '+' + points, {
      fontSize: headStartUsed ? '36px' : '28px', fill: plusColor,
      fontStyle: 'bold', fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: plusText,
      y: plusText.y - 60, alpha: 0,
      duration: 600,
      onComplete: () => plusText.destroy(),
    });

    // Ripple effect — golden inward collapse for head-start, otherwise normal
    if (headStartUsed) {
      this.goldenRipple(dotX, dotY, dotSize);
    } else {
      this.createRipple(dotX, dotY, dotSize);
    }

    // Sound (pitch rises with score) & haptics
    if (headStartUsed) {
      playBeep(880, 0.18, 'sine');
      this.time.delayedCall(90, () => playBeep(1320, 0.22, 'sine'));
      triggerHaptic('heavy');
    } else {
      playBeep(500 + Math.min(this.score * 3, 800), 0.12, 'sine');
      triggerHaptic(twoFinger ? 'medium' : 'light');
    }

    // Progressive difficulty
    this.applyDifficultyReduction();

    // Respawn
    this.spawnDot();
  }

  onRedDotTap(x, y) {
    // ---- The 42 special: tapping red = game over ----
    this.redDot42Done = true;
    this.is42RedDot = false;
    triggerHaptic('heavy');
    playBeep(150, 0.3, 'square');
    this.deathMessage = 'patience is key';
    this.endGame();
  }

  // ================================================================
  //  RIPPLE EFFECTS
  // ================================================================
  createRipple(x, y, size) {
    if (size > 39) {
      // Inward ripple: 3 concentric rings collapse toward centre
      for (let i = 0; i < 3; i++) {
        const ring = this.add.circle(x, y, size);
        ring.setStrokeStyle(2, 0xffffff, 0.7 - i * 0.15);
        ring.setFillStyle(0, 0);
        this.tweens.add({
          targets: ring,
          scaleX: 0, scaleY: 0, alpha: 0,
          duration: 140, delay: i * 20, ease: 'Cubic.easeIn',
          onComplete: () => ring.destroy(),
        });
      }
    } else {
      // Outward pop: small ring expands outward
      const ring = this.add.circle(x, y, size);
      ring.setStrokeStyle(3, 0xffffff, 0.7);
      ring.setFillStyle(0, 0);
      ring.setScale(0.5);
      this.tweens.add({
        targets: ring,
        scaleX: 2.5, scaleY: 2.5, alpha: 0,
        duration: 140, ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  // Golden inward collapse — only triggered on the head-start tap
  goldenRipple(x, y, size) {
    const startSize = Math.max(size * 1.6, 70);
    // 5 thick golden rings collapse inward with stagger
    for (let i = 0; i < 5; i++) {
      const ring = this.add.circle(x, y, startSize);
      ring.setStrokeStyle(3, 0xffd700, 0.85 - i * 0.12);
      ring.setFillStyle(0, 0);
      this.tweens.add({
        targets: ring,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 260, delay: i * 35, ease: 'Cubic.easeIn',
        onComplete: () => ring.destroy(),
      });
    }
    // Brief golden flash at the centre
    const flash = this.add.circle(x, y, 14, 0xffd700, 0.9);
    this.tweens.add({
      targets: flash,
      scaleX: 4, scaleY: 4, alpha: 0,
      duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // ================================================================
  //  PROGRESSIVE DIFFICULTY
  // ================================================================
  applyDifficultyReduction() {
    // Phased reduction: harder scaling at higher scores
    const factor = this.score <= 41 ? 0.995
                 : this.score <= 100 ? 0.990
                 : 0.985;
    this.currentDotSize = Math.max(42, this.currentDotSize * factor);
    this.currentSpawnInterval = Math.max(300, this.currentSpawnInterval * factor);
  }

  // ================================================================
  //  SKY EXPLOSION (lose-at-42)
  // ================================================================
  skyExplosion(cx, cy) {
    this.gameActive = false;
    const W = this.scale.width;
    const H = this.scale.height;

    // Remove game elements
    if (this.currentDot) { this.currentDot.destroy(); this.currentDot = null; }
    this.cleanupRedVariation();

    // Screen shake
    this.cameras.main.shake(900, 0.035);

    // 35 expanding particles
    const colors = [0xff0000, 0xff3300, 0xff6600, 0xff9900, 0xffcc00, 0xffff00, 0xffffff];
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
      const speed = Phaser.Math.Between(120, 420);
      const col = colors[i % colors.length];
      const r = Phaser.Math.Between(5, 22);

      const p = this.add.circle(cx, cy, r, col).setAlpha(0.9);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * speed,
        y: cy + Math.sin(angle) * speed,
        scaleX: Phaser.Math.FloatBetween(0.1, 0.4),
        scaleY: Phaser.Math.FloatBetween(0.1, 0.4),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1600),
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // White flash
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillRect(0, 0, W, H);
    flash.setAlpha(0);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.85 },
      duration: 350, delay: 250,
      yoyo: true, hold: 200,
      onComplete: () => flash.destroy(),
    });

    // Dramatic "42!" text
    const txt = this.add.text(W / 2, H / 2, '42!', {
      fontSize: '120px', fill: '#ff0000', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5).setAlpha(0).setScale(0.1);

    this.tweens.add({
      targets: txt,
      alpha: 1, scaleX: 1.5, scaleY: 1.5,
      duration: 600, delay: 200, ease: 'Back.easeOut',
    });

    // Low rumble sound
    playBeep(60, 1.0, 'sawtooth');
    this.time.delayedCall(400, () => playBeep(45, 0.8, 'sawtooth'));

    // Transition to game over
    this.time.delayedCall(2500, () => {
      this.cleanup();
      this.scene.start('GameOverScene', { score: this.score, message: this.deathMessage || '' });
    });
  }

  // ================================================================
  //  GAME END (dot countdown expired or background tap)
  // ================================================================
  endGame() {
    this.gameActive = false;
    this.cleanupRedVariation();

    // Final beep
    playBeep(300, 0.4, 'triangle');

    if (this.currentDot) {
      this.tweens.add({
        targets: this.currentDot,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 300,
        onComplete: () => {
          this.cleanup();
          this.scene.start('GameOverScene', { score: this.score, message: this.deathMessage || '' });
        },
      });
    } else {
      this.cleanup();
      this.scene.start('GameOverScene', { score: this.score, message: this.deathMessage || '' });
    }
  }

  // ================================================================
  //  PAUSE / RESUME (Page Visibility API)
  // ================================================================
  handleVisibility() {
    if (!this.gameActive) return;
    if (document.hidden) this.pauseGame();
    else this.resumeGame();
  }

  pauseGame() {
    if (!this.gameActive || this.isPaused) return;
    this.isPaused = true;
    this.time.paused = true;

    const W = this.scale.width;
    const H = this.scale.height;

    this.pauseOverlay = this.add.graphics();
    this.pauseOverlay.fillStyle(0x000000, 0.7);
    this.pauseOverlay.fillRect(0, 0, W, H);
    this.pauseOverlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, W, H),
      Phaser.Geom.Rectangle.Contains
    );

    this.pauseLabel = this.add.text(W / 2, H / 2, 'PAUSED\n\nTap to resume', {
      fontSize: '34px', fill: '#ffffff', align: 'center',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    this.pauseOverlay.on('pointerdown', () => this.resumeGame());
  }

  resumeGame() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.time.paused = false;
    if (this.pauseOverlay) { this.pauseOverlay.destroy(); this.pauseOverlay = null; }
    if (this.pauseLabel)   { this.pauseLabel.destroy();   this.pauseLabel = null; }
  }

  // ================================================================
  //  CLEANUP
  // ================================================================
  cleanup() {
    document.removeEventListener('visibilitychange', this.boundVisHandler);
  }
}
