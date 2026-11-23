
export function createCameraController({ onState, onCapture }) {
  let stream = null;
  let focusMarker = null;
  let markerTimer = null;
  let video = null;
  let focusListenerAdded = false;

  const $ = (id) => document.getElementById(id);

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
      const supported =
        navigator.mediaDevices.getSupportedConstraints();

      if (supported.pointsOfInterest) {
        await track.applyConstraints({
          advanced: [{
            pointsOfInterest: [{ x, y }]
          }]
        });

        onState('Ponto de foco enviado à câmera.', 'FOCUS');
      } else {
        onState(
          'Toque reconhecido. Foco por região não suportado pelo navegador.',
          'FOCUS LIMITED'
        );
      }
    } catch (error) {
      console.log('Erro no foco por toque:', error);

      onState(
        'Toque reconhecido, mas a câmera não aceitou o foco por região.',
        'FOCUS LIMITED'
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

    const supported =
      navigator.mediaDevices.getSupportedConstraints();

    const modes = capabilities.focusMode || [];

    const continuous = modes.includes('continuous')
      ? 'SIM'
      : 'NÃO';

    const manual = modes.includes('manual')
      ? 'SIM'
      : 'NÃO';

    const singleShot = modes.includes('single-shot')
      ? 'SIM'
      : 'NÃO';

    const region = supported.pointsOfInterest
      ? 'SIM'
      : 'NÃO';

    console.log('===== DIAGNÓSTICO POKÉSCAN =====');
    console.log('Resolução:', settings.width, 'x', settings.height);
    console.log('Modos de foco:', modes);
    console.log('Foco contínuo:', continuous);
    console.log('Foco manual:', manual);
    console.log('Foco de disparo único:', singleShot);
    console.log('Foco por região:', region);
    console.log('Recursos disponíveis:', capabilities);
    console.log('Configurações atuais:', settings);

    onState(
      `Diagnóstico: contínuo ${continuous} | manual ${manual} | toque ${region}`,
      'DIAGNOSTIC'
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
        `Câmera ativa: ${video.videoWidth} × ${video.videoHeight}. Toque na imagem.`,
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

    clearTimeout(markerTimer);

    onState('Câmera desligada.', 'STANDBY');
  }

  return { open, capture, close };
}
