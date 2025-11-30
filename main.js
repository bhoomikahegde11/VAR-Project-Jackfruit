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
let clothGeometry = new THREE.PlaneGeometry(clothWidth, clothHeight, segments, segments);

const wireMaterial = new THREE.MeshPhongMaterial({
  color: 0xaaaaaa,
  side: THREE.DoubleSide,
  wireframe: true,
});

const textureMaterial = new THREE.MeshPhongMaterial({
  color: 0xdddddd,
  side: THREE.DoubleSide,
});

let clothMaterial = wireMaterial;
let clothMesh = new THREE.Mesh(clothGeometry, clothMaterial);
scene.add(clothMesh);

let showTexture = false;

// ====================================================================
// PHYSICS SETUP
// ====================================================================
const gravity = new THREE.Vector3(0, -9.8, 0);
const timeStep = 1 / 60;
let particles = [];
let constraints = [];
const restDistance = clothWidth / segments;
const tearDistance = restDistance * 2.5;

function initializePhysics() {
  particles = [];
  constraints = [];
  
  const posAttr = clothGeometry.attributes.position;
  
  // Create particles for each vertex
  for (let i = 0; i < posAttr.count; i++) {
    const pos = new THREE.Vector3(
      posAttr.getX(i),
      posAttr.getY(i),
      posAttr.getZ(i)
    );
    
    particles.push({
      position: pos.clone(),
      prevPosition: pos.clone(),
      velocity: new THREE.Vector3(),
      invMass: 1.0,
    });
  }

  // Create constraints from the index
  const index = clothGeometry.index;
  const edgeSet = new Set();
  
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);
    
    addEdge(i0, i1, edgeSet);
    addEdge(i1, i2, edgeSet);
    addEdge(i2, i0, edgeSet);
  }

  // Pin the top row
  for (let i = 0; i <= segments; i++) {
    particles[i].invMass = 0;
  }
}

function addEdge(i0, i1, edgeSet) {
  const key = i0 < i1 ? `${i0}-${i1}` : `${i1}-${i0}`;
  if (edgeSet.has(key)) return;
  edgeSet.add(key);
  
  const p0 = particles[i0];
  const p1 = particles[i1];
  const dist = p0.position.distanceTo(p1.position);
  constraints.push({ p0: i0, p1: i1, restDist: dist });
}

initializePhysics();

// ====================================================================
// CUTTING SYSTEM
// ====================================================================
let isCuttingMode = false;
let cutPath = [];
const cutVisualLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
);
scene.add(cutVisualLine);

const modeIndicator = document.createElement('div');
modeIndicator.style.position = 'absolute';
modeIndicator.style.top = '10px';
modeIndicator.style.left = '10px';
modeIndicator.style.color = 'white';
modeIndicator.style.fontFamily = 'monospace';
modeIndicator.style.fontSize = '14px';
modeIndicator.style.padding = '10px';
modeIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
modeIndicator.style.borderRadius = '5px';
modeIndicator.innerHTML = `
  <strong>Controls:</strong><br>
  SPACE - Toggle Cutting Mode (OFF)<br>
  T - Toggle Texture/Wireframe<br>
  Arrow Keys - Rotate Camera<br>
  <br>
  <span id="modeText">DRAG MODE: Click & drag cloth</span>
`;
document.body.appendChild(modeIndicator);

function updateModeIndicator() {
  const modeText = document.getElementById('modeText');
  if (isCuttingMode) {
    modeText.innerHTML = '<strong style="color: #ff4444;">CUTTING MODE: Draw to cut</strong>';
    document.getElementById('modeText').parentElement.children[0].innerHTML = 
      'SPACE - Toggle Cutting Mode (<strong style="color: #ff4444;">ON</strong>)';
  } else {
    modeText.innerHTML = 'DRAG MODE: Click & drag cloth';
    document.getElementById('modeText').parentElement.children[0].innerHTML = 
      'SPACE - Toggle Cutting Mode (OFF)';
  }
}

// ====================================================================
// MOUSE INTERACTION
// ====================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedParticle = null;
let isDrawingCut = false;

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (isCuttingMode && isDrawingCut) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(clothMesh);
    
    if (intersects.length > 0) {
      cutPath.push(intersects[0].point.clone());
      updateCutVisual();
    }
  }
}

