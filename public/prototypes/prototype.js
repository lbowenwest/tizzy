const $ = (selector) => document.querySelector(selector);
const themes = ['letterpress', 'afterhours', 'club'];
function applyTheme(theme) {
  const selected = themes.includes(theme) ? theme : 'letterpress';
  document.body.dataset.theme = selected;
  $('#theme-select').value = selected;
  document.querySelectorAll('[data-direction]').forEach((link) => {
    if (link.dataset.direction === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const url = new URL(location.href);
  url.searchParams.set('theme', selected);
  history.replaceState(null, '', url);
}
applyTheme(new URLSearchParams(location.search).get('theme'));
document.querySelectorAll('[data-direction]').forEach((link) => {
  link.onclick = (event) => {
    event.preventDefault();
    applyTheme(link.dataset.direction);
  };
});
$('#theme-select').onchange = () => applyTheme($('#theme-select').value);

// Fixed visual fixtures, not a puzzle evaluator, dictionary or round engine.
const fixtures = {
  4: { answer: 'CAMP', rows: [['COAT', ['correct', 'absent', 'present', 'absent']], ['CARE', ['correct', 'correct', 'absent', 'absent']]] },
  5: { answer: 'CHAIR', rows: [['CLEAN', ['correct', 'absent', 'absent', 'present', 'absent']], ['CARGO', ['correct', 'present', 'present', 'absent', 'absent']]] },
  6: { answer: 'CASTLE', rows: [['CANDLE', ['correct', 'correct', 'absent', 'absent', 'correct', 'correct']], ['CARTON', ['correct', 'correct', 'absent', 'correct', 'absent', 'absent']]] },
};
let settings = { format: 'single', length: 5, wordClock: 'off', wordSeconds: 30, roundClock: 'off', roundSeconds: 90, invalid: 'reject' };
let state = 'play';
let sequenceLength = 4;
const input = $('#guess-input');
const board = $('#board');
const marks = { correct: '✓', present: '↔', absent: '×' };
const descriptions = { correct: 'right place', present: 'elsewhere in word', absent: 'not in word' };
const currentLength = () => settings.format === 'sequence' ? sequenceLength : settings.length;
const formatTime = (seconds) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');

function row(word, statuses = [], active = false) {
  const element = document.createElement('div');
  element.className = 'board-row';
  for (let index = 0; index < currentLength(); index++) {
    const cell = document.createElement('span');
    const letter = word[index] || '';
    const status = statuses[index] || (active && index === 0 ? 'correct' : undefined);
    cell.className = 'tile ' + (status || (active ? 'active' : '')) + (!letter ? ' empty' : '') + (active && index === 0 ? ' supplied' : '');
    cell.textContent = letter;
    cell.setAttribute('aria-label', letter ? letter + (active && index === 0 ? ': supplied letter; right place' : status ? ': ' + descriptions[status] : '') : 'empty');
    if (status) {
      const mark = document.createElement('span');
      mark.className = 'tile-mark';
      mark.textContent = marks[status];
      mark.setAttribute('aria-hidden', 'true');
      cell.append(mark);
    }
    element.append(cell);
  }
  return element;
}

function render() {
  const length = currentLength();
  const fixture = fixtures[length];
  const unavailable = state === 'loading' || state === 'error';
  board.replaceChildren();
  board.style.setProperty('--length', length);
  board.hidden = unavailable;
  $('#sequence').hidden = settings.format !== 'sequence';
  $('#sequence').replaceChildren(...[4, 5, 6].map((number) => {
    const step = document.createElement('span');
    step.textContent = number + ' letters';
    if (number === length) {
      step.className = 'current';
      const label = document.createElement('b');
      label.textContent = 'NOW';
      step.append(label);
    } else if (number < length) {
      step.textContent += ' ✓';
    }
    return step;
  }));
  $('#format-label').textContent = settings.format === 'sequence' ? '4 → 5 → 6 ROUND' : 'SINGLE WORD';
  $('#play-title').textContent = 'Find the ' + ({ 4: 'four', 5: 'five', 6: 'six' })[length] + '.';
  $('#length-label').textContent = length + ' letters · first letter given';
  $('#guess-count').textContent = state === 'won' ? 'Solved in 3 guesses' : state === 'lost' ? '5 of 5 guesses used' : 'Guess 3 of 5';
  input.maxLength = length - 1;
  input.disabled = state !== 'play';
  $('#submit-button').disabled = state !== 'play';
  $('#keyboard').hidden = state !== 'play';
  $('.entry').hidden = state !== 'play';
  $('.input-label').hidden = state !== 'play';
  $('.legend').hidden = unavailable;
  $('.puzzle-meta').hidden = unavailable;
  $('.play-footer').hidden = unavailable;
  const clockParts = [];
  if (settings.wordClock !== 'off') clockParts.push(formatTime(settings.wordSeconds) + ' / ' + settings.wordClock);
  if (settings.format === 'sequence' && settings.roundClock === 'on') clockParts.push(formatTime(settings.roundSeconds) + ' / round');
  $('#clock-pill').textContent = clockParts.length ? clockParts.join(' · ') + ' ◷' : '∞ Untimed';
  $('#clock-pill').style.fontSize = clockParts.length ? '12px' : '';
  if (!unavailable) {
    for (const [word, statuses] of fixture.rows) board.append(row(word, statuses));
    if (state === 'won') board.append(row(fixture.answer, Array(length).fill('correct')));
    else if (state === 'lost') {
      // Repeat an illustrative unsuccessful row to show the full-board layout.
      for (let i = 0; i < 3; i++) board.append(row(...fixture.rows[1]));
    } else board.append(row('C' + input.value.toUpperCase(), [], true));
    while (board.children.length < 5) board.append(row(''));
  }
  $('#feedback').textContent = state === 'loading' ? 'Getting the letters ready…'
    : state === 'error' ? 'The word lists couldn’t load. Your next word is still waiting.'
    : state === 'play' ? 'Your next guess starts with C.'
    : state === 'won' ? 'Every letter in its place.'
    : state === 'round-ended' ? 'The overall clock ends the round, not just this word.'
    : settings.format === 'sequence' ? 'Try another ' + length + '-letter word before moving on.' : 'A new word is a fresh start.';
  $('#feedback').setAttribute('role', state === 'error' ? 'alert' : 'status');
  $('#result').hidden = state === 'play' || unavailable;
  $('#result').replaceChildren();
  if (state !== 'play' && !unavailable) {
    const copy = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = state === 'won' ? (settings.format === 'sequence' && length === 6 ? 'Round complete.' : 'Nicely found.') : state === 'round-ended' ? 'Round over.' : 'That one got away.';
    const detail = document.createElement('p');
    detail.textContent = state === 'round-ended' ? 'Start a fresh 4 → 5 → 6 example.' : 'The word was ' + fixture.answer + '.';
    copy.append(heading, detail);
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = state === 'won' && settings.format === 'sequence' && length < 6 ? 'Next length →' : 'Next example →';
    next.onclick = () => {
      if (state === 'won' && settings.format === 'sequence') sequenceLength = length < 6 ? length + 1 : 4;
      if (state === 'round-ended') sequenceLength = 4;
      preview('play');
    };
    $('#result').append(copy, next);
  }
  if (unavailable && state === 'error') {
    const retry = document.createElement('button');
    retry.className = 'primary';
    retry.textContent = 'Try again';
    retry.onclick = () => preview('play');
    $('#result').hidden = false;
    $('#result').append(retry);
  }
  document.querySelectorAll('[data-state]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.state === state)));
}

function preview(nextState) {
  if (nextState === 'round-ended') {
    settings.format = 'sequence';
    sequenceLength = 4;
  }
  state = nextState;
  input.value = '';
  render();
}
input.addEventListener('input', () => {
  input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, currentLength() - 1);
  render();
});
const demoSubmit = () => {
  $('#feedback').textContent = 'Input preview only. Choose “Solved” or “Word failed” below to see a result.';
};
$('#submit-button').onclick = demoSubmit;
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); demoSubmit(); }
});
for (const letters of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
  const keys = document.createElement('div');
  keys.className = 'key-row';
  for (const letter of letters) {
    const key = document.createElement('button');
    key.className = 'key';
    key.textContent = letter;
    key.onclick = () => {
      if (input.value.length < currentLength() - 1) input.value += letter;
      input.setSelectionRange(input.value.length, input.value.length);
      render();
    };
    keys.append(key);
  }
  if (letters.startsWith('Z')) {
    const key = document.createElement('button');
    key.className = 'key backspace';
    key.textContent = '⌫';
    key.setAttribute('aria-label', 'Delete last letter');
    key.onclick = () => {
      input.value = input.value.slice(0, -1);
      input.setSelectionRange(input.value.length, input.value.length);
      render();
    };
    keys.append(key);
  }
  $('#keyboard').append(keys);
}
$('#reset-button').onclick = () => preview('play');
document.querySelectorAll('[data-state]').forEach((button) => button.onclick = () => preview(button.dataset.state));
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.close').onclick = () => dialog.close();
}
$('#help-button').onclick = () => $('#help-dialog').showModal();

