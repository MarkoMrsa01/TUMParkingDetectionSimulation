import * as THREE from 'three';

export function renderLegendModel(scene, camera, controls, renderer) {
    if (!renderer || !renderer.domElement) {
        return;
    }
    const legendCanvas = document.getElementById('vehicleModelCanvas');
    const legendRenderer = new THREE.WebGLRenderer({ canvas: legendCanvas, alpha: true });
    legendRenderer.setSize(60, 30);

    const legendScene = new THREE.Scene();
    const legendCamera = new THREE.PerspectiveCamera(45, 2, 0.1, 1000);
    legendCamera.position.set(0, 0.2, 3.2);
    legendCamera.lookAt(0, 0, 0);

    const geometry = new THREE.BoxGeometry(1, 0.5, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00008e });
    const model = new THREE.Mesh(geometry, material);
    model.scale.set(1.2, 0.6, 2.2);
    model.position.y = 0.05;
    legendScene.add(model);

    function animateLegend() {
        requestAnimationFrame(animateLegend);
        model.rotation.y += 0.05;
        legendRenderer.render(legendScene, legendCamera);
    }
    animateLegend();
} 