function onMouseDown() {
  if (isCuttingMode) {
    isDrawingCut = true;
    cutPath = [];
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(clothMesh);
    
    if (intersects.length > 0) {
      cutPath.push(intersects[0].point.clone());
    }
  } else {
    raycaster.setFromCamera(mouse, camera);
    let closestDist = Infinity;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      if (particle.invMass === 0) continue;
      const dist = raycaster.ray.distanceToPoint(particle.position);
      if (dist < closestDist && dist < 1.0) {
        closestDist = dist;
        selectedParticle = i;
      }
    }

    if (selectedParticle !== null) controls.enabled = false;
  }
}

function onMouseUp() {
  if (isCuttingMode && isDrawingCut) {
    performCut();
    isDrawingCut = false;
    cutPath = [];
    updateCutVisual();
  } else {
    selectedParticle = null;
    controls.enabled = true;
  }
}

function updateCutVisual() {
  if (cutPath.length > 0) {
    const positions = new Float32Array(cutPath.length * 3);
    cutPath.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });
    cutVisualLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    cutVisualLine.visible = true;
  } else {
    cutVisualLine.visible = false;
  }
}


function performCut() {
  if (cutPath.length < 2) return;

  // 1. SNAP RADIUS: Slightly larger to catch fast movements
  const cutRadius = 1.0; 
  const verticesNearCut = new Set();
  const constraintsToCut = new Set();

  // Helper to snap a specific particle index to the line
  const snapParticleToLine = (index) => {
    if (verticesNearCut.has(index)) return; // Already processed
    
    const particle = particles[index];
    let closestDist = Infinity;
    let bestPoint = null;

    // Find closest point on the entire cut path
    for (let j = 0; j < cutPath.length - 1; j++) {
      const segStart = cutPath[j];
      const segEnd = cutPath[j + 1];
      const point = getClosestPointOnSegment(particle.position, segStart, segEnd);
      const dist = point.distanceTo(particle.position);
      
      if (dist < closestDist) {
        closestDist = dist;
        bestPoint = point;
      }
    }

    // If close enough (or forced by edge intersection), snap it
    if (bestPoint) {
        // Move visual position
        particle.position.lerp(bestPoint, 0.8);
        particle.prevPosition.copy(particle.position);
        verticesNearCut.add(index);
    }
  };

  // ---------------------------------------------------------
  // PHASE 1: PRE-SNAP
  // Snap vertices that are explicitly near the mouse path
  // ---------------------------------------------------------
  for (let i = 0; i < particles.length; i++) {
     const particle = particles[i];
     for (let j = 0; j < cutPath.length - 1; j++) {
        if (distanceToSegment(particle.position, cutPath[j], cutPath[j+1]) < cutRadius) {
            snapParticleToLine(i);
            break; 
        }
     }
  }

  // ---------------------------------------------------------
  // PHASE 2: AGGRESSIVE INTERSECTION TEST
  // Check ALL constraints. If we cross a line, CUT IT.
  // ---------------------------------------------------------
  for (let i = 0; i < constraints.length; i++) {
    const constraint = constraints[i];
    const p0Pos = particles[constraint.p0].position;
    const p1Pos = particles[constraint.p1].position;
    
    let intersected = false;

    // Check if this spring crosses the cut path
    for (let j = 0; j < cutPath.length - 1; j++) {
      if (doSegmentsIntersect(p0Pos, p1Pos, cutPath[j], cutPath[j + 1])) {
        intersected = true;
        break;
      }
    }

    // If it intersects, or if both points are already snapped (collinear cut)
    const bothSnapped = verticesNearCut.has(constraint.p0) && verticesNearCut.has(constraint.p1);

    if (intersected || bothSnapped) {
      constraintsToCut.add(i);
      
      // FORCE SNAP: If we cut this edge, we snap its vertices 
      // to ensure the cut looks smooth, even if they were far away.
      snapParticleToLine(constraint.p0);
      snapParticleToLine(constraint.p1);
    }
  }

  if (constraintsToCut.size === 0) return;

  // ---------------------------------------------------------
  // PHASE 3: DUPLICATE GEOMETRY
  // ---------------------------------------------------------
  const oldPositions = clothGeometry.attributes.position;
  const oldIndices = clothGeometry.index;
  const newPositions = [];
  const newIndices = [];
  
  // Copy existing positions
  for (let i = 0; i < oldPositions.count; i++) {
    newPositions.push(oldPositions.getX(i), oldPositions.getY(i), oldPositions.getZ(i));
  }

  // Map to track duplicates
  const vertexMap = new Map(); 

  for (const vertIdx of verticesNearCut) {
    const newIdx1 = newPositions.length / 3;
    const newIdx2 = newIdx1 + 1;
    
    vertexMap.set(vertIdx, [newIdx1, newIdx2]);
    
    // Duplicate position twice
    const p = particles[vertIdx].position;
    newPositions.push(p.x, p.y, p.z);
    newPositions.push(p.x, p.y, p.z);
    
    // Duplicate Physics Particle twice
    const oldP = particles[vertIdx];
    const createP = () => ({
      position: oldP.position.clone(),
      prevPosition: oldP.prevPosition.clone(),
      velocity: oldP.velocity.clone(),
      invMass: oldP.invMass
    });
    particles.push(createP());
    particles.push(createP());
  }

  // ---------------------------------------------------------
  // PHASE 4: REBUILD TOPOLOGY 
  // ---------------------------------------------------------
  for (let i = 0; i < oldIndices.count; i += 3) {
    const i0 = oldIndices.getX(i);
    const i1 = oldIndices.getX(i + 1);
    const i2 = oldIndices.getX(i + 2);
    
    // Calculate Triangle Centroid
    const centroid = new THREE.Vector3()
      .addVectors(particles[i0].position, particles[i1].position)
      .add(particles[i2].position)
      .multiplyScalar(1/3);

    // Find the closest segment of the cut path to this triangle 
    let bestSide = 0;
    let minDistance = Infinity;

    // We check which segment of the curve is closest to this specific triangle
    for (let j = 0; j < cutPath.length - 1; j++) {
      const segStart = cutPath[j];
      const segEnd = cutPath[j + 1];
      
      // Get distance to this specific segment
      const dist = distanceToSegment(centroid, segStart, segEnd);
      
      if (dist < minDistance) {
        minDistance = dist;
        
        // Check side relative to this segment only
        const segDir = new THREE.Vector3().subVectors(segEnd, segStart);
        const toCentroid = new THREE.Vector3().subVectors(centroid, segStart);
        const cross = new THREE.Vector3().crossVectors(segDir, toCentroid);
        
        bestSide = cross.z > 0 ? 0 : 1;
      }
    }

    // Remap vertices based on the side calculation
    const map = (id) => {
      if (vertexMap.has(id)) {
        // If the vertex was duplicated, pick the copy that matches the triangle's side
        return vertexMap.get(id)[bestSide];
      }
      return id;
    };

    newIndices.push(map(i0), map(i1), map(i2));
  }

  // ---------------------------------------------------------
  // PHASE 5: UPDATE MESH & PHYSICS
  // ---------------------------------------------------------
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  newGeometry.setIndex(newIndices);
  newGeometry.computeVertexNormals();
  
  clothMesh.geometry.dispose();
  clothMesh.geometry = newGeometry;
  clothGeometry = newGeometry;

  rebuildPhysicsConstraints();
}

