
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
      console.log('CAPTURA EXECUTADA:', canvas.width, canvas.height);

      showInfo(
        'IMAGEM CAPTURADA!',
        `Imagem recebida com sucesso. Resolução: ${canvas.width} × ${canvas.height} pixels.`
      );

      beep(sound);
    }
  });

  const openSearch = () => $('searchDialog').showModal();

  ['scan', 'quick', 'start'].forEach(id => {
    $(id).addEventListener('click', () => camera.open());
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

  $('cameraDialog').addEventListener('close', () => camera.close());

  $('capture').addEventListener('click', () => {
    console.log('BOTÃO CAPTURAR CLICADO');
    camera.capture();
  });

  $('sound').addEventListener('click', () => {
    sound = !sound;
    $('sound').textContent = '♫ Sons: ' + (sound ? 'on' : 'off');
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

      if (action === 'scan') camera.open();
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