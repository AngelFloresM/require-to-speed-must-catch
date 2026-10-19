// Carros de tráfico y semáforos con mallas instanciadas: pocas llamadas de
// dibujo aunque haya decenas de carros y cientos de focos.
import * as THREE from 'three';
import { CARS } from '../data/cars.js';
import { carShellGeometries } from './carModels.js';
import { lightFor, approachHeading } from '../city/signals.js';

const PAINT = [0xf2f2f2, 0x1d1d1d, 0x9aa0a6, 0xb03a2e, 0x2e5c9a, 0xd9c27a, 0x2f6b4f, 0x6d4c8a];

export class TrafficMesh {
  constructor(traffic) {
    this.traffic = traffic;
    this.group = new THREE.Group();
    const n = traffic.cars.length;
    // Cada carro de tráfico usa uno de los modelos del juego, con color al azar.
    this.styles = CARS.map((car) => {
      const { body, cabin } = carShellGeometries(car.physics, car.model);
      const cars = traffic.cars.filter((c) => c.id % CARS.length === CARS.indexOf(car));
      const bodyMesh = new THREE.InstancedMesh(body, new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 }), Math.max(1, cars.length));
      const cabinMesh = new THREE.InstancedMesh(cabin, new THREE.MeshPhongMaterial({ color: 0x141c26, shininess: 90 }), Math.max(1, cars.length));
      bodyMesh.castShadow = cabinMesh.castShadow = true;
      const color = new THREE.Color();
      cars.forEach((c, i) => bodyMesh.setColorAt(i, color.setHex(PAINT[(c.id * 5) % PAINT.length])));
      bodyMesh.count = cabinMesh.count = cars.length;
      this.group.add(bodyMesh, cabinMesh);
      return { cars, bodyMesh, cabinMesh, spec: car.physics };
    });
    const tire = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12);
    tire.rotateX(Math.PI / 2);
    this.wheels = new THREE.InstancedMesh(tire, new THREE.MeshLambertMaterial({ color: 0x151515 }), n * 4);
    this.group.add(this.wheels);
    this.m = new THREE.Matrix4();
    this.w = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.one = new THREE.Vector3(1, 1, 1);
    this.update();
  }

  update() {
    const { m, w, q, up, one } = this;
    let wi = 0;
    for (const st of this.styles) {
      const { spec } = st;
      st.cars.forEach((c, i) => {
        q.setFromAxisAngle(up, c.h);
        m.compose(new THREE.Vector3(c.x, 0, -c.y), q, one);
        st.bodyMesh.setMatrixAt(i, m);
        st.cabinMesh.setMatrixAt(i, m);
        for (const [x, z] of [[spec.cgToFront, 1], [spec.cgToFront, -1], [-spec.cgToRear, 1], [-spec.cgToRear, -1]]) {
          w.makeTranslation(x, 0.33, z * (spec.width / 2 - 0.15));
          this.wheels.setMatrixAt(wi++, w.premultiply(m));
        }
      });
      st.bodyMesh.instanceMatrix.needsUpdate = true;
      st.cabinMesh.instanceMatrix.needsUpdate = true;
    }
    this.wheels.instanceMatrix.needsUpdate = true;
  }
}

const ON = { red: 0xff2a2a, yellow: 0xffc22a, green: 0x2aff6a };
const OFF = { red: 0x3a1010, yellow: 0x3a3010, green: 0x103a1a };

// Un semáforo por cada acceso a un cruce con semáforo, a la derecha.
export class SignalMesh {
  constructor(city) {
    this.heads = [];
    for (const node of city.signals) {
      const r = Math.max(...node.edges.map((e) => e.road.width / 2)) + 2;
      for (const e of node.edges) {
        const toward = e.b === node ? 1 : -1;
        if (e.road.oneway && e.road.oneway !== toward) continue; // nadie llega por aquí
        const h = approachHeading(e, node);
        const back = r + 0.5;
        const side = e.road.width / 2 + 0.8;
        const x = node.x - Math.cos(h) * back + Math.sin(h) * side;
        const y = node.y - Math.sin(h) * back - Math.cos(h) * side;
        this.heads.push({ node, edge: e, x, y, h, state: null });
      }
    }
    const n = this.heads.length;
    this.group = new THREE.Group();
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }), n);
    const box = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 1.1, 0.4), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }), n);
    this.lamps = {};
    const ball = new THREE.SphereGeometry(0.13, 8, 6);
    for (const k of ['red', 'yellow', 'green']) {
      this.lamps[k] = new THREE.InstancedMesh(ball, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
      this.group.add(this.lamps[k]);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();
    this.heads.forEach((hd, i) => {
      q.setFromAxisAngle(up, hd.h);
      const base = new THREE.Matrix4().compose(new THREE.Vector3(hd.x, 0, -hd.y), q, one);
      pole.setMatrixAt(i, m.makeTranslation(0, 2.1, 0).premultiply(base));
      box.setMatrixAt(i, m.makeTranslation(0, 4.6, 0).premultiply(base));
      // Focos mirando hacia quien llega (atrás en x local).
      [['red', 4.95], ['yellow', 4.6], ['green', 4.25]].forEach(([k, y]) => {
        this.lamps[k].setMatrixAt(i, m.makeTranslation(-0.2, y, 0).premultiply(base));
        this.lamps[k].setColorAt(i, color.setHex(OFF[k]));
      });
    });
    this.group.add(pole, box);
    this.color = color;
  }

  update(time) {
    const changed = { red: false, yellow: false, green: false };
    this.heads.forEach((hd, i) => {
      const s = lightFor(hd.node, hd.edge, time);
      if (s === hd.state) return;
      for (const k of ['red', 'yellow', 'green']) {
        if (k === s || k === hd.state) {
          this.lamps[k].setColorAt(i, this.color.setHex(k === s ? ON[k] : OFF[k]));
          changed[k] = true;
        }
      }
      hd.state = s;
    });
    for (const k in changed) if (changed[k]) this.lamps[k].instanceColor.needsUpdate = true;
  }
}
