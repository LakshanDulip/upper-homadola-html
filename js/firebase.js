// Firebase Web SDK public configuration (NOT an Admin SDK credential).
// School roles and permissions MUST be assigned by a trusted backend.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const firebaseConfig = {
 apiKey: 'AIzaSyDoRJsEyziURLmXTDx5BbEYLx4czx1FzsE',
 authDomain: 'upper-homadola-school.firebaseapp.com',
 projectId: 'upper-homadola-school',
 storageBucket: 'upper-homadola-school.firebasestorage.app',
 messagingSenderId: '615366080358',
 appId: '1:615366080358:web:42f148b42b2fc36e33baa7'
};
export const app=getApps().length?getApp():initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
