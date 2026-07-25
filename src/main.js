import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

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
