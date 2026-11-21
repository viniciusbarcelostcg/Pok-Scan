
export function setStatus(message) {
  const status = document.getElementById('status');

  if (status) {
    status.textContent = message;
  }
}

export function showInfo(title, message) {
  const titleElement = document.getElementById('title');
  const infoElement = document.getElementById('info');

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (infoElement) {
    infoElement.textContent = message;
  }
}

export function beep(enabled = false) {
  if (!enabled) return;

  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();

    oscillator.frequency.value = 650;
    volume.gain.value = 0.03;

    oscillator.connect(volume);
    volume.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.08);

    oscillator.onended = () => audio.close();
  } catch (error) {
    console.warn('Não foi possível reproduzir o som:', error);
  }
}