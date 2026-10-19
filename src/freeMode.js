// Modo libre: escena propia con la ciudad, cámara, HUD de calle y minimapa.
import * as THREE from 'three';
import { buildCity } from './city/city.js';
import { buildCityMesh } from './render/cityMesh.js';
import { CarMesh } from './render/carMesh.js';
import { FreeRide } from './freeRide.js';
import { Minimap } from './ui/minimap.js';
import { PHYSICS_DT } from './race.js';
import { buildSignals } from './city/signals.js';
import { TrafficMesh, SignalMesh } from './render/trafficMesh.js';

const TRAFFIC_CARS = 24;

const SKY = 0xa9cfe6;
const $ = (id) => document.getElementById(id);

export class FreeMode {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.scene = null;
    this.acc = 0;
    this.camMode = 0;
    this.shake = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
  }

  // La ciudad se construye la primera vez que se entra (no retrasa el menú).
  ensureScene() {
    if (this.scene) return;
    this.city = buildCity();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, 220, 750);
    scene.add(new THREE.HemisphereLight(0xdfefff, 0x6b6250, 1.6));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    Object.assign(this.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
    scene.add(this.sun, this.sun.target);
    scene.add(buildCityMesh(this.city));
    buildSignals(this.city);
    this.signalMesh = new SignalMesh(this.city);
    scene.add(this.signalMesh.group);
    this.scene = scene;
    this.minimap = new Minimap(this.city, $('minimap'));
  }

  start({ car, spec, automatic }) {
    this.ensureScene();
    if (this.mesh) this.scene.remove(this.mesh.group);
    this.ride = new FreeRide(this.city, spec, { traffic: TRAFFIC_CARS });
    if (this.trafficMesh) this.scene.remove(this.trafficMesh.group);
    this.trafficMesh = new TrafficMesh(this.ride.traffic);
    this.scene.add(this.trafficMesh.group);
    this.ride.onHit = (f) => (this.shake = Math.min(1, this.shake + f / 15));
    this.ride.player.car.automatic = automatic;
    this.mesh = new CarMesh(this.ride.player.car, car.color, car.model);
    this.scene.add(this.mesh.group);
    this.active = true;
    this.acc = 0;
    this.snapCamera();
    $('free-hud').classList.remove('hidden');
  }

  stop() {
    this.active = false;
    $('free-hud').classList.add('hidden');
  }

  // Objeto con la forma que espera el HUD de carrera.
  hudView() {
    const p = this.ride.player;
    p.position = 1;
    p.lapTimes = [];
    p.lapStart = 0;
    p.wrongWayTime = 0; // en modo libre no hay reglas que avisar
    return { player: p, racers: [p], laps: 1, currentLap: 1, time: this.ride.time, state: 'racing' };
  }

  update(dt, input, hud) {
    const car = this.ride.player.car;
    if (input.actions.has('camera')) this.camMode = (this.camMode + 1) % 2;
    if (!car.automatic) {
      if (input.actions.has('shiftUp')) car.manualShift(1);
      if (input.actions.has('shiftDown')) car.manualShift(-1);
    }
    if (input.actions.has('reset')) this.ride.respawn();
    Object.assign(car.input, input);

    this.acc += dt;
    while (this.acc >= PHYSICS_DT) {
      this.ride.step(PHYSICS_DT);
      this.acc -= PHYSICS_DT;
    }
    this.mesh.sync(dt);
    this.trafficMesh.update();
    this.signalMesh.update(this.ride.traffic.time);
    this.updateCamera(dt);
    hud.update(this.hudView());

    const road = this.ride.street();
    const text = road ? `${road.name} · ${road.oneway ? 'un sentido' : 'doble sentido'}` : '';
    if (this.lastStreet !== text) {
      this.lastStreet = text;
      $('street').textContent = text;
    }
    this.minimap.draw(car);
  }

  cameraTarget(car, out, look) {
    const fx = Math.cos(car.heading);
    const fz = -Math.sin(car.heading);
    if (this.camMode === 1) {
      out.set(car.x + fx * 0.6, 1.25, -car.y + fz * 0.6);
      look.set(car.x + fx * 20, 1.0, -car.y + fz * 20);
    } else {
      const back = 7 + car.speed * 0.02;
      out.set(car.x - fx * back, 2.6, -car.y - fz * back);
      look.set(car.x + fx * 4, 1.0, -car.y + fz * 4);
    }
  }

  snapCamera() {
    this.cameraTarget(this.ride.player.car, this.camPos, this.camLook);
    this.camera.clearViewOffset();
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  updateCamera(dt) {
    const car = this.ride.player.car;
    const cam = this.camera;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    this.cameraTarget(car, pos, look);
    const first = this.camMode === 1;
    this.camPos.lerp(pos, first ? 1 : 1 - Math.exp(-8 * dt));
    this.camLook.lerp(look, first ? 1 : 1 - Math.exp(-14 * dt));
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    cam.lookAt(this.camLook);
    const fov = 62 + Math.min(car.speed / car.topSpeed, 1.2) * 14 + (car.nitroActive ? 6 : 0);
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
    this.sun.position.set(car.x + 30, 60, -car.y + 20);
    this.sun.target.position.set(car.x, 0, -car.y);
  }
}
