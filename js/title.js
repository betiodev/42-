// ============================================================
//  SCENES
// ============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- "42?" title — single line, white ----
    const title = this.add.text(W / 2, H * 0.30, '42?', {
      fontSize: '96px',
      fontFamily: 'Arial Black, Impact, sans-serif',
      fill: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ---- Interactive dot (replaces the "?" period) ----
    // Position at the "?" dot: right-of-centre, below baseline
    const qDotX = title.x + title.displayWidth * 0.30;
    const qDotY = title.y + title.displayHeight * 0.33;
    const dotRadius = 8;

    // Mask the original text dot with a black rect
    const mask = this.add.graphics();
    mask.fillStyle(0x000000, 1);
    mask.fillRect(qDotX - 14, qDotY - 12, 28, 24);

    // Small white dot — no permanent animation, no glow
    this.dot = this.add.circle(qDotX, qDotY, dotRadius, 0xffffff);

    // Larger invisible hit zone for reliable mobile tap registration
    // Visual stays at 8px; tap target is 30px radius (60x60 zone).
    const dotHit = this.add.zone(qDotX, qDotY, 60, 60).setInteractive({ useHandCursor: true });

    // ---- Dot tap: single quick blink only ----
    this.dotTapCount = 0;
    dotHit.on('pointerdown', () => {
      this.dotTapCount++;
      triggerHaptic('medium');

      // Single quick blink: pop up and settle
      this.tweens.killTweensOf(this.dot);
      this.dot.setScale(2.5);
      this.tweens.add({
        targets: this.dot,
        scaleX: 1, scaleY: 1,
        duration: 180, ease: 'Cubic.easeOut',
      });

      // 42 taps = secret message + head-start flag
      if (this.dotTapCount === 42) {
        window.HEAD_START_ACTIVE = true;
        triggerHaptic('heavy');
        const secret = this.add.text(W / 2, H * 0.45, 'You found the answer.\nHead start unlocked!', {
          fontSize: '20px', fill: '#ffffff', fontStyle: 'italic',
          fontFamily: 'Georgia, serif', align: 'center',
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({
          targets: secret,
          alpha: 1, y: secret.y - 10,
          duration: 600, ease: 'Back.easeOut',
          yoyo: true, hold: 2000,
          onComplete: () => secret.destroy(),
        });
      }
    });

    // ---- High score display ----
    const hi = loadHighScore();
    if (hi > 0) {
      this.add.text(W / 2, H * 0.50, 'HIGH SCORE: ' + hi, {
        fontSize: '20px', fill: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5).setAlpha(0.4);
    }

    // ---- Buttons ----
    createButton(this, W / 2, H * 0.68, 'START', null, () => {
      this.scene.start('GameScene');
    });

    createButton(this, W / 2, H * 0.78, 'SETTINGS', null, () => {
      this.scene.start('SettingsScene');
    });

    // ---- Alpha badge ----
    if (ALPHA_MODE) {
      this.add.text(W - 12, 12, 'ALPHA', {
        fontSize: '13px', fill: '#ffffff', fontStyle: 'bold',
        fontFamily: 'monospace',
      }).setOrigin(1, 0).setAlpha(0.3);
    }
  }
}
