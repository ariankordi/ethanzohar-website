import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";
import coinTextureSrc from "./adrii_coin.jpg";
import bag1 from "./bag_1.png";
import bag2 from "./bag_2.png";
import bag3 from "./bag_3.png";
import bag4 from "./bag_4.png";
import bag5 from "./bag_5.png";
import bag6 from "./bag_6.png";
import bag7 from "./bag_7.png";
import bag8 from "./bag_8.png";
import bag9 from "./bag_9.png";
import bag10 from "./bag_10.png";
import finalImage from "./final_image.png";
import happyBirthdayAudio from "./happy_birthday.m4a";
import aaaaaAudio from "./aaaaa.m4a";
import bingAudio from "./bing.m4a";

const BAGS = [bag1, bag2, bag3, bag4, bag5, bag6, bag7, bag8, bag9, bag10];

const SPIN_MESSAGES: { spins: number; text: string }[] = [
  { spins: 2, text: "Keep going!" },
  { spins: 5, text: "Almost halfway!" },
  { spins: 10, text: "Halfway there!" },
  { spins: 15, text: "Just a few more!" },
];

export function Adrii() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [showClickHere, setShowClickHere] = useState(false);
  const [started, setStarted] = useState(false); // track if unmute button clicked

  let bagIndex = 0;

  const spinningSoundRef = useRef<HTMLAudioElement>();
  const animationSoundRef = useRef<HTMLAudioElement>();
  const finishSoundRef = useRef<HTMLAudioElement>();

  const startAnimation = () => {
    setMuted(false);
    setStarted(true); // hide unmute button

    spinningSoundRef.current = new Audio(happyBirthdayAudio);
    spinningSoundRef.current.loop = true;

    // Play happy birthday audio
    spinningSoundRef.current?.play().catch(() => {});
  };

  useEffect(() => {
    if (!mountRef.current || !started) return;

    animationSoundRef.current = new Audio(aaaaaAudio);
    animationSoundRef.current.loop = true;

    finishSoundRef.current = new Audio(bingAudio);
    finishSoundRef.current.loop = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdc83f7); // pink background

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mountRef.current.appendChild(renderer.domElement);

    const loader = new TextureLoader();
    const coinTexture = loader.load(coinTextureSrc);
    const bagTextures = BAGS.map((bag) => loader.load(bag));
    const finalImageTexture = loader.load(finalImage);

    // --- COIN ---
    const radius = 1;
    const thickness = 0.25;
    const coinGeometry = new THREE.CylinderGeometry(radius, radius, thickness, 64, 1, true);
    const sideMaterial = new THREE.MeshStandardMaterial({ map: coinTexture, side: THREE.DoubleSide });
    const capMaterial = new THREE.MeshStandardMaterial({ map: coinTexture, side: THREE.DoubleSide });

    const circleGeo = new THREE.CircleGeometry(radius, 64);
    const capFront = new THREE.Mesh(circleGeo, capMaterial);
    const capBack = new THREE.Mesh(circleGeo, capMaterial);
    capFront.position.z = thickness / 2;
    capBack.position.z = -thickness / 2;
    capBack.rotateX(Math.PI);

    const cylinderMesh = new THREE.Mesh(coinGeometry, sideMaterial);
    cylinderMesh.rotation.x = Math.PI / 2;

    const coinGroup = new THREE.Group();
    coinGroup.add(cylinderMesh, capFront, capBack);
    scene.add(coinGroup);

    // --- LIGHTS ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const innerLight = new THREE.PointLight(0xffff55, 0, 3);
    innerLight.position.set(0, 0, 0);
    scene.add(innerLight);

    // --- BAG ---
    const finalImageMaterial = new THREE.SpriteMaterial({ map: finalImageTexture });
    const bagMaterials = bagTextures.map((t) => new THREE.SpriteMaterial({ map: t }));
    const bag = new THREE.Sprite(bagMaterials[bagIndex]);
    bag.scale.set(0.01, 0.01, 1);
    bag.position.set(0, -0.3, 0);
    scene.add(bag);

    // --- GOLDEN GLOW ---
    const glowUniforms = { time: { value: 0 }, intensity: { value: 0 } };
    const glowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: glowUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        uniform float intensity;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float radial = smoothstep(0.5, 0.0, dist);
          float wave = sin(dist * 12.0 - time * 3.0) * 0.3;
          float alpha = (radial + wave) * intensity;
          vec3 color = vec3(1.0,0.85,0.2)*alpha;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 32, 32), glowMaterial);
    glowPlane.position.set(0, -0.3, -0.2);
    glowPlane.scale.set(0.01, 0.01, 1);
    scene.add(glowPlane);

    // --- SPIN LOGIC ---
    let isDragging = false;
    let lastX = 0;
    let activePointerId: number | null = null;
    let velocity = 0;
    let totalRotation = 0;
    const rotationSpeed = 0.008;
    const ROTATIONS_FOR_BREAK = 20;
    let hasBroken = false;
    let breakProgress = 0;
    let coinGroupYRotation = 0;
    let finished = false;

    const canvas = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      isDragging = true;
      lastX = e.clientX;
      velocity = 0;
      activePointerId = e.pointerId;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || activePointerId !== e.pointerId) return;
      const deltaX = e.clientX - lastX;
      lastX = e.clientX;
      const deltaRot = deltaX * rotationSpeed;
      coinGroup.rotation.y += deltaRot;
      velocity = deltaRot * 0.9 + velocity * 0.1;
    };

    const endDrag = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      isDragging = false;
      activePointerId = null;
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointerleave", endDrag);

    const animate = () => {
      requestAnimationFrame(animate);
      glowUniforms.time.value += 0.02;

      if (!isDragging && !hasBroken) velocity *= 0.95;
      coinGroup.rotation.y += velocity;
      totalRotation += Math.abs(velocity);

      if (!hasBroken) {
        const fullSpins = Math.floor(totalRotation / (2 * Math.PI));
        const msg = SPIN_MESSAGES.find((m) => m.spins === fullSpins);
        if (msg) setCurrentMessage(msg.text);
      }

      const fullSpins = Math.floor(totalRotation / (2 * Math.PI));
      if (!hasBroken && fullSpins >= ROTATIONS_FOR_BREAK) {
        hasBroken = true;
        coinGroupYRotation = coinGroup.rotation.y;
        setCurrentMessage("");

        // STOP happy birthday audio and start main animation audio
        spinningSoundRef.current?.pause();
        animationSoundRef.current?.play().catch(() => {});
      }

      if (hasBroken && breakProgress < 1) {
        const step = 0.001;
        breakProgress += step;
        const t = breakProgress;
        const ease = t * t * (3 - 2 * t);

        innerLight.intensity = ease * 8;
        coinGroup.position.y = -ease * 1.5;
        coinGroup.rotation.y = coinGroupYRotation;

        bag.position.y = ease * 1.2;
        bag.scale.set(ease * 1.4, ease * 1.4, 1);
        glowPlane.position.y = bag.position.y;
        glowPlane.scale.set(ease * 2.2, ease * 2.2, 1);
        glowUniforms.intensity.value = ease * 1.5;

        if (Math.floor(breakProgress / step) % 7 === 0) bagIndex++;
        bag.material = bagMaterials[bagIndex % 10];
      }

      if (hasBroken && breakProgress >= 1 && !finished) {
        finished = true;
        bag.material = finalImageMaterial;
        bag.scale.set(2.5, 2.5, 1);
        glowUniforms.intensity.value = 1.3;

        animationSoundRef.current?.pause();
        finishSoundRef.current?.play().catch(() => {});

        setShowClickHere(true);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointerleave", endDrag);
      window.removeEventListener("resize", onResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [started]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#dc83f7", position: "relative" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {!started && (
        <button
          onClick={startAnimation}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "3rem",
            padding: "1rem 3rem",
            borderRadius: "1rem",
            background: "#fff",
            cursor: "pointer",
            zIndex: 1000,
          }}
        >
          Unmute
        </button>
      )}
      {currentMessage && (
        <div
          style={{
            position: "absolute",
            top: "20%",
            width: "100%",
            textAlign: "center",
            fontSize: "2rem",
            fontWeight: "bold",
            color: "#fff",
            textShadow: "0 0 10px #000",
            pointerEvents: "none",
          }}
        >
          {currentMessage}
        </div>
      )}
      {showClickHere && (
        <div
          onClick={() => window.location.href = "https://fatwormclimb.com/collections/all"}
          style={{
            position: "absolute",
            top: "80%",
            width: "100%",
            textAlign: "center",
            fontSize: "2.5rem",
            fontWeight: "bold",
            color: "#fff",
            textShadow: "0 0 5px red, 0 0 10px red, 0 0 15px red",
            cursor: "pointer",
            animation: "pulse 1s infinite alternate",
          }}
        >
          Click here
        </div>
      )}
      <style>{`
        @keyframes pulse {
          from { text-shadow: 0 0 5px red, 0 0 10px red, 0 0 15px red; }
          to { text-shadow: 0 0 15px red, 0 0 30px red, 0 0 45px red; }
        }
      `}</style>
    </div>
  );
}