function syncForm() {
  const sequence = $('#format').value === 'sequence';
  $('#length').disabled = sequence;
  $('#round-clock').disabled = !sequence;
  if (!sequence) $('#round-clock').value = 'off';
  $('#word-seconds').disabled = $('#word-clock').value === 'off';
  $('#round-seconds').disabled = !sequence || $('#round-clock').value === 'off';
}
$('#settings-button').onclick = () => {
  $('#preset').value = 'custom';
  $('#format').value = settings.format;
  $('#length').value = settings.length;
  $('#word-clock').value = settings.wordClock;
  $('#word-seconds').value = settings.wordSeconds;
  $('#round-clock').value = settings.roundClock;
  $('#round-seconds').value = settings.roundSeconds;
  $('#invalid-policy').value = settings.invalid;
  syncForm();
  $('#settings-dialog').showModal();
};
$('#preset').onchange = () => {
  if ($('#preset').value === 'custom') return;
  $('#format').value = $('#preset').value === 'sequence' ? 'sequence' : 'single';
  $('#length').value = '5';
  $('#word-clock').value = 'off';
  $('#round-clock').value = 'off';
  $('#invalid-policy').value = 'reject';
  syncForm();
};
$('#settings-form').addEventListener('change', (event) => {
  if (event.target.id === 'theme-select') return;
  if (event.target.id !== 'preset') $('#preset').value = 'custom';
  syncForm();
});
$('#settings-form').onsubmit = (event) => {
  event.preventDefault();
  settings = {
    format: $('#format').value, length: Number($('#length').value),
    wordClock: $('#word-clock').value, wordSeconds: Number($('#word-seconds').value),
    roundClock: $('#round-clock').value, roundSeconds: Number($('#round-seconds').value),
    invalid: $('#invalid-policy').value,
  };
  sequenceLength = 4;
  $('#settings-dialog').close();
  preview('play');
};
render();
