import { Game } from './game.js';
import { prefersTouch } from './touch.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

if (prefersTouch()) {
  document.body.classList.add('touch-ui');
  document.getElementById('hint')?.classList.add('hidden');
  document.getElementById('hint-mobile')?.classList.remove('hidden');
}

const diffBtns = document.querySelectorAll('.diff-btn');
diffBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    diffBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    game.setDifficulty(btn.dataset.diff);
  });
});

document.getElementById('start-btn').addEventListener('click', () => {
  game.start();
});

document.getElementById('retry-btn').addEventListener('click', () => {
  game.restart();
});

document.getElementById('menu-btn').addEventListener('click', () => {
  game.goToMenu();
});

window.addEventListener('resize', () => game.resize());

// Reduce browser chrome gestures interrupting fights on phones
document.addEventListener(
  'touchmove',
  (e) => {
    if (document.body.classList.contains('touch-ui') && e.target.closest('#touch-controls')) {
      e.preventDefault();
    }
  },
  { passive: false },
);