// --- HELPER FUNCTIONS ---

function getClosestPointOnSegment(point, segStart, segEnd) {
  const segDir = new THREE.Vector3().subVectors(segEnd, segStart);
  const segLength = segDir.length();
  if (segLength < 0.001) return segStart.clone();
  
  segDir.normalize();
  const toPoint = new THREE.Vector3().subVectors(point, segStart);
  const t = Math.max(0, Math.min(segLength, toPoint.dot(segDir)));
  
  return new THREE.Vector3().copy(segStart).add(segDir.multiplyScalar(t));
}

function rebuildPhysicsConstraints() {
  constraints = [];
  const index = clothGeometry.index;
  const edgeSet = new Set();

  // Rebuild springs from new geometry
  for (let i = 0; i < index.count; i += 3) {
    const i0 = index.getX(i);
    const i1 = index.getX(i + 1);
    const i2 = index.getX(i + 2);

    const add = (a, b) => {
      if (a >= particles.length || b >= particles.length) return;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      
      const p0 = particles[a];
      const p1 = particles[b];
      const dist = p0.position.distanceTo(p1.position);
      constraints.push({ p0: a, p1: b, restDist: dist });
    };

    add(i0, i1);
    add(i1, i2);
    add(i2, i0);
  }
  
  // Re-pin top row based on Y height (since indices changed)
  const pinThreshold = (clothHeight / 2) - 1.0; 
  
  for(let p of particles) {
      // If particle is near the top, pin it
      if(p.position.y > pinThreshold) {
          p.invMass = 0;
      }
  }
}


