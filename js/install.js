'use strict';

// "Install app" button. On Android, and in Chrome or Edge on a computer, the
// browser hands the page an install prompt that our own button can trigger.
// iPhones have no such prompt, so there the button explains the taps it takes.
//
// Android installs in the background with no second confirmation, which looks
// like nothing happened. So after the prompt is accepted we say what is going
// on and where the icon will turn up.

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
  return !isInstalled() && !state.settings.installed && (!!installPrompt || isIos() || isAndroid());
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

// The browser's own word that the install went through
addEventListener('appinstalled', () => {
  installPrompt = null;
  state.settings.installed = true;
  persist();
  const status = $('#install-status');
  if (status) status.innerHTML = installedHtml();
  else toast('GymLog is installed. Look for its icon on your home screen or in your app list.', 'good');
  if (!modalOpen()) render();
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
  const body = isInstalled() ? '<p class="muted small">✓ You are using the installed app.</p>'
    : state.settings.installed ? `<p class="muted small">✓ GymLog was installed on this device. Open it from its icon on your home screen or in your app list, not from the browser.</p>
        <div><button class="btn" data-action="install-app">${icon('download', 16)} Install again</button></div>`
      : `<p class="muted small">Put GymLog on your home screen. It opens full screen from its own icon and works without signal.</p>
        <div><button class="btn primary" data-action="install-app">${icon('download', 16)} Install app</button></div>`;
  return `<section class="card"><div class="card-head"><h3>Install the app</h3></div>${body}</section>`;
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
      'Tap <strong>Add to Home screen</strong> (some browsers call it <strong>Install app</strong>).',
      'Tap <strong>Install</strong>. The icon is added a few seconds later.',
    ];
  }
  return [
    'Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.',
    'Click the <strong>install icon</strong> at the right-hand end of the address bar, or open the browser menu and choose <strong>Install GymLog</strong>.',
    'Confirm with <strong>Install</strong>.',
  ];
}

const whereToLook = () => isAndroid()
  ? 'Go to your home screen. If the GymLog icon is not there, open your full app list and look under G.'
  : 'Look for the GymLog icon on your home screen, desktop or app list.';

function installedHtml() {
  return `<div class="hero-icon">✅</div>
    <h2>GymLog is installed</h2>
    <p class="muted">${whereToLook()} Open it from that icon from now on; you can close this browser tab.</p>
    <button class="btn primary wide" data-action="close-modal">Got it</button>`;
}

// Shown the moment the browser's install prompt is accepted
function showInstalling() {
  openModal(`<div class="summary" id="install-status">
      <div class="hero-icon">📲</div>
      <h2>Adding GymLog to your ${isAndroid() ? 'phone' : 'device'}</h2>
      <p class="muted">That was the only confirmation. The app is now being added in the background, which can take up to a minute.</p>
      <p class="note left">${whereToLook()}</p>
      <div class="row gap-s">
        <button class="btn grow" data-action="install-help">No icon after a minute?</button>
        <button class="btn primary grow" data-action="close-modal">Got it</button>
      </div>
    </div>`);
}

// The manual route, for iPhones and for when the one-tap prompt is not available
function showInstallHelp() {
  const local = location.protocol !== 'https:';
  openModal(`<div class="modal-head"><h2>Install GymLog</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
    <p class="muted">${isIos() ? 'iPhones install web apps from the Share menu. It takes three taps:' : 'Your browser can install it from its own menu:'}</p>
    <ol class="install-steps">${installSteps().map(step => `<li>${step}</li>`).join('')}</ol>
    <p class="muted small">Afterwards GymLog has its own icon, opens full screen and works without signal.</p>
    ${isIos()
      ? '<p class="note">On an iPhone the installed app keeps its own data and can start out empty. If you have already logged workouts here, use <strong>Tools → Export backup</strong> first, then <strong>Import backup</strong> in the installed app.</p>'
      : '<p class="muted small">Everything you have logged stays.</p>'}
    ${local ? '<p class="note">Installing only works from the app’s web address. This copy is running from this computer.</p>' : ''}
    <button class="btn primary wide" data-action="close-modal">Got it</button>`);
}

Actions['install-help'] = () => showInstallHelp();

Actions['install-app'] = async () => {
  if (!installPrompt) return showInstallHelp();
  // A prompt can only be shown once; the browser sends a fresh one if it is turned down
  const prompt = installPrompt;
  installPrompt = null;
  let outcome;
  try {
    await prompt.prompt();
    outcome = (await prompt.userChoice).outcome;
  } catch {
    return showInstallHelp(); // the browser refused to show its prompt: fall back to the menu steps
  }
  if (outcome === 'accepted') return showInstalling();
  render();
  toast('Install cancelled. The button is always under Tools.');
};

Actions['install-dismiss'] = () => {
  state.settings.installDismissed = true;
  persist();
  render();
};
