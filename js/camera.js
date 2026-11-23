
export function createCameraController({ onState, onCapture }) {
  let stream = null;
  let focusMarker = null;
  let markerTimer = null;
  let diagnosticPanel = null;
  let diagnosticText = null;
  let focusSlider = null;
  let video = null;
  let focusListenerAdded = false;
  let focusMin = 0;
  let focusMax = 0;
  let focusQueue = Promise.resolve();

  const $ = (id) => document.getElementById(id);

  function showDiagnostic(message) {
    if (!diagnosticPanel) {
      diagnosticPanel = document.createElement('div');

      Object.assign(diagnosticPanel.style, {
        marginTop: '8px',
        padding: '10px',
        background: '#17201d',
        color: '#ffffff',
        border: '1px solid #e33b35',
        borderRadius: '8px',
        fontSize: '12px',
        lineHeight: '1.5',
        fontFamily: 'Arial, sans-serif',
        whiteSpace: 'pre-wrap'
      });

      diagnosticText = document.createElement('div');
      diagnosticPanel.appendChild(diagnosticText);

      $('cameraMessage').insertAdjacentElement(
        'afterend',
        diagnosticPanel
      );
    }

    diagnosticText.textContent = message;
  }

  function showFocusMarker(x, y) {
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

      $('cameraDialog').appendChild(focusMarker);
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

  async function applyManualFocus() {
    if (!stream || !focusSlider) return;

    const track = stream.getVideoTracks()[0];

    const percentage = Number(focusSlider.value) / 100;
    const distance =
      focusMin + (focusMax - focusMin) * percentage;

    focusQueue = focusQueue.then(async () => {
      if (!stream) return;

      try {
        await track.applyConstraints({
          focusDistance: { ideal: distance }
        });

        const settings = track.getSettings();
        const actual = settings.focusDistance;

        const result = actual !== undefined
          ? actual.toFixed(4)
          : 'não informado';

        showDiagnostic(
          `TESTE DE FOCO ISOLADO\n` +
          `Valor solicitado: ${distance.toFixed(4)}\n` +
          `Valor informado pela câmera: ${result}\n` +
          `Modo informado: ${settings.focusMode || 'não informado'}\n` +
          `Resolução: ${settings.width} × ${settings.height}\n\n` +
          `Observe se a nitidez muda ao movimentar o controle.`
        );

        onState(
          `Foco solicitado: ${distance.toFixed(4)} | Informado: ${result}`,
          'FOCUS TEST'
        );

      } catch (error) {
        console.error('Erro no foco manual:', error);

        showDiagnostic(
          `A câmera recusou o ajuste.\n` +
          `Erro: ${error.name}\n` +
          `${error.message}`
        );

        onState('Não foi possível alterar o foco.', 'FOCUS ERROR');
      }
    });

    await focusQueue;
  }

  function createFocusSlider() {
    if (!diagnosticPanel || focusSlider) return;

    const label = document.createElement('div');
    label.textContent = 'CONTROLE MANUAL DE FOCO';
    label.style.fontWeight = 'bold';
    label.style.marginTop = '10px';

    const instructions = document.createElement('div');
    instructions.textContent =
      'Deslize lentamente enquanto observa a carta.';
    instructions.style.marginBottom = '8px';

    focusSlider = document.createElement('input');
    focusSlider.type = 'range';
    focusSlider.min = '0';
    focusSlider.max = '100';
    focusSlider.step = '1';
    focusSlider.value = '50';
    focusSlider.style.width = '100%';
    focusSlider.style.accentColor = '#ffd84a';

    focusSlider.addEventListener('input', applyManualFocus);

    diagnosticPanel.appendChild(label);
    diagnosticPanel.appendChild(instructions);
    diagnosticPanel.appendChild(focusSlider);
  }

  function diagnose(track) {
    const capabilities = track.getCapabilities
      ? track.getCapabilities()
      : {};

    const settings = track.getSettings
      ? track.getSettings()
      : {};

    focusMin = capabilities.focusDistance?.min ?? 0;
    focusMax = capabilities.focusDistance?.max ?? 0;

    const modes = capabilities.focusMode || [];

    const report =
      `DIAGNÓSTICO DA CÂMERA\n` +
      `Resolução: ${settings.width} × ${settings.height}\n` +
      `Modos encontrados: ${modes.join(', ') || 'nenhum'}\n` +
      `Distância focal: ${focusMin} a ${focusMax}\n` +
      `Foco atual: ${settings.focusDistance ?? 'não informado'}`;

    showDiagnostic(report);

    if (focusMax > focusMin) {
      createFocusSlider();
    } else {
      showDiagnostic(report + '\n\nControle manual indisponível.');
    }
  }

  function focusAt(event) {
    if (!stream || !video) return;

    showFocusMarker(event.clientX, event.clientY);

    onState(
      'Região marcada. Use o controle para ajustar o foco.',
      'FOCUS'
    );
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
      diagnosticText = null;
    }

    focusSlider = null;
    focusQueue = Promise.resolve();

    clearTimeout(markerTimer);

    onState('Câmera desligada.', 'STANDBY');
  }

  return { open, capture, close };
}
