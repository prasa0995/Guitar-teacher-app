import { api, h } from '../app.js';

const SECURITY_QUESTIONS = [
  'Where were you born?',
  "What was your first guitar's brand?",
  'What is your favorite song?',
  "What is your childhood best friend's name?",
  'What was the name of your first pet?',
];

// A password <input> with a show/hide toggle button next to it.
// Returns the wrapping row element; access the value via `.input.value`.
function passwordField(attrs) {
  const input = h('input', { type: 'password', style: 'flex:1;', ...attrs });
  const toggle = h('button', { type: 'button', class: 'ghost', style: 'padding:0 12px;font-size:13px;', title: 'Show/hide password' }, '👁');
  toggle.onclick = (e) => {
    e.preventDefault();
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? '🙈' : '👁';
  };
  const wrap = h('div', { class: 'row', style: 'gap:6px;align-items:stretch;' }, [input, toggle]);
  wrap.input = input;
  return wrap;
}

function securityQuestionSelect() {
  const select = h('select', {});
  SECURITY_QUESTIONS.forEach((q) => select.appendChild(h('option', { value: q }, q)));
  return select;
}

export function render(root, onAuthed) {
  let mode = 'login'; // login | signup | forgot
  const page = h('div', { class: 'auth-page' });
  const wrap = h('div', { class: 'auth-card' });
  page.appendChild(wrap);
  root.appendChild(page);

  function draw() {
    wrap.innerHTML = '';
    wrap.appendChild(h('div', { class: 'auth-hero' }, [
      h('div', { class: 'glyph' }, '🎸'),
      h('h1', {}, 'AI GuitarSensei'),
      h('p', { class: 'muted' }, 'Your personal guitar teacher — chords, theory, songs, and practice, all guided by AI.'),
    ]));
    const card = h('div', { class: 'card', style: 'margin-top:18px;' });

    const errorBox = h('p', { style: 'color:#ef6461;display:none;' });
    card.appendChild(errorBox);

    if (mode === 'login') {
      const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email' });
      const passwordRow = passwordField({ placeholder: 'Password', autocomplete: 'current-password' });
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        h('div', {}, [h('label', {}, 'Password'), passwordRow]),
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [
        h('button', { class: 'primary', onclick: async () => {
          errorBox.style.display = 'none';
          try {
            await api('/auth/login', { method: 'POST', body: { email: email.value, password: passwordRow.input.value } });
            onAuthed();
          } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
        } }, 'Log in'),
        h('button', { class: 'ghost', onclick: () => { mode = 'signup'; draw(); } }, 'Create account'),
        h('button', { class: 'ghost', onclick: () => { mode = 'forgot'; draw(); } }, 'Forgot password?'),
      ]));
    } else if (mode === 'signup') {
      const email = h('input', { type: 'email', placeholder: 'Email' });
      const passwordRow = passwordField({ placeholder: 'At least 8 characters' });
      const question = securityQuestionSelect();
      const answer = h('input', { type: 'text', placeholder: 'Your answer' });
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        h('div', {}, [h('label', {}, 'Password'), passwordRow]),
        h('div', {}, [h('label', {}, 'Security question (for password recovery)'), question]),
        h('div', {}, [h('label', {}, 'Security answer'), answer]),
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [
        h('button', { class: 'primary', onclick: async () => {
          errorBox.style.display = 'none';
          try {
            await api('/auth/signup', { method: 'POST', body: {
              email: email.value, password: passwordRow.input.value,
              securityQuestion: question.value, securityAnswer: answer.value,
            } });
            onAuthed();
          } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
        } }, 'Sign up'),
        h('button', { class: 'ghost', onclick: () => { mode = 'login'; draw(); } }, 'Back to login'),
      ]));
    } else if (mode === 'forgot') {
      const email = h('input', { type: 'email', placeholder: 'Email' });
      const qBox = h('p', { class: 'muted', style: 'display:none;' });
      const answer = h('input', { type: 'text', placeholder: 'Security answer', style: 'display:none;' });
      const newPasswordRow = passwordField({ placeholder: 'New password' });
      newPasswordRow.style.display = 'none';
      let question = null;
      const lookupBtn = h('button', { class: 'ghost', onclick: async () => {
        errorBox.style.display = 'none';
        try {
          const r = await api('/auth/forgot-password/question', { method: 'POST', body: { email: email.value } });
          question = r.securityQuestion;
          qBox.textContent = `Security question: ${question}`;
          qBox.style.display = 'block';
          answer.style.display = 'block';
          newPasswordRow.style.display = 'flex';
          resetBtn.style.display = 'inline-block';
        } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
      } }, 'Find my account');
      const resetBtn = h('button', { class: 'primary', style: 'display:none;', onclick: async () => {
        errorBox.style.display = 'none';
        try {
          await api('/auth/forgot-password/reset', { method: 'POST', body: {
            email: email.value, securityAnswer: answer.value, newPassword: newPasswordRow.input.value,
          } });
          mode = 'login'; draw();
        } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
      } }, 'Reset password');
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        qBox, answer, newPasswordRow,
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [lookupBtn, resetBtn,
        h('button', { class: 'ghost', onclick: () => { mode = 'login'; draw(); } }, 'Back'),
      ]));
    }
    wrap.appendChild(card);
  }
  draw();
}
