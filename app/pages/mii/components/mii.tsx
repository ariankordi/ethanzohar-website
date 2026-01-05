import { useEffect, useRef } from "react";
import * as THREE from "three";
import { colorFromHex, pantsColorGrayNormal, favoriteColorTable, headToBodyScale } from "../helpers";

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import FFLShaderMaterial from 'ffl.js/materials/FFLShaderMaterial.js';
import SampleShaderMaterial, { type SampleShaderMaterialColorInfo } from 'ffl.js/materials/SampleShaderMaterial.js';
import { detectModelDesc, applyScaleDesc } from 'ffl.js/helpers/ModelScaleDesc.js';
import { addSkeletonScalingExtensions, type SkeletonWithAttachments } from 'ffl.js/helpers/SkeletonScalingExtensions.js';
import type { BodyModel } from "ffl.js/helpers/BodyUtilities.js";

const Gender = {
	Male: 0,
	Female: 1
};
type Gender = (typeof Gender)[keyof typeof Gender];

interface MiiProps {
  scene: THREE.Scene;
  miiUrl: string;
  overrides?: {
    height?: number;
    build?: number;
    favoriteColor?: number;
    gender?: Gender;
  };
  position: [number, number, number];
  scale?: number,
}

const maleBodyUrl = "https://cdn.jsdelivr.net/gh/ariankordi/ffl-raylib-samples@latest/models/miibodymiddle%20male%20test.glb";
const femaleBodyUrl = "https://cdn.jsdelivr.net/gh/ariankordi/ffl-raylib-samples@latest/models/miibodymiddle%20female%20test.glb";

interface AdditionalInfo {
  gender: Gender;
  favoriteColor: number;
  height: number;
  build: number;
  colorInfo: SampleShaderMaterialColorInfo | null;
}

const additionalInfo: AdditionalInfo = {
	gender: Gender.Male,
	favoriteColor: 11, // Black
	height: 100,
	build: 55,
	// All of the above are available in FFLAdditionalInfo.
	/**
	 * Info needed from Switch shader. This is available from
	 * the charInfo Base64 in glTF models, or .getColorInfo() for FFL.js CharModel.
	 * @type {SampleShaderMaterialColorInfo|null}
	 */
	colorInfo: null
};

const materials = {
	// from ffl.js
	FFLShaderMaterial
};

