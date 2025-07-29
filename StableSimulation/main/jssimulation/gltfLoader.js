import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function loadFacultyModels(scene, camera, controls, renderer) {
    // console.log('[GLTF] loadFacultyModels called');
    return new Promise((resolve, reject) => {
        const gltfLoader = new GLTFLoader();
        let loadedModels = 0;
        const totalModels = 3;
        
        function checkAllLoaded() {
            loadedModels++;
            if (loadedModels === totalModels) {
                resolve();
            }
        }
        
        // Load GornjiDeo.glb
        gltfLoader.load('./assets/GornjiDeo.glb', function (gltf) {
            const model2 = gltf.scene;
            model2.scale.set(1, 1, 1);
            model2.rotation.x = Math.PI / 2;
            model2.position.set(690947, 5336192, 14.7);
            scene.add(model2);
            checkAllLoaded();
        }, undefined, function (error) {
            console.error('[GLTF] Error loading GornjiDeo.glb:', error);
            checkAllLoaded(); // Continue even if one model fails
        });

        // Load DonjiDeo.glb
        gltfLoader.load('./assets/DonjiDeo.glb', function (gltf) {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.position.set(690885, 5335887, 17.5);
            model.rotation.x = Math.PI / 2;
            scene.add(model);
            model.updateMatrixWorld(true);

            const modelPos = new THREE.Vector3();
            model.getWorldPosition(modelPos);

            camera.position.set(690950, 5336000, 400);
            controls.target.set(690950, 5336000, 0);
            controls.update();
            checkAllLoaded();
        }, undefined, function (error) {
            console.error('[GLTF] Error loading DonjiDeo.glb:', error);
            checkAllLoaded();
        });

        // Load Trees.glb (drvece)
        gltfLoader.load('./assets/drvece.glb', function (gltf) {
            const drvece = gltf.scene;
            drvece.name = 'drvece';
            drvece.scale.set(1, 1, 1);
            drvece.position.set(691075, 5336007, 0);
            drvece.rotation.x = Math.PI / 2;
            scene.add(drvece);
            checkAllLoaded();
        }, function (progress) {
            // console.log('[GLTF] Trees loading progress:', (progress.loaded / progress.total * 100) + '%');
        }, function (error) {
            console.error('[GLTF] Error loading Trees.glb:', error);
            console.error('[GLTF] Error details:', error.message);
            checkAllLoaded();
        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    });
}