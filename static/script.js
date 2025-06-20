document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const keyboard = document.getElementById('keyboard');
  const message = document.getElementById('message');
  const submitBtn = document.getElementById('submit-btn');
  let currentRow = 0;
  let currentCell = 0;

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

  // Клавиши — три ряда + backspace справа в третьем ряду
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

    // Первый ряд
    firstRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 1);
      keyboard.appendChild(keyDiv);
    });

    // Второй ряд
    secondRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 13);
      keyboard.appendChild(keyDiv);
    });

    // Третий ряд — буквы
    thirdRowKeys.forEach((char, i) => {
      const keyDiv = createKeyDiv(char, i + 24);
      keyboard.appendChild(keyDiv);
    });

    // Backspace в третьем ряду, сразу после "ю"
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

  function resetGame() {
    createBoard();
    createKeyboard();
    message.textContent = '';
    submitBtn.disabled = false;
    currentRow = 0;
    currentCell = 0;
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

      // Обновляем цвет ячеек игрового поля
      rowCells.forEach((cell, i) => {
        cell.classList.remove('green', 'yellow', 'gray');
        cell.classList.add(data.result[i]);
      });

      // Обновляем подсветку клавиш
      updateKeyboardColors(guess, data.result);

      const solvedCountElem = document.getElementById('solved-count');
      if (solvedCountElem && data.solved_count !== undefined) {
        solvedCountElem.textContent = data.solved_count;
      }

      if (data.message) {
        message.textContent = data.message;
        submitBtn.disabled = true;
        switchSubmitButton(true);
        return;
      }

      currentRow++;
      currentCell = 0;
    } catch (e) {
      message.textContent = 'Ошибка соединения с сервером';
    }
    
  }
  

  /**
   * Обновляет цвета клавиш виртуальной клавиатуры в зависимости от результата
   * @param {string} guess - введённое слово
   * @param {Array} result - массив из 'green', 'yellow', 'gray' для каждой буквы
   */
  function updateKeyboardColors(guess, result) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      // Найдём все клавиши с этой буквой (буква может встречаться несколько раз)
      const keys = Array.from(keyboard.querySelectorAll('.key.standard'))
        .filter(k => k.textContent.toLowerCase() === letter);

      keys.forEach(key => {
        // Текущий цвет клавиши
        const currentColor = getKeyColor(key);

        // Приоритет цветов: green > yellow > gray > none
        if (result[i] === 'green') {
          setKeyColor(key, 'green');
        } else if (result[i] === 'yellow') {
          if (currentColor !== 'green') {
            setKeyColor(key, 'yellow');
          }
        } else if (result[i] === 'gray') {
          if (currentColor !== 'green' && currentColor !== 'yellow') {
            setKeyColor(key, 'gray');
            // Делаем кнопку неактивной и убираем обработчик клика
            key.style.pointerEvents = 'none';
            key.style.opacity = '0.5';
          }
        }
      });
    }
  }

  /** Получить текущий цвет кнопки */
  function getKeyColor(key) {
    if (key.classList.contains('green')) return 'green';
    if (key.classList.contains('yellow')) return 'yellow';
    if (key.classList.contains('gray')) return 'gray';
    return null;
  }

  /** Установить цвет кнопки */
  function setKeyColor(key, color) {
    key.classList.remove('green', 'yellow', 'gray');
    key.classList.add(color);
    // Восстанавливаем активность для green и yellow
    if (color === 'green' || color === 'yellow') {
      key.style.pointerEvents = 'auto';
      key.style.opacity = '1';
    }
  }

  // Инициализация кнопки
  switchSubmitButton(false);
});
