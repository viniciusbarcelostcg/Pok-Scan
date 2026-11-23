
export function createCameraController({ onState, onCapture }) {
  let stream = null;
  let focusMarker = null;
  let markerTimer = null;

  const $ = (id) => document.getElementById(id);

  function showFocusMarker(dialog, x, y) {
    if (!focusMarker) {
      focusMarker = document.createElement('div');

      Object.assign(focusMarker.style, {
        position: 'absolute',
        width: '54px',
        height: '54px',
        border: '2px solid #ffd84a',
        borderRadius: '8px',
        boxShadow: '0 0 10px rgba(255,216,74,.55)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: '9999',
        display: 'none',
        transition: 'opacity .2s ease'
      });

      dialog.appendChild(focusMarker);
    }

    const rect = dialog.getBoundingClientRect();

    focusMarker.style.left = `${x - rect.left}px`;
    focusMarker.style.top = `${y - rect.top}px`;
    focusMarker.style.display = 'block';
    focusMarker.style.opacity = '1';

    clearTimeout(markerTimer);

    markerTimer = setTimeout(() => {
      if (focusMarker) {
        focusMarker.style.opacity = '0';
      }
    }, 1200);
  }

  async function focusAt(video, event) {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const rect = video.getBoundingClientRect();

    const x = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );

    const y = Math.max(
      0,
      Math.min(1, (event.clientY - rect.top) / rect.height)
    );

    showFocusMarker($('cameraDialog'), event.clientX, event.clientY);

    try {
      const supported = navigator.mediaDevices.getSupportedConstraints();

      if (supported.pointsOfInterest) {
        await track.applyConstraints({
          advanced: [{
            pointsOfInterest: [{ x, y }],
            focusMode: 'continuous'
          }]
        });

        onState('Ajustando foco no ponto selecionado...', 'FOCUS');
        return;
      }

      const capabilities = track.getCapabilities?.();

      if (capabilities?.focusMode?.includes('single-shot')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'single-shot' }]
        });

        onState('Solicitando ajuste automático de foco...', 'FOCUS');
        return;
      }

      onState(
        'Foco por toque não disponível neste aparelho.',
        'FOCUS LIMITED'
      );

    } catch (error) {
      console.log('Foco por toque indisponível:', error);

      onState(
        'A câmera não aceitou o ajuste de foco por toque.',
        'FOCUS LIMITED'
      );
    }
  }

  async function open() {
    const dialog = $('cameraDialog');
    const video = $('dialogVideo');
    const placeholder = $('cameraPlaceholder');
    const captureButton = $('capture');

    if (!dialog || !video || !placeholder || !captureButton) {
      onState('Elementos da câmera não encontrados.', 'CAMERA ERROR');
      return;
    }

    if (stream) close();

    if (!dialog.open) dialog.showModal();

    onState('Solicitando câmera em alta resolução...', 'STARTING');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }

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

      const track = stream.getVideoTracks()[0];

      if (track?.getCapabilities) {
        const capabilities = track.getCapabilities();

        if (
          capabilities.focusMode &&
          capabilities.focusMode.includes('continuous')
        ) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
          } catch (error) {
            console.log('Foco contínuo indisponível:', error);
          }
        }
      }

      await video.play();

      captureButton.disabled = false;

      onState(
        `Câmera ativa: ${video.videoWidth} × ${video.videoHeight}. Toque para focar.`,
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
    const video = $('dialogVideo');

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

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

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

    const video = $('dialogVideo');
    const placeholder = $('cameraPlaceholder');
    const captureButton = $('capture');

    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }

    if (placeholder) placeholder.style.display = 'block';
    if (captureButton) captureButton.disabled = true;

    if (focusMarker) {
      focusMarker.remove();
      focusMarker = null;
    }

    clearTimeout(markerTimer);

    onState('Câmera desligada.', 'STANDBY');
  }

  const video = $('dialogVideo');

  if (video && !video.dataset.focusListener) {
    video.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'mouse') {
        focusAt(video, event);
      }
    });

    video.dataset.focusListener = 'true';
  }

  return { open, capture, close };
}