function addPhysicsEdge(i0, i1, edgeSet) {
  const key = i0 < i1 ? `${i0}-${i1}` : `${i1}-${i0}`;
  if (edgeSet.has(key)) return;
  edgeSet.add(key);
  
  // Make sure particle indices are valid
  if (i0 >= particles.length || i1 >= particles.length) {
    console.warn(`Invalid particle indices: ${i0}, ${i1}. Particles length: ${particles.length}`);
    return;
  }
  
  const p0 = particles[i0];
  const p1 = particles[i1];
  const dist = p0.position.distanceTo(p1.position);
  constraints.push({ p0: i0, p1: i1, restDist: dist });
}

function distanceToSegment(point, segStart, segEnd) {
  const segDir = new THREE.Vector3().subVectors(segEnd, segStart);
  const segLength = segDir.length();
  
  if (segLength < 0.001) return point.distanceTo(segStart);
  
  segDir.normalize();
  const toPoint = new THREE.Vector3().subVectors(point, segStart);
  const t = Math.max(0, Math.min(segLength, toPoint.dot(segDir)));
  
  const closestPoint = new THREE.Vector3()
    .copy(segStart)
    .add(segDir.multiplyScalar(t));
  
  return point.distanceTo(closestPoint);
}

function doSegmentsIntersect(p1, p2, p3, p4) {
  // 2D intersection test in XY plane
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return false;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ====================================================================
// TOGGLE MODES
// ====================================================================
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 't') {
    showTexture = !showTexture;
    clothMesh.material = showTexture ? textureMaterial : wireMaterial;
  }
  
  if (e.key === ' ') {
    e.preventDefault();
    isCuttingMode = !isCuttingMode;
    updateModeIndicator();
    
    if (!isCuttingMode) {
      cutPath = [];
      updateCutVisual();
    }
  }
});

// ====================================================================
// SIMULATION LOOP
// ====================================================================
function simulate() {
  // Apply forces
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.invMass) continue;
    p.velocity.add(gravity.clone().multiplyScalar(timeStep));
    p.prevPosition.copy(p.position);
    p.position.add(p.velocity.clone().multiplyScalar(timeStep));
  }

  // Mouse drag
  if (selectedParticle !== null && !isCuttingMode) {
    raycaster.setFromCamera(mouse, camera);

    const dragPlane = new THREE.Plane();
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).clone().negate(),
      particles[selectedParticle].position
    );

    const targetPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, targetPos);

    if (targetPos) {
      const diff = new THREE.Vector3().subVectors(targetPos, particles[selectedParticle].position);
      const distanceDiff = diff.length();

      const dragStrength = 0.25;
      const maxDragDistance = 3.0;

      if (distanceDiff > maxDragDistance) {
        diff.normalize().multiplyScalar(maxDragDistance);
      }

      particles[selectedParticle].position.add(diff.multiplyScalar(dragStrength));
      particles[selectedParticle].velocity.multiplyScalar(0.8);
    }
  }

  // Constraint solver
  const solverIterations = 8;
  const stiffness = 0.4;

  for (let iter = 0; iter < solverIterations; iter++) {
    for (let j = constraints.length - 1; j >= 0; j--) {
      const constraint = constraints[j];
      
      // Check if particle indices are valid
      if (constraint.p0 >= particles.length || constraint.p1 >= particles.length) {
        constraints.splice(j, 1);
        continue;
      }
      
      const p1 = particles[constraint.p0];
      const p2 = particles[constraint.p1];
      
      const delta = new THREE.Vector3().subVectors(p2.position, p1.position);
      const currentDist = delta.length();

      // Physics-based tearing
      if (currentDist > tearDistance) {
        constraints.splice(j, 1);
        continue;
      }

      const diff = (currentDist - constraint.restDist) / currentDist;
      const correction = delta.multiplyScalar(stiffness * diff);
      if (p1.invMass > 0) p1.position.add(correction);
      if (p2.invMass > 0) p2.position.sub(correction);
    }
  }

  // Update geometry to match physics
  const posAttr = clothGeometry.attributes.position;
  for (let i = 0; i < Math.min(particles.length, posAttr.count); i++) {
    const p = particles[i];
    
    if (p.invMass > 0) {
      p.velocity.subVectors(p.position, p.prevPosition).divideScalar(timeStep);
      p.velocity.multiplyScalar(0.97);
    }

    posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);
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