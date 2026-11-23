
export function createCameraController({ onState, onCapture }) {
  let stream = null;

  const $ = (id) => document.getElementById(id);

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

    onState('Câmera desligada.', 'STANDBY');
  }

  return { open, capture, close };
}