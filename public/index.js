let krpano = null;

const inputFocusState = {
  hlookat: false,
  vlookat: false,
  fov: false,
};

function setupInputFocusTracking() {
  ["hlookat", "vlookat", "fov"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("focus", () => (inputFocusState[id] = true));
      el.addEventListener("blur", () => (inputFocusState[id] = false));
      el.addEventListener("change", () => applyCameraView());
      el.addEventListener("keypress", (e) => {
        if (e.key === "Enter") applyCameraView();
      });
    } else {
      console.warn(`Input element with ID "${id}" not found.`);
    }
  });
}

function syncInputsFromKrpano() {
  if (!krpano) return;
  const hlookatEl = document.getElementById("hlookat");
  const vlookatEl = document.getElementById("vlookat");
  const fovEl = document.getElementById("fov");
  const h = krpano.get("view.hlookat");
  const v = krpano.get("view.vlookat");
  const f = krpano.get("view.fov");
  if (hlookatEl && h !== undefined) hlookatEl.value = Math.max(-180, Math.min(180, h)).toFixed(2);
  if (vlookatEl && v !== undefined) vlookatEl.value = Math.max(-90, Math.min(90, v)).toFixed(2);
  if (fovEl && f !== undefined) fovEl.value = Math.max(10, Math.min(140, f)).toFixed(2);
}

function krpano_onready(krpano_interface) {
  krpano = krpano_interface;
  console.log("krpano is ready!");
  if (krpano) {
    syncInputsFromKrpano();
    krpano.set("events.onviewchange", "js(syncInputsFromKrpano());");
  } else {
    console.error("krpano interface not properly initialized.");
  }
}

function embedKrpanoWithFallback() {
  try {
    embedpano({
      swf: "tour.swf",
      xml: "tour.xml",
      target: "pano",
      html5: "auto",
      onready: krpano_onready,
      onerror: (error) => console.error("krpano embedding failed:", error),
    });
  } catch (e) {
    console.error("Failed to embed krpano:", e);
  }
}

function applyCameraView(hlookat, vlookat, fov, tweenTime) {
  if (!krpano) {
    console.error("krpano object not available.");
    return;
  }

  const hlookatEl = document.getElementById("hlookat");
  const vlookatEl = document.getElementById("vlookat");
  const fovEl = document.getElementById("fov");
  const tweenTimeEl = document.getElementById("tweenTime");

  // Ensure FOV input is always valid
  if (fovEl && (fovEl.value === '' || isNaN(parseFloat(fovEl.value)))) {
    const currentFov = krpano.get("view.fov") || 90;
    fovEl.value = Math.max(10, Math.min(140, currentFov)).toFixed(2);
  }

  let targetH =
    hlookat !== undefined
      ? hlookat
      : parseFloat(hlookatEl ? hlookatEl.value : 0);
  let targetV =
    vlookat !== undefined
      ? vlookat
      : parseFloat(vlookatEl ? vlookatEl.value : 0);
  let targetFov =
    fov !== undefined ? fov : parseFloat(fovEl ? fovEl.value : 90);
  const targetTweenTime =
    tweenTime !== undefined
      ? tweenTime
      : parseFloat(tweenTimeEl ? tweenTimeEl.value : 1);

  // Clamp input values
  targetH = Math.max(-180, Math.min(180, targetH));
  targetV = Math.max(-90, Math.min(90, targetV));
  targetFov = Math.max(10, Math.min(140, targetFov));

  if (
    isNaN(targetH) ||
    isNaN(targetV) ||
    isNaN(targetFov) ||
    isNaN(targetTweenTime)
  ) {
    console.error("Invalid camera parameters. Using defaults.");
    applyCameraView(
      krpano.get("view.hlookat") || 0,
      krpano.get("view.vlookat") || 0,
      krpano.get("view.fov") || 90,
      1
    );
    return;
  }

  console.log("Applying camera view:", {
    hlookat: targetH,
    vlookat: targetV,
    fov: targetFov,
    tweenTime: targetTweenTime,
  });

  const krpanoCommand = `lookto(${targetH}, ${targetV}, ${targetFov}, ${targetTweenTime}, true, true, true);`;
  try {
    krpano.call(krpanoCommand);
    if (hlookatEl) hlookatEl.value = targetH.toFixed(2);
    if (vlookatEl) vlookatEl.value = targetV.toFixed(2);
    if (fovEl) fovEl.value = targetFov.toFixed(2);
  } catch (e) {
    console.error("Error executing krpano command:", e);
  }

  setTimeout(() => {
    if (krpano) {
      const currentFov = krpano.get("view.fov");
      if (fovEl && currentFov !== undefined) {
        fovEl.value = Math.max(10, Math.min(140, currentFov)).toFixed(2);
      }
      console.log("krpano view after call:", {
        hlookat: krpano.get("view.hlookat"),
        vlookat: krpano.get("view.vlookat"),
        fov: krpano.get("view.fov"),
      });
    }
  }, Math.max(1, targetTweenTime * 1000));
}

