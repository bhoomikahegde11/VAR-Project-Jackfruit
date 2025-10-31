import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ====================================================================
// SCENE SETUP
// ====================================================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(0, 1, 1);
scene.add(light);

// ====================================================================
// CAMERA & CONTROLS
// ====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enablePan = false;
controls.enableZoom = true;

const cameraSpeed = 0.5;
const rotationSpeed = 0.02;
const keys = {};
let cameraAngle = 0;

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function updateCamera() {
  if (keys['arrowleft']) cameraAngle -= rotationSpeed;
  if (keys['arrowright']) cameraAngle += rotationSpeed;

  const radius = camera.position.length();
  camera.position.x = Math.sin(cameraAngle) * radius;
  camera.position.z = Math.cos(cameraAngle) * radius;
  camera.lookAt(0, 0, 0);
}

// ====================================================================
// CLOTH SETUP
// ====================================================================
const clothWidth = 20, clothHeight = 15, segments = 30;
const clothGeometry = new THREE.PlaneGeometry(clothWidth, clothHeight, segments, segments);

// Load texture
const textureLoader = new THREE.TextureLoader();
const clothTexture = textureLoader.load('./cloth_texture.jpg'); // place your image file in same folder

// Two materials: wireframe & textured
const wireMaterial = new THREE.MeshPhongMaterial({
  color: 0xaaaaaa,
  side: THREE.DoubleSide,
  wireframe: true,
});

const textureMaterial = new THREE.MeshPhongMaterial({
  map: clothTexture,
  side: THREE.DoubleSide,
});

let clothMaterial = wireMaterial;
const clothMesh = new THREE.Mesh(clothGeometry, clothMaterial);
scene.add(clothMesh);

let showTexture = false; // toggle state

// ====================================================================
// PHYSICS SETUP
// ====================================================================
const gravity = new THREE.Vector3(0, -9.8, 0);
const timeStep = 1 / 60;
const particles = [];
const posAttr = clothGeometry.attributes.position.array;

for (let i = 0; i < posAttr.length; i += 3) {
  const pos = new THREE.Vector3(posAttr[i], posAttr[i + 1], posAttr[i + 2]);
  particles.push({
    position: pos.clone(),
    prevPosition: pos.clone(),
    velocity: new THREE.Vector3(),
    invMass: 1.0,
  });
}

const constraints = [];
const restDistance = clothWidth / segments;
const tearDistance = restDistance * 2.5;

for (let i = 0; i <= segments; i++) {
  for (let j = 0; j <= segments; j++) {
    const index = j + i * (segments + 1);
    if (j < segments)
      constraints.push([particles[index], particles[index + 1], restDistance]);
    if (i < segments)
      constraints.push([particles[index], particles[index + (segments + 1)], restDistance]);
  }
}

// Pin the top row
for (let i = 0; i <= segments; i++) {
  particles[i].invMass = 0;
}

// ====================================================================
// MOUSE INTERACTION
// ====================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedParticle = null;

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown() {
  raycaster.setFromCamera(mouse, camera);
  let closestDist = Infinity;

  for (const particle of particles) {
    if (particle.invMass === 0) continue;
    const dist = raycaster.ray.distanceToPoint(particle.position);
    if (dist < closestDist && dist < 1.0) {
      closestDist = dist;
      selectedParticle = particle;
    }
  }

  if (selectedParticle) controls.enabled = false;
}

function onMouseUp() {
  selectedParticle = null;
  controls.enabled = true;
}

// ====================================================================
// TOGGLE WIREFRAME / TEXTURE
// ====================================================================
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 't') {
    showTexture = !showTexture;
    clothMesh.material = showTexture ? textureMaterial : wireMaterial;
  }
});

// ====================================================================
// SIMULATION LOOP
// ====================================================================
function simulate() {
  for (const p of particles) {
    if (!p.invMass) continue;
    p.velocity.add(gravity.clone().multiplyScalar(timeStep));
    p.prevPosition.copy(p.position);
    p.position.add(p.velocity.clone().multiplyScalar(timeStep));
  }

  // B. Mouse drag (stable and view-aligned)
if (selectedParticle) {
  raycaster.setFromCamera(mouse, camera);

  // Create a plane perpendicular to the camera direction
  const dragPlane = new THREE.Plane();
  dragPlane.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
    selectedParticle.position
  );

  const targetPos = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, targetPos);

  if (targetPos) {
    // Compute smooth drag toward target
    const diff = new THREE.Vector3().subVectors(targetPos, selectedParticle.position);
    const distanceDiff = diff.length();

    const dragStrength = 0.25;
    const maxDragDistance = 3.0;

    if (distanceDiff > maxDragDistance) {
      diff.normalize().multiplyScalar(maxDragDistance);
    }

    selectedParticle.position.add(diff.multiplyScalar(dragStrength));
    selectedParticle.velocity.multiplyScalar(0.8);
  }
}


const solverIterations = 8; // more precise, less stretchy
const stiffness = 0.4;     // moderate stiffness

for (let iter = 0; iter < solverIterations; iter++) {
  for (let j = constraints.length - 1; j >= 0; j--) {
    const [p1, p2, restDist] = constraints[j];
    const delta = new THREE.Vector3().subVectors(p2.position, p1.position);
    const currentDist = delta.length();

    if (currentDist > tearDistance) {
      constraints.splice(j, 1);
      continue;
    }

    const diff = (currentDist - restDist) / currentDist;
    const correction = delta.multiplyScalar(stiffness * diff);
    if (p1.invMass > 0) p1.position.add(correction);
    if (p2.invMass > 0) p2.position.sub(correction);
  }
}


  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.invMass > 0)
      p.velocity.subVectors(p.position, p.prevPosition).divideScalar(timeStep);
      p.velocity.multiplyScalar(0.97); // adds weight

    posAttr[i * 3] = p.position.x;
    posAttr[i * 3 + 1] = p.position.y;
    posAttr[i * 3 + 2] = p.position.z;
  }

  clothGeometry.attributes.position.needsUpdate = true;
  clothGeometry.computeVertexNormals();
}

// ====================================================================
// ANIMATION LOOP
// ====================================================================
function animate() {
  requestAnimationFrame(animate);
  simulate();
  updateCamera();
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ====================================================================
// RESIZE HANDLER
// ====================================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
