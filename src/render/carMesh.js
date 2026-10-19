// Carro en la escena: modelo 3D + animación (ruedas, luces, nitro).
// El frente apunta a +X.
import * as THREE from 'three';
import { buildCarModel } from './carModels.js';

export class CarMesh {
  constructor(car, color, style) {
    const L = car.spec.length;
    this.car = car;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';

    const model = buildCarModel(car.spec, style, color);
    this.group.add(model.group);
    this.wheels = model.wheels;
    this.tailMat = model.tailMat;

    // Llama del nitro.
    this.flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 1.2, 10),
      new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.85 }),
    );
    this.flame.rotation.z = Math.PI / 2;
    this.flame.position.set(-L / 2 - 0.65, 0.25, 0);
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

    this.spin += (car.forwardSpeed / (car.spec.wheelRadius ?? 0.33)) * dt;
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
