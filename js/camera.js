
export function createCameraController({ onState, onCapture }) {
  let stream = null;
  let focusMarker = null;
  let markerTimer = null;
  let diagnosticPanel = null;
  let focusSlider = null;
  let video = null;
  let focusListenerAdded = false;
  let focusMin = 0;
  let focusMax = 0;

  const $ = (id) => document.getElementById(id);

  function createDiagnosticPanel() {
    if (diagnosticPanel) return;

    diagnosticPanel = document.createElement('div');

    Object.assign(diagnosticPanel.style, {
      marginTop: '8px',
      padding: '10px',
      background: '#17201d',
      color: '#ffffff',
      border: '1px solid #e33b35',
      borderRadius: '8px',
      fontSize: '11px',
      lineHeight: '1.5',
      fontFamily: 'Arial, sans-serif',
      whiteSpace: 'pre-wrap',
      maxHeight: '180px',
      overflowY: 'auto'
    });

    $('cameraMessage').insertAdjacentElement(
      'afterend',
      diagnosticPanel
    );
  }

  function showFocusMarker(x, y) {
    const dialog = $('cameraDialog');

    if (!focusMarker) {
      focusMarker = document.createElement('div');

      Object.assign(focusMarker.style, {
        position: 'fixed',
        width: '58px',
        height: '58px',
        border: '3px solid #ffd84a',
        borderRadius: '8px',
        boxShadow: '0 0 12px rgba(255,216,74,.8)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: '2147483647'
      });

      dialog.appendChild(focusMarker);
    }

    focusMarker.style.left = `${x}px`;
    focusMarker.style.top = `${y}px`;
    focusMarker.style.display = 'block';
    focusMarker.style.opacity = '1';

    clearTimeout(markerTimer);

    markerTimer = setTimeout(() => {
      if (focusMarker) focusMarker.style.opacity = '0';
    }, 1400);
  }

  async function changeManualFocus() {
    if (!stream || !focusSlider) return;

    const track = stream.getVideoTracks()[0];

    const percentage = Number(focusSlider.value) / 100;
    const distance = focusMin + (focusMax - focusMin) * percentage;

    try {
      await track.applyConstraints({
        advanced: [{
          focusMode: 'manual',
          focusDistance: distance
        }]
      });

      const settings = track.getSettings();
      const actual = settings.focusDistance;

      onState(
        actual !== undefined
          ? `Foco manual aplicado: ${actual.toFixed(3)}`
          : 'Comando de foco manual enviado.',
        'MANUAL FOCUS'
      );

    } catch (error) {
      console.error('Erro no foco manual:', error);

      onState(
        'A câmera não aceitou esse ajuste de foco.',
        'FOCUS ERROR'
      );
    }
  }

  async function focusAt(event) {
    if (!stream || !video) return;

    const rect = video.getBoundingClientRect();

    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );

    const y = Math.max(
      0,
      Math.min(1, (event.clientY - rect.top) / rect.height)
    );

    showFocusMarker(event.clientX, event.clientY);

    const track = stream.getVideoTracks()[0];

    try {
      await track.applyConstraints({
        advanced: [{
          pointsOfInterest: [{ x, y }]
        }]
      });

      onState(
        'Região selecionada. Ajuste o foco manual no controle abaixo.',
        'FOCUS'
      );

    } catch (error) {
      onState(
        'Região marcada. Ajuste o foco pelo controle manual.',
        'FOCUS'
      );
    }
  }

  function diagnose(track) {
    const capabilities = track.getCapabilities
      ? track.getCapabilities()
      : {};

    const settings = track.getSettings
      ? track.getSettings()
      : {};

    const modes = capabilities.focusMode || [];

    focusMin = capabilities.focusDistance?.min ?? 0;
    focusMax = capabilities.focusDistance?.max ?? 0;

    createDiagnosticPanel();

    diagnosticPanel.textContent = [
      'DIAGNÓSTICO DA CÂMERA',
      `Resolução: ${settings.width || '?'} × ${settings.height || '?'}`,
      `Foco contínuo: ${modes.includes('continuous') ? 'SIM' : 'NÃO'}`,
      `Foco manual: ${modes.includes('manual') ? 'SIM' : 'NÃO'}`,
      `Foco por região: ${navigator.mediaDevices.getSupportedConstraints().pointsOfInterest ? 'SIM' : 'NÃO'}`,
      `Distância focal: ${focusMin.toFixed(4)} a ${focusMax.toFixed(4)}`
    ].join('\n');

    if (modes.includes('manual') && focusMax > focusMin) {
      const label = document.createElement('div');
      label.textContent = 'AJUSTE MANUAL DE FOCO';
      label.style.marginTop = '12px';
      label.style.fontWeight = 'bold';

      const instructions = document.createElement('div');
      instructions.textContent = 'Deslize lentamente até encontrar a imagem mais nítida.';
      instructions.style.marginBottom = '8px';

      focusSlider = document.createElement('input');
      focusSlider.type = 'range';
      focusSlider.min = '0';
      focusSlider.max = '100';
      focusSlider.step = '1';
      focusSlider.value = '50';

      focusSlider.style.width = '100%';
      focusSlider.style.accentColor = '#ffd84a';

      focusSlider.addEventListener('change', changeManualFocus);

      diagnosticPanel.appendChild(label);
      diagnosticPanel.appendChild(instructions);
      diagnosticPanel.appendChild(focusSlider);
    } else {
      const message = document.createElement('div');
      message.textContent = 'Controle manual de distância indisponível.';
      diagnosticPanel.appendChild(message);
    }
  }

  function addFocusListener() {
    if (!video || focusListenerAdded) return;

    video.addEventListener('pointerdown', focusAt);
    focusListenerAdded = true;
  }

  async function open() {
    const dialog = $('cameraDialog');
    video = $('dialogVideo');

    const placeholder = $('cameraPlaceholder');
    const captureButton = $('capture');

    if (!dialog || !video || !placeholder || !captureButton) {
      onState('Elementos da câmera não encontrados.', 'CAMERA ERROR');
      return;
    }

    if (stream) close();

    if (!dialog.open) dialog.showModal();

    onState('Iniciando câmera...', 'STARTING');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 2560 },
          frameRate: { ideal: 30, max: 30 }
        }
      });

      video.srcObject = stream;
      video.style.display = 'block';
      video.style.cursor = 'crosshair';
      video.style.touchAction = 'manipulation';

      placeholder.style.display = 'none';

      await video.play();

      const track = stream.getVideoTracks()[0];

      addFocusListener();
      diagnose(track);

      captureButton.disabled = false;

      onState(
        `Câmera ativa: ${video.videoWidth} × ${video.videoHeight}`,
        'CAMERA ON'
      );

    } catch (error) {
      console.error('Erro na câmera:', error);
      stream = null;

      onState(
        error.name === 'NotAllowedError'
          ? 'Acesso à câmera negado.'
          : 'Não foi possível iniciar a câmera.',
        'CAMERA ERROR'
      );
    }
  }

  function capture() {
    if (!video || !video.videoWidth || !video.videoHeight) {
      onState('Aguarde a câmera iniciar.', 'WAITING');
      return;
    }

    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      onState('Erro ao processar a imagem.', 'CAMERA ERROR');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas);

    onState(
      `Imagem capturada: ${canvas.width} × ${canvas.height}`,
      'CAPTURED'
    );
  }

  function close() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }

    const placeholder = $('cameraPlaceholder');
    const captureButton = $('capture');

    if (placeholder) placeholder.style.display = 'block';
    if (captureButton) captureButton.disabled = true;

    if (focusMarker) {
      focusMarker.remove();
      focusMarker = null;
    }

    if (diagnosticPanel) {
      diagnosticPanel.remove();
      diagnosticPanel = null;
    }

    focusSlider = null;
    clearTimeout(markerTimer);

    onState('Câmera desligada.', 'STANDBY');
  }

  return { open, capture, close };
}
