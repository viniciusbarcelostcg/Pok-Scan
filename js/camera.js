
export function createCameraController({ onState, onCapture }) {
  let stream = null;

  const $ = id => document.getElementById(id);

  async function open() {
    $('cameraDialog').showModal();

    onState(
      'A câmera será iniciada quando você autorizar o acesso.',
      'STARTING'
    );

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      });

      $('dialogVideo').srcObject = stream;
      $('dialogVideo').style.display = 'block';
      $('cameraPlaceholder').style.display = 'none';
      $('capture').disabled = false;

      onState(
        'Câmera conectada. Posicione a carta e capture.',
        'CAMERA ON'
      );

    } catch (error) {
      const message = error.name === 'NotAllowedError'
        ? 'Acesso negado. Autorize a câmera nas permissões do navegador.'
        : 'Não foi possível iniciar a câmera. Verifique o HTTPS e as permissões.';

      onState(message, 'CAMERA ERROR');
    }
  }

  function capture() {
    const video = $('dialogVideo');

    if (!video.videoWidth || !video.videoHeight) return;

    const canvas = $('captureCanvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext('2d').drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    onCapture(canvas);

    onState(
      'Imagem capturada. O reconhecimento será conectado nas próximas fases.',
      'CAPTURED'
    );
  }

  function close() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = null;

    $('dialogVideo').srcObject = null;
    $('dialogVideo').style.display = 'none';
    $('cameraPlaceholder').style.display = 'block';
    $('capture').disabled = true;

    onState(
      'A câmera será iniciada quando você autorizar o acesso.',
      'STANDBY'
    );
  }

  return { open, capture, close };
}