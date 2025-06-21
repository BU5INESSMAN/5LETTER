document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const keyboard = document.getElementById('keyboard');
  const message = document.getElementById('message');
  const submitBtn = document.getElementById('submit-btn');
  const gameContainer = document.querySelector('.game-container');
  const gameMessage = document.getElementById('game-message');
  let currentRow = 0;
  let currentCell = 0;

  // Инициализация coin_balance из DOM
  let coin_balance = 0;
  const balanceElem = document.querySelector('.balance strong');
  if (balanceElem) {
    coin_balance = parseInt(balanceElem.textContent, 10) || 0;
  }

  function createBoard() {
    board.innerHTML = '';
    for (let r = 0; r < 6; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.classList.add('row');
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.row = r;
        cell.dataset.col = c;
        rowDiv.appendChild(cell);
      }
      board.appendChild(rowDiv);
    }
  }

  createBoard();

  const firstRowKeys = ['й','ц','у','к','е','н','г','ш','щ','з','х','ъ'];
  const secondRowKeys = ['ф','ы','в','а','п','р','о','л','д','ж','э'];
  const thirdRowKeys = ['я','ч','с','м','и','т','ь','б','ю'];

  function createKeyboard() {
    keyboard.innerHTML = '';
    keyboard.style.display = 'grid';
    keyboard.style.gridTemplateColumns = 'repeat(12, 1fr)';
    keyboard.style.gridAutoRows = '48px';
    keyboard.style.gap = '8px';
    keyboard.style.padding = '0 12px';

    firstRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 1);
      keyboard.appendChild(keyDiv);
    });

    secondRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 13);
      keyboard.appendChild(keyDiv);
    });

    thirdRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 24);
      keyboard.appendChild(keyDiv);
    });

    const backspace = createKeyDiv('⌫', 33, true);
    keyboard.appendChild(backspace);
  }

  function createKeyDiv(char, classNumber, isBackspace = false) {
    const keyDiv = document.createElement('div');
    keyDiv.textContent = char;
    keyDiv.classList.add('key', `key${classNumber}`);
    if (isBackspace) {
      keyDiv.classList.add('backspace');
      keyDiv.addEventListener('click', handleBackspace);
    } else {
      keyDiv.classList.add('standard');
      keyDiv.addEventListener('click', () => handleKey(char));
    }
    return keyDiv;
  }

  createKeyboard();

  function handleKey(char) {
    if (currentRow >= 6) return;
    if (currentCell < 5) {
      const cell = document.querySelector(`.row:nth-child(${currentRow + 1}) .cell:nth-child(${currentCell + 1})`);
      cell.textContent = char;
      currentCell++;
      message.textContent = '';
    }
  }

  function handleBackspace() {
    if (currentCell > 0) {
      currentCell--;
      const cell = document.querySelector(`.row:nth-child(${currentRow + 1}) .cell:nth-child(${currentCell + 1})`);
      cell.textContent = '';
      message.textContent = '';
    }
  }

  document.addEventListener('keydown', (event) => {
    if (currentRow >= 6) return;

    let key = event.key;

    if (key.length === 1) {
      key = key.toLowerCase();
      if (key === 'ё' || key === 'Ё') {
        key = 'ё';
      }
    }

    const rusLetters = 'ёйцукенгшщзхъфывапролджэячсмитьбю';

    if (key === 'Backspace' || key === 'Backspace'.toLowerCase()) {
      event.preventDefault();
      handleBackspace();
    } else if (key.length === 1 && rusLetters.includes(key)) {
      event.preventDefault();
      handleKey(key);
    }
  });

function showGameOverlay(isVictory, correctWord) {
  const overlay = document.getElementById('game-overlay');
  const message = document.getElementById('overlay-message');
  const correctWordElem = document.getElementById('overlay-correct-word');
  const hintContainer = document.getElementById('hint-container');
  const overlayBtn = document.getElementById('overlay-close-btn');

  overlay.classList.remove('victory', 'defeat');
  overlay.style.display = 'flex';

  hintContainer.textContent = '';
  overlayBtn.style.display = 'none'; // Скрываем кнопку

  if (isVictory) {
    overlay.classList.add('victory');
    message.textContent = 'ПОБЕДА!';
    correctWordElem.textContent = '';
  } else {
    overlay.classList.add('defeat');
    message.textContent = 'ПОРАЖЕНИЕ!';
    correctWordElem.textContent = `Правильное слово: ${correctWord}`;
  }
}



