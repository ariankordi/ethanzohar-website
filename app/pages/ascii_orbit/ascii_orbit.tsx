import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import SourceCodePro from "../../fonts/source_code_pro.json";

export function AsciiOrbit() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // white background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const cDistance = 14;
    camera.position.set(cDistance, 0, cDistance);
    cameraRef.current = camera;

    // Make sure alpha is false so background is rendered
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff, 1); // white background
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    const font = new FontLoader().parse(SourceCodePro as any);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const lines = [
      "            .¤^¤.            ",
      "       __d-+-+-+-+-b__       ",
      "     .d' ┌──────────┐'b.     ",
      "   .p'┌──┴►───────┐ │  'q.   ",
      "  .d' │┌◄───┬──┐  │ │   'b.  ",
      " .d'──┼┘ ┌┐ │  │  │ │    'b. ",
      " ¤-│  │  ││ │  │  ▲ │┌──┐ -¤ ",
      "<::└──┼──┘└─┼──┼──┼─┘│  │ ::>",
      " ¤-   │     ▲  ▲  │  ▲  │ -¤ ",
      " °p'  └◄───┬┼──┼──┼►─┼──┘'q° ",
      "  °p'    ┌─┴┼──┴──┼──┤  'q°  ",
      "   °b'   ▼  │     ▲  │ 'd°   ",
      "     °q' └──┘     └──'p°     ",
      "       ¯¯q-+-+-+-+-p¯¯       ",
      "            '¤v¤'            "
    ];

    let maxLineWidth = 0;
    const lineGeometries: THREE.TextGeometry[] = [];
    for (const line of lines) {
      const geom = new TextGeometry(line, {
        font,
        size: 1,
        depth: 0.3,
        // depth: 0,
        bevelEnabled: true,
        bevelThickness: 0,
        bevelSize: 0.07,
        bevelSegments: 50,
      });
      geom.computeBoundingBox();
      const width = geom.boundingBox.max.x - geom.boundingBox.min.x;
      if (width > maxLineWidth) maxLineWidth = width;
      lineGeometries.push(geom);
    }

    const squareSize = maxLineWidth;
    const lineHeight = squareSize / lines.length;
    const group = new THREE.Group();
    scene.add(group);
    const totalHeight = (lines.length - 1) * lineHeight;

    lineGeometries.forEach((geom, i) => {
      geom.center();
      const mesh = new THREE.Mesh(geom, material);
      const y = totalHeight / 2 - i * lineHeight;
      mesh.position.set(0, y, 0);
      group.add(mesh);
    });

    group.position.set(0, 0, 0);
    group.lookAt(0, 0, 0);
    group.rotateY(Math.PI / 1.75);
    // group.rotateX(Math.PI / 12);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      renderer.dispose();
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const exportPNG = () => {
  if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

  const renderer = rendererRef.current;
  const scene = sceneRef.current;
  const camera = cameraRef.current;

  // Save original size
  const originalWidth = renderer.domElement.width;
  const originalHeight = renderer.domElement.height;
  const originalSize = renderer.getSize(new THREE.Vector2());

  // Upscale factor
  const scale = 6;
  const newWidth = originalSize.x * scale;
  const newHeight = originalSize.y * scale;

  // Set renderer to larger size
  renderer.setSize(newWidth, newHeight);
  renderer.setPixelRatio(1); // avoid double scaling

  // Render and export
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL("image/png");

  // Reset renderer to original size
  renderer.setSize(originalSize.x, originalSize.y);
  renderer.setPixelRatio(window.devicePixelRatio);

  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "ascii_scene.png";
  link.click();
};

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }} ref={mountRef}>
      <button
        onClick={exportPNG}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          padding: "10px 20px",
          background: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        Export PNG
      </button>
    </div>
  );
}