export function Mii({ scene, miiUrl, overrides, position = [0, 0, 0], scale = 1}: MiiProps) {
  const bodyTemplates: Partial<Record<Gender, import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>> = {};
  const globalScale = scale;

  let activeMaterialClassName = Object.keys(materials)[0];
  let build: number = 55;
  let height: number = 100;
  let gender: number = Gender.Male;
  
  let currentHead: THREE.Group | null = null;
  let currentBody: BodyModel | null = null;
  let currentShadowModel: THREE.Mesh | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  

  const clock = new THREE.Clock();
  let animClockDelta = 0;

  const loadGLTF = async (url: string): Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF> =>
    new Promise((resolve, reject) => {
      new GLTFLoader().load(url, resolve, undefined, reject);
    });

  const preloadBodyTemplates = () =>
    Promise.all([loadGLTF(maleBodyUrl), loadGLTF(femaleBodyUrl)]).then((values) => {
      bodyTemplates[Gender.Male] = values[0];
      bodyTemplates[Gender.Female] = values[1];
    });

  const applyMaterialClassToMesh = (mesh: THREE.Mesh, newMatClass: typeof FFLShaderMaterial | typeof SampleShaderMaterial, colorInfo: SampleShaderMaterialColorInfo | null) => {
    /** Whether the new material supports FFL swizzling. */
    const forFFLMaterial = 'modulateMode' in newMatClass.prototype;
    // Recreate material with same parameters but using the new shader class.
    const oldMat = mesh.material as THREE.MeshBasicMaterial;
    /** Get modulateMode/Type */
    const userData = mesh.geometry.userData;
  
    /** Do not include the parameters if forFFLMaterial is false. */
    const modulateModeType = forFFLMaterial
      ? { // modulateMode/Type will be used from the userData or old material.
        modulateMode: 'modulateMode' in oldMat ? oldMat.modulateMode : userData.modulateMode ?? 0,
        // This setter will set side too:
        modulateType: 'modulateType' in oldMat ? oldMat.modulateType : userData.modulateType ?? 0
      }
      : {};
  
    /**
     * Parameters for the shader material. Using SampleShaderMaterialParameters
     * as a lowest common denominator, but others can also be used.
     */
    const params: any = {
      // _side = original side from LUTShaderMaterial, must be set first
      side: ('_side' in oldMat) ? /** @type {THREE.Side} */ (oldMat._side) : oldMat.side,
      ...modulateModeType,
      color: oldMat.color, // should be after modulateType
      transparent: Boolean(oldMat.transparent || oldMat.alphaTest)
    };
    if (oldMat.map) {
      params.map = oldMat.map;
    }
  
    if ('modulateType' in userData) {
      params.modulateMode = userData.modulateMode ?? 0;
      params.modulateType = userData.modulateType;
    }
    if (colorInfo && 'colorInfo' in newMatClass.prototype) {
      // console.debug('got colorinfo on', mesh)
      params.colorInfo = colorInfo;
    }
  
    mesh.material = new newMatClass(params);
    oldMat.dispose(); // Dispose the old material, keeping the map.
  
    // HACK: For SampleShaderMaterial with glTF head models, let's not
    // set drawType uniform to faceline. TODO: Specifically only
    // needs to be done if it's not from FFL.js, and, if faceline
    // color is not transparent (will also result in beards having wrong color)
    if (mesh.material instanceof SampleShaderMaterial &&
      userData.modulateType === 0) {
      // TODO: This will also break if you request: /miis/image.glb?shaderType=switch&data=
      // 0804400308040402020C0308060406020A0000020000000804100A01001E4004000214031304170D06020A040109
      // (Should we automatically include &shaderType=switch when SampleShaderMaterial is detected?)
      mesh.material.uniforms.drawType.value = 0;
    }
  }

  const applyMaterialToGroup = (group: THREE.Object3D, materialClassName: string, colorInfo: SampleShaderMaterialColorInfo | null) => {
    const matClass = FFLShaderMaterial;
    if (!matClass) {
      throw new Error(`Unknown shader: ${materialClassName}`);
    }
  
    group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        applyMaterialClassToMesh(node, matClass, colorInfo);
      }
    });
  }

  const loadCharModelFromGLTF = async (url: string) => {
    const gltf = await loadGLTF(url);
  
    // Set additionalInfo and colorInfo from the metadata if available.
    const extras = gltf.asset.extras;
    if (extras && extras.additionalInfo) {
      // THIS IS WHERE THE CHANGES HAPPEN
      const info = extras.additionalInfo;
      additionalInfo.height = overrides?.height || info.height;
      additionalInfo.build = overrides?.build || info.build;
      additionalInfo.gender = overrides?.gender || info.gender;
      additionalInfo.favoriteColor = overrides?.favoriteColor || info.favoriteColor;
      additionalInfo.colorInfo =
        SampleShaderMaterial.getColorInfoFromCharInfoB64(extras.charInfo);
    }
  
    const model = gltf.scene;
  
    // Apply the material class. It will read modulateMode/Type from userData.
    applyMaterialToGroup(model, activeMaterialClassName, additionalInfo.colorInfo);
  
    // Set material color, set renderOrder, and fix texture color space.
    model.traverse((mesh: any) => {
      if (!(mesh instanceof THREE.Mesh)) {
        return;
      }
      const userData = mesh.geometry.userData;
      const material = /** @type {THREE.MeshBasicMaterial} */ (mesh.material);
  
      if ('modulateType' in userData) {
        // Set render order for translucent meshes.
        mesh.renderOrder = userData.modulateType;
      }
      // Set the material color from modulateColor.
      // It's worth noting that the default glTF color is always in linear space.
      if (Array.isArray(userData.modulateColor)) {
        material.color = material.color.fromArray(userData.modulateColor);
      }
  
      // HACK: Allow the material class to modify the geometry if it needs to.
      if ('modifyBufferGeometry' in material.constructor && // Static function
        typeof material.constructor.modifyBufferGeometry === 'function') {
        material.constructor.modifyBufferGeometry(
          { modulateParam: { type: userData.modulateType } }, mesh.geometry);
      }
  
      if (material.map) {
        // Force the glTF's texture to use sRGB colors.
        material.map.colorSpace = THREE.LinearSRGBColorSpace;
      }
    });
  
    return model;
  }

  const applyModulateToBody = (model: THREE.Object3D) => {
    let lastSkinnedMesh: THREE.SkinnedMesh | null = null;
    // To find the pants, let's find the last SkinndMesh and assume that's it.
    model.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) {
        lastSkinnedMesh = node;
      }
    });
    // (TODO: This method will NOT WORK for body models extracted from Miitomo PODs.)
  
    let meshIndex = 0;
    model.traverse((mesh) => {
      // The reason this is identifying SkinnedMesh instead of just Mesh
      // is to avoid detecting the head model. But, if the head is also
      // a SkinnedMesh and it's attached to the body, then it will catch here.
      if (!(mesh instanceof THREE.SkinnedMesh)) {
        return;
      }
  
      /**
       * Assume that the mesh is pants if it is the last
       * skinned mesh, or even. Otherwise, a it's the body.
       */
      const isPants = lastSkinnedMesh
        ? mesh.id === lastSkinnedMesh.id
        // If there is no lastSkinnedMesh, then assume this
        // is the pants if it is the second mesh.
        : (meshIndex % 2 === 0);
  
      mesh.geometry.userData.modulateMode = 0; // Constant color/opaque.
      mesh.geometry.userData.modulateType = isPants
        ? 10 // Pants
        : 9; // Body
  
      meshIndex++;
    });
  }

  function getBodyScale(build: number, height: number) {
    // calculated here in libnn_mii/draw/src/detail/mii_VariableIconBodyImpl.cpp:
    // void nn::mii::detail::`anonymous namespace'::GetBodyScale(struct nn::util::Float3 *, int, int)
    // also in Mii Maker USA (0x000500101004A100 v50 ffl_app.rpx): FUN_020737b8
    const m = 128.0;
    const x = (build * (height * (0.47 / m) + 0.4)) / m +
      height * (0.23 / m) + 0.4;
    const y = (height * (0.77 / m)) + 0.5;
  
    return { x, y, z: x }; // z is always set to x
  }

  const updateBodyScale = (body: THREE.Object3D, build: number, height: number) => {
    const bodyScale = getBodyScale(build, height);
    applyScaleDesc(body, bodyScale, detectModelDesc(body));
  };

  const prepareBodyForCharModel = (body: THREE.Object3D, info: typeof additionalInfo, build: number, height: number) => {
    applyModulateToBody(body); // Add modulateMode/modulateType.
    applyMaterialToGroup(body, activeMaterialClassName, info.colorInfo);
  
    const pantsColor = colorFromHex(pantsColorGrayNormal);
    const favoriteColor = colorFromHex(favoriteColorTable[info.favoriteColor]);
  
    // Set the colors on the body model.
    body.traverse((mesh) => {
      // The reason this is identifying SkinnedMesh instead of just Mesh
      // is to avoid detecting the head model. But, if the head is also
      // a SkinnedMesh and it's attached to the body, then it will catch here.
      if (!(mesh instanceof THREE.SkinnedMesh) ||
        !('modulateType' in mesh.geometry.userData)) {
        return;
      }
      if (mesh.geometry.userData.modulateType === 9) { // Body
        mesh.material.color = favoriteColor;
      } else if (mesh.geometry.userData.modulateType === 10) { // Pants
        mesh.material.color = pantsColor;
      }
    });
  
    updateBodyScale(body, build, height);
  }

  const findSkinnedMeshWithBone = (root: THREE.Object3D, boneName: string): THREE.SkinnedMesh | null => {
    let found: THREE.SkinnedMesh | null = (null);
    root.traverse((node) => {
      if (found || !(node instanceof THREE.SkinnedMesh)) {
        return;
      }
      if (node.skeleton.bones.some(bone => bone.name === boneName)) {
        found = node;
      }
    });
    return found;
  }

  const attachHeadToBody = (body: BodyModel, head: THREE.Group) => {
    head.position.set(position[0], position[1], position[2]);

    //  * @param {string} headBoneName - The name of the head bone from {@link typeof ModelScaleDesc.head}.
    const headBoneName = body.scaleDesc.head;
    if (headBoneName === 'Head') {
      console.error('TODO: Head is not attached correctly to the Miitomo body. Skipping it so you can see what the model looks like anyway.');
      return;
    }
  
    const headBone = body.model.getObjectByName(headBoneName);
    if (!(headBone instanceof THREE.Bone)) {
      throw new Error('Head bone not found.');
    }

    // Locate the skeleton in the SkinnedMesh, needed to call attach().
    const skinnedMesh = findSkinnedMeshWithBone(body.model, headBoneName);
    if (!skinnedMesh) {
      throw new Error('No skinned mesh with head bone.');
    }
    const skeleton: SkeletonWithAttachments = skinnedMesh.skeleton as unknown as SkeletonWithAttachments;
  
    // Set head to body scale ratio.
    // Multiply by 0.1, assuming the body's world scale was normalized to 1.0.
    head.scale.setScalar(globalScale * 0.1 * headToBodyScale);
  
    // Add the model to the scene, and attach it to the SkeletonWithAttachments.
    headBone.add(head); // This will render it.
    skeleton.attach(head, headBoneName); // This positions it with the scaled bone.
  }

  const attachShadowModelToBody = (body: BodyModel, mesh: THREE.Mesh) => {
    mesh.position.set(position[0], position[1], position[2]);

    // const mesh = createShadowModel();
    // Anchor to the root.
    const boneName = body.scaleDesc.shadow;
    // I believe the way this is mounted in Wii U Mii Maker, is that "MiiTop.bfres"
    // is like a "wrapper" for the Mii body. shadow_model is in "MiiTopL", the body
    // is "mounted" in the bone "MiiL" but the shadow is high in the hierarchy.
    const shadowBone = body.model.getObjectByName(boneName);
    if (shadowBone && shadowBone instanceof THREE.Object3D) {
      const skinnedMesh: THREE.SkinnedMesh | null = findSkinnedMeshWithBone(body.model, boneName);
      if (!skinnedMesh) {
        throw new Error(`Cannot find shadow bone: ${boneName}`);
      }

      const skeleton: SkeletonWithAttachments = skinnedMesh.skeleton as unknown as SkeletonWithAttachments;

      // mesh.rotation.x = THREE.MathUtils.degToRad(-90); // Lay flat XZ
  
      // Add to scene.
      // shadowBone.add(mesh); // Add to scene.
      // Actually, if this is placed in the body model group, then
      // it will unintentionally be included for material changes.
      scene.add(mesh);
      // This will be a pain to track. detachAll() will control this.
      // Perhaps we should put attachment in the Object3D.
      skeleton.attach(mesh, boneName, true);
    }
  }

  const disposeModel = (model: THREE.Object3D) => {
    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (node.material instanceof THREE.Material) {
          const map: THREE.Texture | null = (node.material as THREE.MeshBasicMaterial).map;
          if (map) {
            map.dispose();
          }
          node.material.dispose();
        }
      }
      // Additionally dispose skeleton if it is a SkinnedMesh.
      if (node instanceof THREE.SkinnedMesh && node.skeleton) {
        node.skeleton.dispose();
      }
    });
  }

  const reloadBodyModelInScene = (newBody: BodyModel, oldMixer: THREE.AnimationMixer | null) => {
    newBody.model.position.set(position[0], position[1], position[2]);

    newBody.model.scale.setScalar(globalScale);
    
    // Set uniforms on the new body model, and attach the head to it.
    prepareBodyForCharModel(newBody.model, additionalInfo, build, height);
    if (currentHead) {
      attachHeadToBody(newBody, currentHead);
    }
    // Attach the shadow too, which should already be in the scene.
    if (currentShadowModel) {
      (currentShadowModel as THREE.Object3D).scale.setScalar(globalScale);
      attachShadowModelToBody(newBody, currentShadowModel);
    }
    // Dispose and remove the current body model from the scene.
    if (currentBody) {
      scene.remove(currentBody.model);
      if (oldMixer) { // Dispose mixer resources for this.
        oldMixer.stopAllAction();
        oldMixer.uncacheRoot(currentBody.model);
      }
      disposeModel(currentBody.model);
      // Remove all skeleton attachments.
      currentBody.model.traverse((node) => {
        if (node instanceof THREE.SkinnedMesh) {
          const skeleton: SkeletonWithAttachments = node.skeleton as unknown as SkeletonWithAttachments;
          if (currentHead && skeleton.detachAll) {
            skeleton.detachAll();
          }
        }
      });
    }
    // Add the body, which contains the head, to the scene.
    scene.add(newBody.model);
    currentBody = newBody;
  }

  const loadBodyModel = (gender: number) => {
    const gltf = bodyTemplates[gender];
    if (!gltf) {
      throw new Error(`No body template for gender ${gender}`);
    }
  
    /**
     * Cloned scene/group to avoid modifying the template.
     * In order to maintain proper skinning/armature animations,
     * SkeletonUtils.clone is used instead of gltf.scene.clone(true);
     * per donmccurdy's recommendation: https://discourse.threejs.org/t/how-to-clone-a-gltf/78858/2
     * @type {THREE.Object3D}
     */
    const model: THREE.Object3D = SkeletonUtils.clone(gltf.scene);
    // model.position.y = 45;
  
    // Assign one animation from the glTF model.
    const animations = gltf.animations;
    console.log({animations})

    // Always replace the existing mixer.
    mixer = new THREE.AnimationMixer(model);

    if (animations.length) {
      // Use the animation named 'Wait' if it exists, otherwise choose the first one.
      let clip = animations.find(a => a.name === 'Wait') ?? animations[0];
      const action = mixer.clipAction(clip);
      action.play().setLoop(THREE.LoopRepeat, Infinity);
      
      mixer.update(0);
    }
  
    const scaleDesc = detectModelDesc(model);
  
    return { model, scaleDesc, animations, mixer };
  }

  const updateCharModel = (headModel: THREE.Group) => {
    // breakFrameCounter = 0; // Use with breakOnCounter
    // Update global state from the new CharModel.
    build = additionalInfo.build;
    height = additionalInfo.height;
    gender = additionalInfo.gender;
  
    // Load the new body.
    const oldMixer = mixer;
    const newBody = loadBodyModel(gender);
  
    // Dispose and remove the old head.
    if (currentHead) {
      currentHead.removeFromParent(); // Remove from body group.
      disposeModel(currentHead);
    }
  
    currentHead = headModel;
  
    // Ready to replace the old body model now.
    reloadBodyModelInScene(newBody, oldMixer);
  }

  const animate = () => {
    requestAnimationFrame(animate);
  
    // breakOnFrameCounter();
    if (mixer) {
      // mixer.update(clock.getDelta());
      // Let's store the delta in this global, so that when
      // the mixer or animation changes, the time persists.
      animClockDelta += clock.getDelta();
      mixer.setTime(animClockDelta);

      // 🔹 Apply persistent head tilt after the mixer updates skeleton pose
      const body = currentBody?.model;
      const headBoneName = currentBody?.scaleDesc?.head;

      if (body && headBoneName) {
        const headBone = body.getObjectByName(headBoneName);
        if (headBone && headBone instanceof THREE.Bone) {
          headBone.rotation.x = THREE.MathUtils.degToRad(-45);
          headBone.updateMatrixWorld(true);
        }
      }
    }
  }

  useEffect(() => {
    if (!scene) return;
  
    requestAnimationFrame(() => {
      addSkeletonScalingExtensions(THREE.Skeleton);

      // Preload templates first
      preloadBodyTemplates().then(() => {
        loadCharModelFromGLTF(miiUrl).then((charModel) => {
          // This is crucial: reload the body **after skeleton extensions** are added
          updateCharModel(charModel);
        });
      });

      requestAnimationFrame(animate);
    });
  }, [scene]);

  return null; // This component doesn't render JSX, it just adds to the Three.js scene
}
