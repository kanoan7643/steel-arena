import * as THREE from 'three';

const ARENA_RADIUS = 11;
const ARENA_HEIGHT = 6;

export function createArena(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a323c,
    metalness: 0.85,
    roughness: 0.35,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_RADIUS + 0.4, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff5a2a,
    emissive: 0x4a1408,
    metalness: 0.4,
    roughness: 0.45,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS - 0.15, ARENA_RADIUS + 0.05, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  const plateGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x3a4552,
    metalness: 0.9,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      if (x * x + z * z > 18) continue;
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(x * 2.35, 0.01, z * 2.35);
      plate.receiveShadow = true;
      root.add(plate);
    }
  }

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x9aa8b5,
    metalness: 1,
    roughness: 0.22,
  });
  const barMat = new THREE.MeshStandardMaterial({
    color: 0x6d7b89,
    metalness: 0.95,
    roughness: 0.3,
  });

  const posts = 16;
  for (let i = 0; i < posts; i++) {
    const angle = (i / posts) * Math.PI * 2;
    const x = Math.cos(angle) * ARENA_RADIUS;
    const z = Math.sin(angle) * ARENA_RADIUS;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, ARENA_HEIGHT, 10), postMat);
    post.position.set(x, ARENA_HEIGHT / 2, z);
    post.castShadow = true;
    root.add(post);

    for (let h = 0.7; h < ARENA_HEIGHT; h += 0.85) {
      const next = ((i + 1) / posts) * Math.PI * 2;
      const x2 = Math.cos(next) * ARENA_RADIUS;
      const z2 = Math.sin(next) * ARENA_RADIUS;
      const dx = x2 - x;
      const dz = z2 - z;
      const len = Math.hypot(dx, dz);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), barMat);
      bar.position.set((x + x2) / 2, h, (z + z2) / 2);
      bar.rotation.y = -Math.atan2(dz, dx);
      root.add(bar);
    }
  }

  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 0.3, ARENA_RADIUS + 0.3, 0.2, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1c2430,
      metalness: 0.8,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
  );
  canopy.position.y = ARENA_HEIGHT;
  root.add(canopy);

  const lights = new THREE.Group();
  root.add(lights);

  const spot = new THREE.SpotLight(0xffd7b0, 80, 40, Math.PI / 4.5, 0.45, 1.2);
  spot.position.set(0, 9.5, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  lights.add(spot);
  lights.add(spot.target);

  const warm = new THREE.PointLight(0xff6a38, 18, 28, 2);
  warm.position.set(4, 3.5, -3);
  lights.add(warm);

  const cool = new THREE.PointLight(0x4aa7ff, 10, 24, 2);
  cool.position.set(-5, 3.2, 4);
  lights.add(cool);

  const rimPosts = [
    [ARENA_RADIUS * 0.7, 2.2, 0],
    [-ARENA_RADIUS * 0.55, 2.0, ARENA_RADIUS * 0.55],
    [0, 2.4, -ARENA_RADIUS * 0.7],
  ];
  for (const [x, y, z] of rimPosts) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff8a4c, emissive: 0xff5a2a, emissiveIntensity: 2 }),
    );
    bulb.position.set(x, y, z);
    root.add(bulb);
  }

  const crowd = new THREE.Group();
  root.add(crowd);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x121820, metalness: 0.2, roughness: 0.9 });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = ARENA_RADIUS + 2.2 + (i % 3) * 0.55;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9 + (i % 2) * 0.4, 0.7), seatMat);
    seat.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    seat.lookAt(0, 0.5, 0);
    crowd.add(seat);
  }

  return { root, radius: ARENA_RADIUS, height: ARENA_HEIGHT };
}
