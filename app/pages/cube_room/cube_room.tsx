import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import SourceCodePro from "../../fonts/source_code_pro.json";

export function CubeRoom() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera inside the cube
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Cube with different colored walls
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.BackSide }), // right
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.BackSide }), // left
      new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.BackSide }), // top
      new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.BackSide }), // bottom
      new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.BackSide }), // front
      new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.BackSide }), // back (cyan wall)
    ];
    const cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);

    // Load font
    const font = new FontLoader().parse(SourceCodePro as any);

    // Create text
    const textGeometry = new TextGeometry("hello", {
      font,
      size: 1,
      bevelEnabled: false,
    });
    textGeometry.computeBoundingBox();
    const textWidth = textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x;
    const textHeight = textGeometry.boundingBox!.max.y - textGeometry.boundingBox!.min.y;

    const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Position text on the cyan wall (z = -5) and center it
    textMesh.position.set(-textWidth / 2, -textHeight / 2, -4.9);
    scene.add(textMesh);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = mountRef.current!.clientWidth / mountRef.current!.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current!.clientWidth, mountRef.current!.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current!.removeChild(renderer.domElement);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      textGeometry.dispose();
      textMaterial.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
