'use strict';

// "Install app" button. On Android, and in Chrome or Edge on a computer, the
// browser hands the page an install prompt that our own button can trigger.
// iPhones have no such prompt, so there the button explains the taps it takes.

let installPrompt = null;

function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIos() {
  // Newer iPads report themselves as a Mac, but a Mac has no touch screen
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

// Worth offering: not installed yet, and either the browser has a prompt ready or it's a phone
function canOfferInstall() {
  return !isInstalled() && (!!installPrompt || isIos() || isAndroid());
}

// Re-draw so the button appears or disappears, unless someone is mid-typing or in a dialog
function refreshForInstall() {
  const typing = document.activeElement && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (!typing && !modalOpen()) render();
}

addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // keep the browser's own pop-up back until our button is tapped
  installPrompt = e;
  refreshForInstall();
});

addEventListener('appinstalled', () => {
  installPrompt = null;
  closeModal();
  toast('GymLog is installed. Look for its icon on your home screen.', 'good');
  render();
});

// The strip at the top of the dashboard
function installBanner() {
  if (!canOfferInstall() || state.settings.installDismissed) return '';
  return `<section class="card banner c-12 row between wrap">
    <span class="stack"><strong>Install GymLog on this ${isIos() || isAndroid() ? 'phone' : 'device'}</strong>
      <span class="muted small">It opens full screen from its own icon and works without signal.</span></span>
    <span class="row gap-s">
      <button class="btn primary" data-action="install-app">${icon('download', 16)} Install app</button>
      <button class="btn" data-action="install-dismiss">Not now</button>
    </span>
  </section>`;
}

// The card on the Tools page, always there so the button can be found again
function installCard() {
  return `<section class="card">
    <div class="card-head"><h3>Install the app</h3></div>
    ${isInstalled()
      ? '<p class="muted small">✓ You are using the installed app.</p>'
      : `<p class="muted small">Put GymLog on your home screen. It opens full screen from its own icon and works without signal.</p>
        <div><button class="btn primary" data-action="install-app">${icon('download', 16)} Install app</button></div>`}
  </section>`;
}

function installSteps() {
  if (isIos()) {
    return [
      'Open this page in <strong>Safari</strong>, if it isn’t already.',
      `Tap the <strong>Share</strong> button ${icon('share', 16)} at the bottom of the screen.`,
      'Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.',
    ];
  }
  if (isAndroid()) {
    return [
      'Tap the <strong>⋮</strong> menu at the top right of your browser.',
      'Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
      'Confirm with <strong>Install</strong>.',
    ];
  }
  return [
    'Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.',
    'Click the <strong>install icon</strong> at the right-hand end of the address bar, or open the browser menu and choose <strong>Install GymLog</strong>.',
    'Confirm with <strong>Install</strong>.',
  ];
}

Actions['install-app'] = async () => {
  if (installPrompt) {
    // A prompt can only be shown once; the browser sends a fresh one if it is turned down
    const prompt = installPrompt;
    installPrompt = null;
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* nothing to do: the banner stays or goes on the next event */ }
    render();
    return;
  }
  const local = location.protocol !== 'https:';
  openModal(`<div class="modal-head"><h2>Install GymLog</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
    <p class="muted">${isIos() ? 'iPhones install web apps from the Share menu. It takes three taps:' : 'Your browser installs apps from its own menu:'}</p>
    <ol class="install-steps">${installSteps().map(step => `<li>${step}</li>`).join('')}</ol>
    <p class="muted small">Afterwards GymLog has its own icon, opens full screen and works without signal.</p>
    ${isIos()
      ? '<p class="note">On an iPhone the installed app keeps its own data and can start out empty. If you have already logged workouts here, use <strong>Tools → Export backup</strong> first, then <strong>Import backup</strong> in the installed app.</p>'
      : '<p class="muted small">Everything you have logged stays.</p>'}
    ${local ? '<p class="note">Installing only works from the app’s web address. This copy is running from this computer.</p>' : ''}
    <button class="btn primary wide" data-action="close-modal">Got it</button>`);
};

Actions['install-dismiss'] = () => {
  state.settings.installDismissed = true;
  persist();
  render();
};
