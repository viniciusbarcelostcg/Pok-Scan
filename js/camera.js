
export function createCameraController({ onState, onCapture }) {
  let stream = null;
  let focusMarker = null;
  let markerTimer = null;
  let diagnosticPanel = null;
  let video = null;
  let focusListenerAdded = false;

  const $ = (id) => document.getElementById(id);

  function createDiagnosticPanel() {
    if (diagnosticPanel) return;

    diagnosticPanel = document.createElement('div');

    Object.assign(diagnosticPanel.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      right: '12px',
      padding: '12px',
      background: 'rgba(15, 20, 28, 0.94)',
      color: '#ffffff',
      border: '1px solid #e33b35',
      borderRadius: '10px',
      fontSize: '12px',
      lineHeight: '1.6',
      fontFamily: 'Arial, sans-serif',
      whiteSpace: 'pre-wrap',
      zIndex: '2147483646',
      pointerEvents: 'none',
      display: 'none'
    });

    document.body.appendChild(diagnosticPanel);
  }

  function showDiagnostic(text) {
    createDiagnosticPanel();
    diagnosticPanel.textContent = text;
    diagnosticPanel.style.display = 'block';
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
        zIndex: '2147483647',
        display: 'none'
      });

      document.body.appendChild(focusMarker);
    }

    focusMarker.style.left = `${x}px`;
    focusMarker.style.top = `${y}px`;
    focusMarker.style.display = 'block';
    focusMarker.style.opacity = '1';

    clearTimeout(markerTimer);

    markerTimer = setTimeout(() => {
      if (focusMarker) {
        focusMarker.style.opacity = '0';
      }
    }, 1400);
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

      onState('Ponto de foco enviado à câmera.', 'FOCUS');

    } catch (error) {
      console.log('Erro no foco por toque:', error);

      onState(
        'Toque reconhecido, mas o foco por região não foi aceito.',
        'FOCUS LIMITED'
      );
    }
  }

  function diagnose(track) {
    let capabilities = {};
    let settings = {};
    let supported = {};

    try {
      capabilities = track.getCapabilities
        ? track.getCapabilities()
        : {};
    } catch (error) {
      console.log('Não foi possível consultar capacidades:', error);
    }

    try {
      settings = track.getSettings
        ? track.getSettings()
        : {};
    } catch (error) {
      console.log('Não foi possível consultar configurações:', error);
    }

    try {
      supported = navigator.mediaDevices.getSupportedConstraints();
    } catch (error) {
      console.log('Não foi possível consultar recursos:', error);
    }

    const modes = capabilities.focusMode || [];

    const yesNo = (value) => value ? 'SIM' : 'NÃO';

    const report = [
      'DIAGNÓSTICO DA CÂMERA',
      '',
      `Resolução: ${settings.width || '?'} × ${settings.height || '?'}`,
      '',
      `Foco contínuo: ${yesNo(modes.includes('continuous'))}`,
      `Foco manual: ${yesNo(modes.includes('manual'))}`,
      `Foco único: ${yesNo(modes.includes('single-shot'))}`,
      `Foco por região: ${yesNo(!!supported.pointsOfInterest)}`,
      '',
      `Modos encontrados: ${modes.length ? modes.join(', ') : 'Não informados'}`,
      '',
      `Distância focal mínima: ${capabilities.focusDistance?.min ?? 'Não informada'}`,
      `Distância focal máxima: ${capabilities.focusDistance?.max ?? 'Não informada'}`,
      '',
      `Zoom mínimo: ${capabilities.zoom?.min ?? 'Não informado'}`,
      `Zoom máximo: ${capabilities.zoom?.max ?? 'Não informado'}`,
      '',
      'Toque na imagem para testar o foco.'
    ].join('\n');

    showDiagnostic(report);

    console.log('Diagnóstico completo:', {
      capabilities,
      settings,
      supported
    });
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

      if (track.applyConstraints && track.getCapabilities) {
        const modes = track.getCapabilities().focusMode || [];

        if (modes.includes('continuous')) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
          } catch (error) {
            console.log('Foco contínuo não aceito:', error);
          }
        }
      }

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

    clearTimeout(markerTimer);

    onState('Câmera desligada.', 'STANDBY');
  }

  return { open, capture, close };
}
