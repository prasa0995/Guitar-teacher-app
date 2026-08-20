import { api, h } from '../app.js';

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
      h('h1', {}, 'AI Guitar Teacher'),
      h('p', { class: 'muted' }, 'Your personal guitar teacher — chords, theory, songs, and practice, all guided by AI.'),
    ]));
    const card = h('div', { class: 'card', style: 'margin-top:18px;' });

    const errorBox = h('p', { style: 'color:#ef6461;display:none;' });
    card.appendChild(errorBox);

    if (mode === 'login') {
      const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email' });
      const password = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        h('div', {}, [h('label', {}, 'Password'), password]),
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [
        h('button', { class: 'primary', onclick: async () => {
          errorBox.style.display = 'none';
          try {
            await api('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
            onAuthed();
          } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
        } }, 'Log in'),
        h('button', { class: 'ghost', onclick: () => { mode = 'signup'; draw(); } }, 'Create account'),
        h('button', { class: 'ghost', onclick: () => { mode = 'forgot'; draw(); } }, 'Forgot password?'),
      ]));
    } else if (mode === 'signup') {
      const email = h('input', { type: 'email', placeholder: 'Email' });
      const password = h('input', { type: 'password', placeholder: 'At least 8 characters' });
      const question = h('input', { type: 'text', placeholder: "e.g. What was your first guitar's brand?" });
      const answer = h('input', { type: 'text', placeholder: 'Your answer' });
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        h('div', {}, [h('label', {}, 'Password'), password]),
        h('div', {}, [h('label', {}, 'Security question (for password recovery)'), question]),
        h('div', {}, [h('label', {}, 'Security answer'), answer]),
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [
        h('button', { class: 'primary', onclick: async () => {
          errorBox.style.display = 'none';
          try {
            await api('/auth/signup', { method: 'POST', body: {
              email: email.value, password: password.value,
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
      const newPassword = h('input', { type: 'password', placeholder: 'New password', style: 'display:none;' });
      let question = null;
      const lookupBtn = h('button', { class: 'ghost', onclick: async () => {
        errorBox.style.display = 'none';
        try {
          const r = await api('/auth/forgot-password/question', { method: 'POST', body: { email: email.value } });
          question = r.securityQuestion;
          qBox.textContent = `Security question: ${question}`;
          qBox.style.display = 'block';
          answer.style.display = 'block';
          newPassword.style.display = 'block';
          resetBtn.style.display = 'inline-block';
        } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
      } }, 'Find my account');
      const resetBtn = h('button', { class: 'primary', style: 'display:none;', onclick: async () => {
        errorBox.style.display = 'none';
        try {
          await api('/auth/forgot-password/reset', { method: 'POST', body: {
            email: email.value, securityAnswer: answer.value, newPassword: newPassword.value,
          } });
          mode = 'login'; draw();
        } catch (e) { errorBox.textContent = e.message; errorBox.style.display = 'block'; }
      } }, 'Reset password');
      card.appendChild(h('div', { class: 'grid', style: 'gap:10px;margin:14px 0;' }, [
        h('div', {}, [h('label', {}, 'Email'), email]),
        qBox, answer, newPassword,
      ]));
      card.appendChild(h('div', { class: 'row', style: 'margin-top:10px;' }, [lookupBtn, resetBtn,
        h('button', { class: 'ghost', onclick: () => { mode = 'login'; draw(); } }, 'Back'),
      ]));
    }
    wrap.appendChild(card);
  }
  draw();
}
