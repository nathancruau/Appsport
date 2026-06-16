import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD54dXng9VqYIVaFUZGMN4U8UsxGC9zOPw',
  authDomain: 'appsport-a8c47.firebaseapp.com',
  projectId: 'appsport-a8c47',
  storageBucket: 'appsport-a8c47.firebasestorage.app',
  messagingSenderId: '843897625488',
  appId: '1:843897625488:web:afe8c51623e4c82d827115',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
