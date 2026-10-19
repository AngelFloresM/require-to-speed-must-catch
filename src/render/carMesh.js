// Modelo low-poly del carro hecho con cajas y cilindros. El frente apunta a +X.
import * as THREE from 'three';

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
wheelGeo.rotateX(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
const lightGeo = new THREE.BoxGeometry(0.05, 0.14, 0.4);
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });

export class CarMesh {
  constructor(car, color) {
    const { length: L, width: W } = car.spec;
    this.car = car;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';

    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.55, W), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    this.group.add(body);

    const cabinH = Math.max(0.35, (car.spec.height ?? 1.25) - 0.83);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, cabinH, W * 0.82), glassMat);
    cabin.position.set(-L * 0.05, 0.82 + cabinH / 2, 0);
    cabin.castShadow = true;
    this.group.add(cabin);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, W * 0.95), bodyMat);
    spoiler.position.set(-L / 2 + 0.2, 1.12, 0);
    this.group.add(spoiler);

    this.wheels = [];
    const a = car.spec.cgToFront;
    const b = car.spec.cgToRear;
    for (const [x, z, front] of [[a, W / 2 - 0.1, true], [a, -W / 2 + 0.1, true], [-b, W / 2 - 0.1, false], [-b, -W / 2 + 0.1, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.34, z);
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      pivot.add(w);
      this.group.add(pivot);
      this.wheels.push({ pivot, mesh: w, front });
    }

    for (const z of [W / 2 - 0.3, -W / 2 + 0.3]) {
      const h = new THREE.Mesh(lightGeo, headMat);
      h.position.set(L / 2 + 0.01, 0.6, z);
      this.group.add(h);
    }
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
    for (const z of [W / 2 - 0.3, -W / 2 + 0.3]) {
      const t = new THREE.Mesh(lightGeo, this.tailMat);
      t.position.set(-L / 2 - 0.01, 0.62, z);
      this.group.add(t);
    }

    // Llama del nitro.
    this.flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.85 }),
    );
    this.flame.rotation.z = Math.PI / 2;
    this.flame.position.set(-L / 2 - 0.6, 0.4, 0);
    this.flame.visible = false;
    this.group.add(this.flame);

    this.spin = 0;
  }

  sync(dt) {
    const car = this.car;
    this.group.position.set(car.x, 0, -car.y);
    this.group.rotation.y = car.heading;
    // Inclinación ligera en curvas para dar sensación de peso.
    this.group.rotation.x = Math.max(-0.05, Math.min(0.05, car.yawRate * car.forwardSpeed * 0.0012));

    this.spin += (car.forwardSpeed / 0.34) * dt;
    for (const w of this.wheels) {
      w.mesh.rotation.z = -this.spin;
      if (w.front) w.pivot.rotation.y = car.steer;
    }
    const braking = car.input.brake > 0 && car.forwardSpeed > 0.5;
    this.tailMat.color.setHex(braking ? 0xff2020 : 0x550000);
    this.flame.visible = car.nitroActive;
    if (car.nitroActive) this.flame.scale.y = 0.8 + Math.random() * 0.5;
  }
}
