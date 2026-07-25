/** Difficulty presets — easy is default. */
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: '簡單',
    enemySpeed: 2.4,
    enemyDamageMul: 0.65,
    enemyAttackDelay: [1.35, 2.1],
    enemyBlockChance: 0.22,
    enemyProactiveBlock: 0.003,
    enemyHp: 85,
    playerDamageMul: 1.25,
  },
  normal: {
    id: 'normal',
    label: '普通',
    enemySpeed: 3.2,
    enemyDamageMul: 1,
    enemyAttackDelay: [0.85, 1.45],
    enemyBlockChance: 0.45,
    enemyProactiveBlock: 0.007,
    enemyHp: 100,
    playerDamageMul: 1,
  },
  hard: {
    id: 'hard',
    label: '困難',
    enemySpeed: 3.9,
    enemyDamageMul: 1.25,
    enemyAttackDelay: [0.55, 1.0],
    enemyBlockChance: 0.62,
    enemyProactiveBlock: 0.012,
    enemyHp: 120,
    playerDamageMul: 0.9,
  },
};

export const COLLIDE_RADIUS = 1.05;
