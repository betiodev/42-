class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.settings = loadSettings();

    // ---- Background ----
    // Background handled by global config (black)

    // ---- Title ----
    this.add.text(W / 2, H * 0.10, 'SETTINGS', {
      fontSize: '40px', fill: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5);

    // ---- Toggles ----
    this.createToggle(W / 2, H * 0.28, 'Sound', this.settings.sfx, (val) => {
      this.settings.sfx = val;
      saveSettings(this.settings);
    });

    this.createToggle(W / 2, H * 0.40, 'Haptics', this.settings.haptics, (val) => {
      this.settings.haptics = val;
      saveSettings(this.settings);
      if (val) triggerHaptic('medium'); // confirm haptics work
    });

    // ---- Divider ----
    const divider = this.add.graphics();
    divider.lineStyle(1, 0xffffff, 0.2);
    divider.lineBetween(W * 0.15, H * 0.52, W * 0.85, H * 0.52);

    // ---- Reset high score ----
    const resetText = this.add.text(W / 2, H * 0.60, 'Reset High Score', {
      fontSize: '20px', fill: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resetText.on('pointerdown', () => {
      if (this.confirmingReset) {
        // Second tap: actually reset
        try { localStorage.removeItem(STORAGE_KEY_HIGH); } catch (e) {}
        resetText.setText('Score reset!');
        resetText.setFill('#ffffff');
        this.confirmingReset = false;
        triggerHaptic('heavy');
        this.time.delayedCall(1500, () => {
          resetText.setText('Reset High Score');
          resetText.setFill('#ffffff');
        });
      } else {
        // First tap: ask for confirmation
        resetText.setText('Tap again to confirm');
        resetText.setFill('#ffffff');
        this.confirmingReset = true;
        triggerHaptic('light');
        // Auto-cancel after 3 seconds
        this.time.delayedCall(3000, () => {
          if (this.confirmingReset) {
            this.confirmingReset = false;
            resetText.setText('Reset High Score');
            resetText.setFill('#ffffff');
          }
        });
      }
    });

    // ---- Version info (also the hidden LIMINAL trigger: triple-tap) ----
    const versionText = this.add.text(W / 2, H * 0.68, 'v0.1.0' + (ALPHA_MODE ? ' (Alpha)' : ''), {
      fontSize: '14px', fill: '#ffffff', fontStyle: 'italic',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Persistent indicator if LIMINAL has already been unlocked
    const liminalDot = this.add.text(W / 2, H * 0.72, isLiminalUnlocked() ? '·' : '', {
      fontSize: '18px', fill: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0.6);

    this.versionTaps = 0;
    this.versionTapTimer = null;
    versionText.on('pointerdown', () => {
      this.versionTaps++;
      if (this.versionTapTimer) this.versionTapTimer.remove(false);
      this.versionTapTimer = this.time.delayedCall(900, () => { this.versionTaps = 0; });

      if (this.versionTaps >= 3) {
        this.versionTaps = 0;
        if (this.versionTapTimer) { this.versionTapTimer.remove(false); this.versionTapTimer = null; }
        triggerHaptic('light');
        showSecretCodePrompt((code) => {
          if (code === 'LIMINAL') {
            unlockLiminal();
            liminalDot.setText('·');
            triggerHaptic('heavy');
            this.flashStatus('liminal unlocked', '#ffd700');
          } else if (code === 'UNLIMINAL' || code === 'RESET') {
            lockLiminal();
            liminalDot.setText('');
            triggerHaptic('medium');
            this.flashStatus('liminal locked', '#ffffff');
          } else if (code) {
            this.flashStatus('unknown code', '#ff4444');
          }
        });
      }
    });

    // ---- Back button ----
    createButton(this, W / 2, H * 0.82, 'BACK', '#0f3460', () => {
      this.scene.start('TitleScene');
    });
  }

  flashStatus(message, color) {
    const W = this.scale.width;
    const H = this.scale.height;
    const status = this.add.text(W / 2, H * 0.76, message, {
      fontSize: '14px', fill: color || '#ffffff', fontStyle: 'italic',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: status,
      alpha: 1,
      duration: 220,
      yoyo: true,
      hold: 1400,
      onComplete: () => status.destroy(),
    });
  }

  createToggle(x, y, label, initialValue, onChange) {
    const W = this.scale.width;

    // Label text (left-aligned)
    this.add.text(W * 0.15, y, label, {
      fontSize: '24px', fill: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    // Toggle track
    const trackW = 60;
    const trackH = 32;
    const trackX = W * 0.75;
    const trackR = trackH / 2;

    const track = this.add.graphics();
    const thumb = this.add.circle(0, y, 13, 0xffffff);

    let isOn = initialValue;

    const drawState = () => {
      track.clear();
      if (isOn) {
        track.fillStyle(0xffffff, 1);
      } else {
        track.fillStyle(0x333333, 1);
      }
      track.fillRoundedRect(trackX - trackW / 2, y - trackH / 2, trackW, trackH, trackR);
      thumb.x = isOn ? trackX + trackW / 2 - 16 : trackX - trackW / 2 + 16;
    };

    drawState();

    // Hit zone for the toggle
    const hitZone = this.add.zone(trackX, y, trackW + 20, trackH + 20)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerdown', () => {
      isOn = !isOn;
      // Animate thumb
      this.tweens.add({
        targets: thumb,
        x: isOn ? trackX + trackW / 2 - 16 : trackX - trackW / 2 + 16,
        duration: 150,
        ease: 'Cubic.easeOut',
      });
      // Redraw track after a tick so it looks smooth
      this.time.delayedCall(50, () => drawState());
      triggerHaptic('light');
      onChange(isOn);
    });
  }
}
