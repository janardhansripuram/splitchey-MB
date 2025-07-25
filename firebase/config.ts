import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDbGPToe9ip8Ozi0bYDFEdTPeVw27stKis",
  authDomain: "expenseflow-ykb45.firebaseapp.com",
  projectId: "expenseflow-ykb45",
  storageBucket: "expenseflow-ykb45.firebasestorage.app",
  messagingSenderId: "471981177559",
  appId: "1:471981177559:android:77b2a0595ad9135f96ce92"
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage }; 