function showHint(type, hint) {
  const overlay = document.getElementById('game-overlay');
  const hintContainer = document.getElementById('hint-container');
  const message = document.getElementById('overlay-message');
  const correctWordElem = document.getElementById('overlay-correct-word');
  const overlayBtn = document.getElementById('overlay-close-btn');

  let hintText = '';
  if (type === 'letter') {
    hintText = `Подсказанная буква: ${hint}`;
  } else if (type === 'position') {
    hintText = `Подсказанная буква и позиция: ${hint.letter} на позиции ${hint.position + 1}`;
  } else if (type === 'word') {
    hintText = `Подсказанное слово: ${hint}`;
  }

  hintContainer.textContent = hintText;
  overlay.style.display = 'flex';

  message.textContent = 'Подсказка';
  correctWordElem.textContent = '';

  overlayBtn.style.display = 'inline-block'; // Показываем кнопку
  overlayBtn.textContent = 'Закрыть';

  // Удаляем старые обработчики и добавляем новый
  overlayBtn.replaceWith(overlayBtn.cloneNode(true));
  const newBtn = document.getElementById('overlay-close-btn');
  newBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    hintContainer.textContent = '';
  });
}



  function handleCheckResponse(data) {
    if (data.error) {
      alert(data.error);
      return;
    }

    renderGuessResult(data.result);

    if (data.message) {
      if (data.message.toLowerCase().includes('победа')) {
        showGameOverlay(true);
      } else if (data.message.toLowerCase().includes('игра окончена')) {
        showGameOverlay(false, data.correct_word || '');
      }
    }
  }

  function resetGame() {
    createBoard();
    createKeyboard();
    message.textContent = '';
    submitBtn.disabled = false;
    currentRow = 0;
    currentCell = 0;
    const overlay = document.getElementById('game-overlay');
    overlay.style.display = 'none';
    fetch('/new_word', { method: 'POST' })
      .catch(() => {
        message.textContent = 'Ошибка при обновлении слова на сервере';
      });
  }

  function switchSubmitButton(toNextWord) {
    if (toNextWord) {
      submitBtn.textContent = 'Следующее слово';
      submitBtn.onclick = () => {
        resetGame();
        switchSubmitButton(false);
      };
      submitBtn.disabled = false;
    } else {
      submitBtn.textContent = 'Проверить слово';
      submitBtn.onclick = submitGuess;
      submitBtn.disabled = false;
    }
  }

  async function submitGuess() {
    if (currentCell !== 5) {
      message.textContent = 'Введите 5 букв';
      return;
    }
    message.textContent = '';
    const rowCells = document.querySelectorAll(`.row:nth-child(${currentRow + 1}) .cell`);
    let guess = '';
    rowCells.forEach(cell => guess += cell.textContent);

    try {
      const response = await fetch('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess })
      });
      const data = await response.json();

      if (!response.ok) {
        message.textContent = data.error || 'Ошибка';
        return;
      }

      rowCells.forEach((cell, i) => {
        cell.classList.remove('green', 'yellow', 'gray');
        cell.classList.add(data.result[i]);
      });

      updateKeyboardColors(guess, data.result);

      const solvedCountElem = document.getElementById('solved-count');
      if (solvedCountElem && data.solved_count !== undefined) {
        solvedCountElem.textContent = data.solved_count;
      }

      if (data.coin_balance !== undefined) {
        coin_balance = data.coin_balance;
        updateBalanceDisplay(coin_balance);
      }

      handleCheckResponse(data);

      if (data.message) {
        message.textContent = data.message;
        submitBtn.disabled = true;
        switchSubmitButton(true);
        return;
      }

      currentRow++;
      currentCell = 0;
    } catch (e) {
      console.error('Fetch error:', e);
      message.textContent = 'Ошибка соединения с сервером';
    }
  }

  function updateKeyboardColors(guess, result) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const keys = Array.from(keyboard.querySelectorAll('.key.standard'))
        .filter(k => k.textContent.toLowerCase() === letter);

      keys.forEach(key => {
        const currentColor = getKeyColor(key);

        if (result[i] === 'green') {
          setKeyColor(key, 'green');
        } else if (result[i] === 'yellow') {
          if (currentColor !== 'green') {
            setKeyColor(key, 'yellow');
          }
        } else if (result[i] === 'gray') {
          if (currentColor !== 'green' && currentColor !== 'yellow') {
            setKeyColor(key, 'gray');
            key.style.pointerEvents = 'none';
            key.style.opacity = '0.5';
          }
        }
      });
    }
  }

  function getKeyColor(key) {
    if (key.classList.contains('green')) return 'green';
    if (key.classList.contains('yellow')) return 'yellow';
    if (key.classList.contains('gray')) return 'gray';
    return null;
  }

  function setKeyColor(key, color) {
    key.classList.remove('green', 'yellow', 'gray');
    key.classList.add(color);
    if (color === 'green' || color === 'yellow') {
      key.style.pointerEvents = 'auto';
      key.style.opacity = '1';
    }
  }

  function renderGuessResult(result) {
    const rowCells = document.querySelectorAll(`.row:nth-child(${currentRow + 1}) .cell`);
    rowCells.forEach((cell, i) => {
      cell.classList.remove('green', 'yellow', 'gray');
      cell.classList.add(result[i]);
    });
  }

  function updateBalanceDisplay(balance) {
    const balanceElem = document.querySelector('.balance strong');
    if (balanceElem) balanceElem.textContent = balance;
  }

  // Подсказки
  document.getElementById('hint-letter').addEventListener('click', () => buyHint('letter', 100));
  document.getElementById('hint-position').addEventListener('click', () => buyHint('position', 100));
  document.getElementById('hint-word').addEventListener('click', () => buyHint('word', 1000));

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav-list');

  if (!toggle || !navList) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    navList.classList.toggle('open');
  });

  navList.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('open');
      navList.classList.remove('open');
    });
  });
});


  async function buyHint(type, cost) {
    if (coin_balance < cost) {
      alert('Недостаточно монет для подсказки');
      return;
    }

    try {
      const response = await fetch('/buy_hint', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({hint_type: type})
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Ошибка при покупке подсказки');
        return;
      }

      coin_balance = data.coin_balance;
      updateBalanceDisplay(coin_balance);

      showHint(type, data.hint);

    } catch (e) {
      alert('Ошибка соединения с сервером');
    }
  }

  switchSubmitButton(false);
});
