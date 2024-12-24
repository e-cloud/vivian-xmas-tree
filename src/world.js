import * as THREE from 'three';
/*import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  BlendFunction,
  KernelSize
} from "https://cdn.skypack.dev/postprocessing";*/
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import GUI from 'lil-gui';

export class World {
  constructor({ canvas, width, height, cameraPosition, fieldOfView = 75, nearPlane = 0.1, farPlane = 100 }) {
    const gui = new GUI({ closeFolders: true });
    gui.hide();
    this.gui = gui;
    this.canvas = canvas
    this.parameters = {
      count: 1500,
      max: 12.5 * Math.PI,
      a: 2,
      c: 4.5,
    };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#00101a');

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
    this.scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0xffffff, 70);
    pointLight.position.x = 2;
    pointLight.position.y = 3;
    pointLight.position.z = 4;

    // const pointLightFolder = gui.addFolder('pointLight');
    // pointLightFolder.add(pointLight.position, 'x').min(-100).max(100).step(0.1);
    // pointLightFolder.add(pointLight.position, 'y').min(-100).max(100).step(0.1);
    // pointLightFolder.add(pointLight.position, 'z').min(-100).max(100).step(0.1);

    this.scene.add(pointLight);
    this.clock = new THREE.Clock();
    this.data = 0;
    this.time = { current: 0, t0: 0, t1: 0, t: 0, frequency: 0.0005 };
    this.angle = { x: 0, z: 0 };
    this.width = width || window.innerWidth;
    this.height = height || window.innerHeight;
    this.aspectRatio = this.width / this.height;
    this.fieldOfView = fieldOfView;
    this.camera = new THREE.PerspectiveCamera(this.fieldOfView, this.aspectRatio, nearPlane, farPlane);
    this.camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: true,
    });
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.timer = 0;

    this.loadingManager = new THREE.LoadingManager()
    this.loadCallbacks = []

    this.addToScene();
    this.addButton();
  }
  start() {
    this.loadingManager.onLoad = () => {
      $('#stage-loader').fadeOut()
      $('#stage').fadeIn()

      this.render();
      // this.postProcessing();
      this.listenToResize();
      this.loop();
    }
  }
  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.composer && this.composer.render();
  }
  loop() {
    this.time.elapsed = this.clock.getElapsedTime();
    this.time.delta = Math.min(60, (this.time.current - this.time.elapsed) * 1000);
    if (this.analyser && this.isRunning) {
      this.time.t = this.time.elapsed - this.time.t0 + this.time.t1;
      this.data = this.analyser.getAverageFrequency();
      this.data *= this.data / 2000;
      this.angle.x += this.time.delta * 0.001 * 0.63;
      this.angle.z += this.time.delta * 0.001 * 0.39;
      const justFinished = this.isRunning && !this.sound.isPlaying;
      if (justFinished) {
        this.time.t1 = this.time.t;
        this.audioBtn.textContent = 'Play again';
        this.audioBtn.disabled = false;
        this.isRunning = false;
        const tl = gsap.timeline();
        this.angle.x = 0;
        this.angle.z = 0;
        tl.to(this.camera.position, {
          x: 0,
          z: 4.5,
          duration: 4,
          ease: 'expo.in',
        });
        tl.to(this.audioBtn, {
          opacity: () => 1,
          duration: 1,
          ease: 'power1.out',
        });
      } else {
        this.camera.position.x = Math.sin(this.angle.x) * this.parameters.a;
        this.camera.position.z = Math.min(Math.max(Math.cos(this.angle.z) * this.parameters.c, -4.5), 4.5);
      }
    }
    this.camera.lookAt(this.scene.position);
    this.spiralMaterial.uniforms.uTime.value += this.time.delta * this.time.frequency * (1 + this.data * 0.2);
    this.extMaterial.uniforms.uTime.value += this.time.delta * this.time.frequency;
    //this.mesh.rotation.y += 0.0001 * this.time.delta * data
    // for (const octa of this.octas.children) {
    //   octa.rotation.y += this.data ? (0.001 * this.time.delta * this.data) / 5 : 0.001 * this.time.delta;
    // }
    if (this.tree) {
      this.tree.rotation.y -= 0.0002 * this.time.delta;
    }
    this.externalSphere.rotation.y += 0.0001 * this.time.delta;
    this.render();

    this.time.current = this.time.elapsed;
    requestAnimationFrame(this.loop.bind(this));
  }
  listenToResize() {
    window.addEventListener('resize', () => {
      // Update sizes
      this.width = window.innerWidth;
      this.height = window.innerHeight;

      // Update camera
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();

      // Update renderer
      this.renderer.setSize(this.width, this.height);
      //this.composer.setSize(this.width, this.height);
    });
  }
  addSpiral() {
    this.spiralMaterial = new THREE.ShaderMaterial({
      vertexShader: document.getElementById('vertexShader').textContent,
      fragmentShader: document.getElementById('fragmentShader').textContent,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.045 },
      },
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const count = this.parameters.count; //2000
    const scales = new Float32Array(count * 1);
    const colors = new Float32Array(count * 3);
    const phis = new Float32Array(count);
    const randoms = new Float32Array(count);
    const randoms1 = new Float32Array(count);
    const colorChoices = ['pink', 'green', 'cyan', 'wheat', 'red'];

    const squareGeometry = new THREE.PlaneGeometry(1, 1);
    this.instancedGeometry = new THREE.InstancedBufferGeometry();
    Object.keys(squareGeometry.attributes).forEach(attr => {
      this.instancedGeometry.attributes[attr] = squareGeometry.attributes[attr];
    });
    this.instancedGeometry.index = squareGeometry.index;
    this.instancedGeometry.maxInstancedCount = count;

    for (let i = 0; i < count; i++) {
      const i3 = 3 * i;
      const colorIndex = Math.floor(Math.random() * colorChoices.length);
      const color = new THREE.Color(colorChoices[colorIndex]);
      phis[i] = Math.random() * this.parameters.max;
      randoms[i] = Math.random();
      scales[i] = Math.random();
      colors[i3 + 0] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }
    this.instancedGeometry.setAttribute('phi', new THREE.InstancedBufferAttribute(phis, 1, false));
    this.instancedGeometry.setAttribute('random', new THREE.InstancedBufferAttribute(randoms, 1, false));
    this.instancedGeometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1, false));
    this.instancedGeometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3, false));
    this.spiral = new THREE.Mesh(this.instancedGeometry, this.spiralMaterial);
    console.log(this.spiral);
    this.scene.add(this.spiral);
  }

  addExternalSphere() {
    this.extMaterial = new THREE.ShaderMaterial({
      vertexShader: document.getElementById('vertexShaderExt').textContent,
      fragmentShader: document.getElementById('fragmentShaderExt').textContent,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('orange') },
      },
      wireframe: true,
      transparent: true,
    });
    const geometry = new THREE.SphereGeometry(6, 128, 128);
    this.externalSphere = new THREE.Mesh(geometry, this.extMaterial);
    this.scene.add(this.externalSphere);
  }
  addOctahedron({ color = 'white', scale, position = [0, 0, 0] }) {
    const octa = new THREE.Mesh(
      this.octaGeometry,
      new THREE.MeshBasicMaterial({
        wireframe: true,
        color,
      }),
    );
    octa.scale.set(...scale);
    octa.position.set(...position);
    this.octas.add(octa);
  }
  addOctahedrons() {
    this.octas = new THREE.Group();
    this.octaGeometry = new THREE.OctahedronGeometry(0.2, 0);
    this.addOctahedron({ color: 'red', scale: [1, 1.4, 1] });
    this.addOctahedron({
      color: 'tomato',
      position: [0, 0.85, 0],
      scale: [0.5, 0.7, 0.5],
    });

    this.addOctahedron({
      color: 'red',
      position: [1, -0.75, 0],
      scale: [0.5, 0.7, 0.5],
    });
    this.addOctahedron({
      color: 'tomato',
      position: [-0.75, -1.75, 0],
      scale: [1, 1.2, 1],
    });
    this.addOctahedron({
      color: 'red',
      position: [0.5, -1.2, 0.5],
      scale: [0.25, 0.37, 0.25],
    });
    this.scene.add(this.octas);
  }
  addTree() {
    const gui = this.gui;

    const gltfLoader = new GLTFLoader(this.loadingManager);
    gltfLoader.load(
      'models/tree.glb',
      object => {
        console.log(object);
        const tree = object.scene;
        tree.scale.set(2.8, 2.8, 2.8);
        tree.position.x = 0;
        tree.position.y = -4;
        tree.position.z = 0;
        const treeFolder = gui.addFolder('tree');
        treeFolder.add(tree.position, 'x').min(-100).max(100).step(0.1);
        treeFolder.add(tree.position, 'y').min(-100).max(100).step(0.1);
        treeFolder.add(tree.position, 'z').min(-100).max(100).step(0.1);
        this.tree = tree;
        this.scene.add(object.scene);
      },
      xhr => {
        console.log((xhr.loaded / xhr.total) * 100 + '% tree loaded');
      },
      error => {
        console.log(error);
      },
    );
  }
  addToScene() {
    this.addSpiral();
    this.addExternalSphere();
    //this.addOctahedrons();
    this.addTree();
  }
  addButton() {
    this.audioBtn = document.querySelector('#play-music');
    this.title = document.querySelector('#wish');
    this.loadMusic()
    this.audioBtn.addEventListener('click', () => {
      this.audioBtn.disabled = true;
      this.toggleFullScreen()
      if (this.analyser) {
        this.sound.play();
        this.time.t0 = this.time.elapsed;
        this.data = 0;
        this.isRunning = true;
        gsap.to([this.audioBtn, this.title], {
          opacity: 0,
          duration: 1,
          ease: 'power1.out',
        });
      }
    });
  }

  loadMusic() {
      const listener = new THREE.AudioListener();
      this.camera.add(listener);
      // create a global audio source
      this.sound = new THREE.Audio(listener);
      const audioLoader = new THREE.AudioLoader(this.loadingManager);
      audioLoader.load(
        '/short-snow_01.mp3',
        buffer => {
          this.sound.setBuffer(buffer);
          this.sound.setLoop(false);
          this.sound.setVolume(0.5);
          this.analyser = new THREE.AudioAnalyser(this.sound, 32);
          // get the average frequency of the sound
          const data = this.analyser.getAverageFrequency()

          console.log('music loaded');
        },
        progress => {
          console.log((progress.loaded / progress.total) * 100 + '% music loaded');
        },
        error => {
          console.log(error);
        },
      );
  }

  toggleFullScreen() {
    if(!document.fullscreenElement)
      {
          this.canvas.requestFullscreen()
      }
      else
      {
          document.exitFullscreen()
      }
  }
  /*postProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new EffectPass(
        this.camera,
        new BloomEffect({
          blendFunction: BlendFunction.SCREEN,
          kernelSize: KernelSize.MEDIUM,
          luminanceThreshold: 0.4,
          intensity: 2.6,
          luminanceSmoothing: 0.4,
          height: 480
        })
      )
    );
  }*/
}

if (document.addEventListener)
  {
      document.addEventListener('webkitfullscreenchange', exitHandler, false);
      document.addEventListener('mozfullscreenchange', exitHandler, false);
      document.addEventListener('fullscreenchange', exitHandler, false);
      document.addEventListener('MSFullscreenChange', exitHandler, false);
  }

  function exitHandler(event)
  {
      console.log(event)
  }
