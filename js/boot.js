// ============================================================
//  PHASER GAME CONFIG
// ============================================================
const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,          // iPhone 14 logical width
    height: 844,         // iPhone 14 logical height
    parent: document.body,
  },
  backgroundColor: '#000000',
  scene: [TitleScene, GameScene, GameOverScene, SettingsScene],
  input: {
    activePointers: 3,   // Support multi-touch
  },
  physics: {
    default: 'arcade',
    arcade: { debug: ALPHA_MODE },
  },
};

const game = new Phaser.Game(config);
