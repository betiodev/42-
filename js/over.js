class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) {
    this.finalScore = data.score || 0;
    this.deathMessage = data.message || '';
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ---- White background ----
    this.cameras.main.setBackgroundColor('#000000');

    // ---- "GAME OVER" header ----
    this.add.text(W / 2, H * 0.10, 'GAME OVER', {
      fontSize: '42px', fill: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5);

    // ---- Score display (big number) ----
    const scoreText = this.add.text(W / 2, H * 0.23, '' + this.finalScore, {
      fontSize: '90px', fill: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5);

    // Entrance animation: score counts up from 0
    let displayScore = { val: 0 };
    this.tweens.add({
      targets: displayScore,
      val: this.finalScore,
      duration: Math.min(1200, this.finalScore * 15),
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        scoreText.setText('' + Math.floor(displayScore.val));
      },
      onComplete: () => {
        scoreText.setText('' + this.finalScore);
      },
    });

    // ---- New high score detection ----
    let yOffset = H * 0.33;
    const isNewHigh = saveHighScore(this.finalScore);
    if (isNewHigh && this.finalScore > 0) {
      const highLabel = this.add.text(W / 2, yOffset, 'NEW HIGH SCORE!', {
        fontSize: '26px', fill: '#ffffff', fontStyle: 'bold',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({
        targets: highLabel,
        alpha: 1, scaleX: 1.1, scaleY: 1.1,
        duration: 500,
        delay: 800,
        ease: 'Back.easeOut',
        yoyo: true,
        hold: 400,
        repeat: 1,
        onComplete: () => {
          highLabel.setAlpha(1).setScale(1);
        },
      });
      yOffset += 40;
    } else {
      // Show existing high score for reference
      const hi = loadHighScore();
      if (hi > 0) {
        this.add.text(W / 2, yOffset, 'High Score: ' + hi, {
          fontSize: '18px', fill: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }).setOrigin(0.5);
        yOffset += 32;
      }
    }

    // ---- Easter egg / death message ----
    // Priority: explicit deathMessage > score easter egg > LIMINAL philosophical fallback
    const easterEgg = EASTER_EGG_SCORES.find(s => s === this.finalScore);
    let msg = this.deathMessage
      || (easterEgg !== undefined ? EASTER_EGG_MESSAGES[easterEgg] : '')
      || '';
    if (!msg && isLiminalUnlocked()) {
      msg = pickLiminalMessage();
    }
    {
      if (msg) {
        const eggText = this.add.text(W / 2, yOffset + 16, msg, {
          fontSize: '22px', fill: '#ffffff', fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
          align: 'center',
          wordWrap: { width: W * 0.8 },
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
          targets: eggText,
          alpha: 1,
          y: eggText.y - 8,
          duration: 700,
          delay: 1200,
          ease: 'Sine.easeOut',
        });
        yOffset += 50;
      }
    }

    // ---- Buttons ----
    const btnY = Math.max(yOffset + 60, H * 0.55);

    // PLAY AGAIN
    createButton(this, W / 2, btnY, 'PLAY AGAIN', '#e94560', () => {
      triggerHaptic('medium');
      this.scene.start('GameScene');
    });

    // SHARE
    createButton(this, W / 2, btnY + 70, 'SHARE SCORE', '#0f3460', () => {
      this.shareScore();
    });

    // ---- Paywall / Unlock button ----
    if (!isProUnlocked()) {
      const proBtn = createButton(this, W / 2, btnY + 145, 'UNLOCK MORE', '#333333', () => {
        this.showPaywall();
      }, { width: 200, height: 48 });

      // Subtle label below
      this.add.text(W / 2, btnY + 178, 'Remove ads & unlock themes', {
        fontSize: '12px', fill: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);
    } else {
      // Pro badge
      this.add.text(W / 2, btnY + 150, 'PRO', {
        fontSize: '14px', fill: '#ffffff', fontStyle: 'bold',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setAlpha(0.6);
    }

    // ---- Title link (small, bottom) ----
    const homeText = this.add.text(W / 2, H * 0.95, '< back to title', {
      fontSize: '16px', fill: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    homeText.on('pointerdown', () => {
      this.scene.start('TitleScene');
    });
  }

  shareScore() {
    const text = 'I scored ' + this.finalScore + ' in 42? Can you beat it?';
    // Try Web Share API first (mobile), fall back to clipboard
    if (navigator.share) {
      navigator.share({ title: '42?', text: text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard!');
      }).catch(() => {
        this.showToast('Share: ' + text);
      });
    } else {
      this.showToast(text);
    }
    triggerHaptic('light');
  }

  showToast(msg) {
    const W = this.scale.width;
    const H = this.scale.height;
    const toast = this.add.text(W / 2, H * 0.88, msg, {
      fontSize: '16px', fill: '#ffffff', backgroundColor: '#222222',
      padding: { x: 16, y: 10 },
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 300,
      yoyo: true,
      hold: 1800,
      onComplete: () => toast.destroy(),
    });
  }

  showPaywall() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, W, H),
      Phaser.Geom.Rectangle.Contains
    );

    // Paywall card
    const cardW = W * 0.85;
    const cardH = 300;
    const cardX = W / 2 - cardW / 2;
    const cardY = H / 2 - cardH / 2;

    const card = this.add.graphics();
    card.fillStyle(0x111111, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 20);

    this.add.text(W / 2, cardY + 36, '42? PRO', {
      fontSize: '30px', fill: '#ffffff', fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif',
    }).setOrigin(0.5);

    this.add.text(W / 2, cardY + 80, 'Remove ads\nUnlock color themes\nExtra game modes', {
      fontSize: '18px', fill: '#ffffff', align: 'center',
      lineSpacing: 8,
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    if (ALPHA_MODE) {
      // In alpha, let testers unlock for free
      createButton(this, W / 2, cardY + 170, 'UNLOCK (FREE ALPHA)', '#e94560', () => {
        unlockPro();
        // Remove overlay and refresh
        overlay.destroy();
        card.destroy();
        this.scene.restart({ score: this.finalScore });
      }, { width: 260 });

      this.add.text(W / 2, cardY + 210, 'Free during alpha testing', {
        fontSize: '12px', fill: '#ffffff', fontStyle: 'italic',
        fontFamily: 'Arial, sans-serif',
      }).setOrigin(0.5);
    } else {
      createButton(this, W / 2, cardY + 170, 'COMING SOON', '#cccccc', () => {
        // No-op in non-alpha release without payment integration
      }, { width: 220, textColor: '#666666' });
    }

    // Close / dismiss
    const closeText = this.add.text(W / 2, cardY + cardH - 24, 'Maybe later', {
      fontSize: '15px', fill: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeText.on('pointerdown', () => {
      overlay.destroy();
      card.destroy();
      closeText.destroy();
    });
  }
}
