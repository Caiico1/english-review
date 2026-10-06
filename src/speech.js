// Pronunciación con la Web Speech API. Prefiere voz británica (la del libro) y cae a cualquier voz inglesa.
import { h, plain } from './ui.js';

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-GB' && v.localService) ||
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.lang.startsWith('en'))
  );
}

if (speechSupported) speechSynthesis.getVoices(); // algunas plataformas cargan las voces de forma asíncrona

export function speak(text, rate = 0.95) {
  if (!speechSupported) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text));
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : 'en-GB';
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSupported) speechSynthesis.cancel();
}

/** Botón de altavoz reutilizable. */
export function speakButton(text, label = 'Escuchar pronunciación') {
  if (!speechSupported) return null;
  return h('button', {
    type: 'button', class: 'icon-btn speak', 'aria-label': `${label}: ${plain(text)}`, title: label,
    onClick: (e) => { e.stopPropagation(); speak(text); },
  }, '🔊');
}
