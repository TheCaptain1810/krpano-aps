import { initViewer, loadModel } from './viewer.js';

initViewer(document.getElementById('preview')).then(viewer => {
    window.apsViewer = viewer;
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);

    // Listen for camera control messages from parent
    window.addEventListener('message', (event) => {
        const { hlookat, vlookat, fov } = event.data || {};
        if (typeof hlookat === 'number' && typeof vlookat === 'number') {
            const target = viewer.navigation.getTarget() || new THREE.Vector3(0, 0, 0);
            const radius = viewer.navigation.getEyeVector().length();

            const phi = (90 - hlookat) * Math.PI / 180;
            const theta = (vlookat + 180) * Math.PI / 180;

            const x = target.x + radius * Math.sin(phi) * Math.cos(theta);
            const y = target.y + radius * Math.cos(phi);
            const z = target.z + radius * Math.sin(phi) * Math.sin(theta);

            const position = new THREE.Vector3(x, y, z);
            viewer.navigation.setView(position, target);

            if (typeof fov === 'number') {
                console.log('[APS Viewer] Received FOV from krpano:', fov);
                if (viewer.impl && viewer.impl.camera && viewer.navigation) {
                    const camera = viewer.impl.camera;
                    const target = viewer.navigation.getTarget();
                    // Calculate direction from target to camera
                    const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();
                    // Map krpano FOV (10-140) to camera distance (e.g., 30-300 units)
                    const minFov = 10, maxFov = 140;
                    const minDist = 30, maxDist = 300;
                    const t = (fov - minFov) / (maxFov - minFov);
                    // Exponential mapping for stronger zoom at lower FOVs
                    const newDistance = minDist + Math.pow(t, 1.5) * (maxDist - minDist);
                    // Set new camera position
                    const newPosition = new THREE.Vector3().addVectors(
                        target,
                        direction.multiplyScalar(newDistance)
                    );
                    viewer.navigation.setView(newPosition, target);
                    console.log('[APS Viewer] Set camera distance for FOV:', fov, '->', newDistance, '(range:', minDist, '-', maxDist, ')');
                }
            }
        }
    });
});

async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const models = await resp.json();
        dropdown.innerHTML = models.map(model => `<option value=${model.urn} ${model.urn === selectedUrn ? 'selected' : ''}>${model.name}</option>`).join('\n');
        dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
        if (dropdown.value) {
            onModelSelected(viewer, dropdown.value);
        }
    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn) {
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    window.location.hash = urn;
    try {
        const resp = await fetch(`/api/models/${urn}/status`);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const status = await resp.json();
        switch (status.status) {
            case 'n/a':
                showNotification(`Model has not been translated.`);
                break;
            case 'inprogress':
                showNotification(`Model is being translated (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showNotification(`Translation failed. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                clearNotification();
                loadModel(viewer, urn);
                break; 
        }
    } catch (err) {
        alert('Could not load model. See the console for more details.');
        console.error(err);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}
