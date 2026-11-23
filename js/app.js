import { createCameraController } from './camera.js';
import { initializeSearch } from './card-catalog.js';
import { setStatus, showInfo, beep } from './ui.js';

(() => {
  const $ = (id) => document.getElementById(id);
  let sound = false;

  const camera = createCameraController({
    onState(message, status = 'STANDBY') {
      $('cameraMessage').textContent = message;
      setStatus(status);
    },

    onCapture(canvas) {
      processCapturedImage(canvas);
    }
  });

  function processCapturedImage(canvas) {
    showInfo(
      'IMAGEM CAPTURADA!',
      `Imagem recebida com sucesso. Resolução: ${canvas.width} × ${canvas.height} pixels.`
    );
    beep(sound);
  }

  function openCamera() {
    const dialog = $('cameraDialog');

    if (!dialog.open) dialog.showModal();

    if (window.PokéScanAndroid) {
      $('cameraMessage').textContent =
        'Iniciando câmera nativa...';

      setStatus('STARTING');
      window.PokéScanAndroid.openCamera();
    } else {
      camera.open();
    }
  }

  window.onNativePhotoCaptured = function(dataUrl) {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      canvas.getContext('2d').drawImage(image, 0, 0);

      processCapturedImage(canvas);

      $('cameraMessage').textContent =
        'Fotografia nativa recebida.';

      setStatus('CAPTURED');
    };

    image.onerror = () => {
      $('cameraMessage').textContent =
        'Erro ao receber a fotografia.';
      setStatus('CAMERA ERROR');
    };

    image.src = dataUrl;
  };

  const openSearch = () => $('searchDialog').showModal();

  ['scan', 'quick', 'start'].forEach(id => {
    $(id).addEventListener('click', openCamera);
  });

  ['manual', 'search'].forEach(id => {
    $(id).addEventListener('click', openSearch);
  });

  $('about').addEventListener('click', () => {
    $('aboutDialog').showModal();
  });

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => {
      button.closest('dialog').close();
    });
  });

  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  $('cameraDialog').addEventListener('close', () => {
    if (window.PokéScanAndroid) {
      window.PokéScanAndroid.closeCamera();
    } else {
      camera.close();
    }
  });

  $('capture').addEventListener('click', () => {
    if (window.PokéScanAndroid) {
      window.PokéScanAndroid.capturePhoto();
    } else {
      camera.capture();
    }
  });

  $('sound').addEventListener('click', () => {
    sound = !sound;
    $('sound').textContent =
      '♫ Sons: ' + (sound ? 'on' : 'off');
    beep(sound);
  });

  initializeSearch({
    onSearch(query) {
      showInfo('BUSCA RECEBIDA', `Pesquisa por: ${query}`);
      $('searchDialog').close();
    }
  });

  document.querySelectorAll('[data-do]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.do;
      beep(sound);

      if (action === 'scan') openCamera();
      else if (action === 'search') openSearch();
      else if (action === 'catalog') {
        showInfo('CATÁLOGO TCG', 'Módulo preparado para integração.');
      }
      else if (action === 'market') {
        showInfo('MERCADO BRASILEIRO', 'Consulta de preços em desenvolvimento.');
      }
      else {
        showInfo('ANÁLISE TÁTICA', 'Módulo em desenvolvimento.');
      }
    });
  });
})();