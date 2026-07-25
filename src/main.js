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

const onViewportChange = () => game.resize();
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', () => {
  // iOS often reports the old size until the rotation settles
  setTimeout(onViewportChange, 120);
  setTimeout(onViewportChange, 320);
});
window.visualViewport?.addEventListener('resize', onViewportChange);
window.visualViewport?.addEventListener('scroll', onViewportChange);
game.resize();

// Block page scroll / bounce while fighting on phones
document.addEventListener(
  'touchmove',
  (e) => {
    if (!document.body.classList.contains('touch-ui')) return;
    if (e.target.closest('#title-screen, #result-screen')) return;
    e.preventDefault();
  },
  { passive: false },
);