function zoomIn() {
  if (!krpano) return;
  const currentFov = krpano.get("view.fov") || 90;
  const fovMin = 10;
  const newFov = Math.max(currentFov - 10, fovMin);
  applyCameraView(
    krpano.get("view.hlookat"),
    krpano.get("view.vlookat"),
    newFov,
    0.5
  );
  const fovEl = document.getElementById("fov");
  if (fovEl) fovEl.value = newFov.toFixed(2);
}

function zoomOut() {
  if (!krpano) return;
  const currentFov = krpano.get("view.fov") || 90;
  const fovMax = 140;
  const newFov = Math.min(currentFov + 10, fovMax);
  applyCameraView(
    krpano.get("view.hlookat"),
    krpano.get("view.vlookat"),
    newFov,
    0.5
  );
  const fovEl = document.getElementById("fov");
  if (fovEl) fovEl.value = newFov.toFixed(2);
}

document.addEventListener("DOMContentLoaded", () => {
  setupInputFocusTracking();
  embedKrpanoWithFallback();
  // Add event listeners for zoom buttons
  const zoomInBtn = document.getElementById("zoomIn");
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
  const zoomOutBtn = document.getElementById("zoomOut");
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);

  // Arrow button logic
  const arrowUp = document.getElementById("arrow-up");
  const arrowDown = document.getElementById("arrow-down");
  const arrowLeft = document.getElementById("arrow-left");
  const arrowRight = document.getElementById("arrow-right");
  const hlookatEl = document.getElementById("hlookat");
  const vlookatEl = document.getElementById("vlookat");
  const stepH = 10; // degrees per press
  const stepV = 10;

  if (arrowUp) arrowUp.addEventListener("click", () => {
    if (vlookatEl) {
      let v = parseFloat(vlookatEl.value) || 0;
      v = Math.min(90, v + stepV);
      vlookatEl.value = v.toFixed(2);
    }
    applyCameraView();
  });
  if (arrowDown) arrowDown.addEventListener("click", () => {
    if (vlookatEl) {
      let v = parseFloat(vlookatEl.value) || 0;
      v = Math.max(-90, v - stepV);
      vlookatEl.value = v.toFixed(2);
    }
    applyCameraView();
  });
  if (arrowLeft) arrowLeft.addEventListener("click", () => {
    if (hlookatEl) {
      let h = parseFloat(hlookatEl.value) || 0;
      h -= stepH;
      if (h < -180) h += 360;
      hlookatEl.value = h.toFixed(2);
    }
    applyCameraView();
  });
  if (arrowRight) arrowRight.addEventListener("click", () => {
    if (hlookatEl) {
      let h = parseFloat(hlookatEl.value) || 0;
      h += stepH;
      if (h > 180) h -= 360;
      hlookatEl.value = h.toFixed(2);
    }
    applyCameraView();
  });
});
