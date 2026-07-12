// ─── Firebase — núcleo do app ────────────────────────────────────────────────
// Config vem de variáveis de ambiente (arquivo .env, nunca commitado).
// As chaves VITE_FIREBASE_* são públicas por natureza (identificam o projeto,
// não autenticam) — a segurança real vem das regras do Firestore.

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const firebaseApp = initializeApp(config);

// App Check (proteção de custo): atesta que as chamadas ao Firestore vêm do
// NOSSO app, não de um script com as chaves públicas. Só ativa se a site key
// do reCAPTCHA v3 estiver no .env — sem ela o app funciona normal (o bloqueio
// de verdade é ligado no console, em "Enforce", depois de validar métricas).
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (appCheckKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
// Só escopo básico (perfil + e-mail) — é isso que evita a tela
// "app não verificado" que assombra web apps GAS (que pedem Sheets/Drive).
googleProvider.setCustomParameters({ prompt: 'select_account' });
