import { auth, db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// UI Elements
const authSection = document.getElementById("auth-section");
const dashboard = document.getElementById("dashboard");
const userEmailSpan = document.getElementById("userEmail");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const homeworkForm = document.getElementById("homeworkForm");
const homeworkItems = document.getElementById("homeworkItems");
const studentHomeworkList = document.getElementById("studentHomeworkList");
const logoutBtn = document.getElementById("logoutBtn");

// Signup handler
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save role in Firestore
    await setDoc(doc(db, "users", user.uid), { email, role });
    alert(`Signed up as ${role}!`);
  } catch (error) {
    alert(error.message);
  }
});

// Login handler
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
});

// Logout handler
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Load homework for teacher
async function loadTeacherHomework(uid) {
  homeworkItems.innerHTML = "Loading homework...";
  const q = query(collection(db, "homeworks"), where("assignedBy", "==", uid));
  const querySnapshot = await getDocs(q);

  homeworkItems.innerHTML = "";

  if (querySnapshot.empty) {
    homeworkItems.textContent = "No homework assigned yet";
    return;
  }

  querySnapshot.forEach((doc) => {
    const hw = doc.data();
    const li = document.createElement("li");
    li.textContent = `${hw.title} – ${hw.description} `;

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.style.marginLeft = "10px";
    delBtn.style.backgroundColor = "#e53935";
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.padding = "2px 6px";
    delBtn.style.cursor = "pointer";
    delBtn.style.borderRadius = "3px";

    delBtn.addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "homeworks", doc.id));
        alert("Homework deleted!");
        await loadTeacherHomework(uid);
      } catch (error) {
        alert("Error deleting homework: " + error.message);
      }
    });

    li.appendChild(delBtn);
    homeworkItems.appendChild(li);
  });
}

// Load homework for student
async function loadStudentHomework(uid) {
  studentHomeworkList.innerHTML = "Loading homework...";
  // Query homework assigned by any teacher (or you can filter by class etc)
  const q = query(collection(db, "homeworks"));
  const querySnapshot = await getDocs(q);

  studentHomeworkList.innerHTML = "";

  if (querySnapshot.empty) {
    studentHomeworkList.textContent = "No homework assigned yet";
    return;
  }

  querySnapshot.forEach((doc) => {
    const hw = doc.data();
    const li = document.createElement("li");
    li.textContent = `${hw.title} – ${hw.description}`;
    studentHomeworkList.appendChild(li);
  });
}

// Auth state change handler
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.style.display = "none";
    dashboard.style.display = "block";
    logoutBtn.style.display = "inline-block";
    userEmailSpan.textContent = user.email;

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const role = docSnap.data().role;
      if (role === "teacher") {
        teacherDashboard.style.display = "block";
        studentDashboard.style.display = "none";

        await loadTeacherHomework(user.uid);
      } else {
        teacherDashboard.style.display = "none";
        studentDashboard.style.display = "block";

        await loadStudentHomework(user.uid);
      }
    } else {
      alert("User role not found.");
    }
  } else {
    authSection.style.display = "block";
    dashboard.style.display = "none";
    teacherDashboard.style.display = "none";
    studentDashboard.style.display = "none";
    logoutBtn.style.display = "none";
  }
});

// Homework form submission
if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("homeworkTitle").value.trim();
    const description = document.getElementById("homeworkDescription").value.trim();

    if (!title || !description) {
      alert("Please enter both title and description.");
      return;
    }

    try {
      await addDoc(collection(db, "homeworks"), {
        title,
        description,
        assignedBy: auth.currentUser.uid,
        assignedAt: new Date(),
      });

      alert("Homework added!");
      homeworkForm.reset();

      await loadTeacherHomework(auth.currentUser.uid);
    } catch (error) {
      alert("Error adding homework: " + error.message);
    }
  });
}






