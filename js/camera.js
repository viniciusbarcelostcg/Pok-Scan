
export function createCameraController({ onState, onCapture }) {
  let stream = null;

  const $ = (id) => document.getElementById(id);

  async function open() {
    const dialog = $('cameraDialog');
    const video = $('cameraVideo');
    const placeholder = $('placeholder');
    const captureButton = $('capture');

    if (!dialog || !video || !placeholder || !captureButton) {
      onState('Não foi possível localizar os elementos da câmera.', 'CAMERA ERROR');
      return;
    }

    if (!dialog.open) dialog.showModal();

    onState('Aguardando autorização para acessar a câmera.', 'STARTING');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';
      await video.play();

      captureButton.disabled = false;
      onState('Câmera conectada. Posicione a carta e capture.', 'CAMERA ON');

    } catch (error) {
      const message = error.name === 'NotAllowedError'
        ? 'Acesso à câmera negado. Verifique as permissões.'
        : 'Não foi possível iniciar a câmera. Verifique o HTTPS e as permissões.';

      onState(message, 'CAMERA ERROR');
    }
  }

  function capture() {
    const video = $('cameraVideo');

    if (!video || !video.videoWidth || !video.videoHeight) {
      onState('Aguarde a câmera iniciar antes de capturar.', 'WAITING');
      return;
    }

    let canvas = $('captureCanvas');

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'captureCanvas';
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    onCapture(canvas);
    onState('Imagem capturada com sucesso.', 'CAPTURED');
  }

  function close() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    const video = $('cameraVideo');
    const placeholder = $('placeholder');
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