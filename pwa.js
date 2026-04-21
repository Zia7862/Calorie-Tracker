let deferredInstallPrompt = null;
const installBtn = document.getElementById("install-app-btn");
const installHelpText = document.getElementById("install-help-text");

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installBtn) {
    installBtn.disabled = false;
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (isInStandaloneMode()) {
      installHelpText.textContent = "NutriTrack is already installed on this device.";
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }

    if (isIos()) {
      installHelpText.textContent = "On iPhone: tap Share, then 'Add to Home Screen'.";
      return;
    }

    installHelpText.textContent = "Use your browser menu and select 'Install app' or 'Add to Home screen'.";
  });
}
