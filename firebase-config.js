import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYwkGTChzb4OrF2hZGyAlYvKifCPCN5JI",
  authDomain: "trailblazer-666f9.firebaseapp.com",
  projectId: "trailblazer-666f9",
  storageBucket: "trailblazer-666f9.appspot.com",
  messagingSenderId: "1003055478865",
  appId: "1:1003055478865:web:9dafaafb87ffc749e76070",
  measurementId: "G-G5GN8YPM3L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

