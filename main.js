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
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- UI Elements ---
const authSection = document.getElementById("auth-section");
const dashboard = document.getElementById("dashboard");
const userEmailSpan = document.getElementById("userEmail");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const homeworkForm = document.getElementById("homeworkForm");
const homeworkItems = document.getElementById("homeworkItems");
const studentHomeworkList = document.getElementById("studentHomeworkList");
const logoutBtn = document.getElementById("logoutBtn");
const classForm = document.getElementById("classForm");
const classNameInput = document.getElementById("className");
const addStudentBtn = document.getElementById("addStudentBtn");
const studentEmailInput = document.getElementById("studentEmailInput");
const addStudentClassSelector = document.getElementById("addStudentClassSelector");
const classesTableBody = document.querySelector("#classesTable tbody");

// --- Unsubscribe listeners ---
let unsubscribeHomeworkListener = null;
let unsubscribeClassListener = null;
let unsubscribeStudentClassListener = null;

// --- SIGN UP ---
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  if (!email || !password) return alert("Please enter email and password.");

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

// --- LOG IN ---
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Enter email and password.");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
});

// --- LOG OUT ---
logoutBtn.addEventListener("click", async () => {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
  if (unsubscribeClassListener) unsubscribeClassListener();
  if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();
  await signOut(auth);
});

// --- AUTH STATE ---
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
        listenToTeacherHomework(user.uid);
        listenToClassesForTeacher(user.uid);
      } else {
        teacherDashboard.style.display = "none";
        studentDashboard.style.display = "block";
        listenToStudentHomework(user.uid);
      }
    } else {
      alert("User role not found.");
    }
  } else {
    // Logged out
    authSection.style.display = "block";
    dashboard.style.display = "none";
    teacherDashboard.style.display = "none";
    studentDashboard.style.display = "none";
    logoutBtn.style.display = "none";

    if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
    if (unsubscribeClassListener) unsubscribeClassListener();
    if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();
  }
});

// --- LISTENERS ---
// Teacher homework
function listenToTeacherHomework(uid) {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
  const q = query(collection(db, "homeworks"), where("assignedBy", "==", uid));
  unsubscribeHomeworkListener = onSnapshot(q, (snap) => {
    homeworkItems.innerHTML = "";
    if (snap.empty) return (homeworkItems.textContent = "No homework assigned yet.");

    snap.forEach((hwDoc) => {
      const hw = hwDoc.data();
      const li = document.createElement("li");
      li.textContent = `${hw.title} – ${hw.description}`;

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete homework "${hw.title}"?`)) return;
        await deleteDoc(doc(db, "homeworks", hwDoc.id));
      });

      li.appendChild(delBtn);
      homeworkItems.appendChild(li);
    });
  });
}

// Student homework
function listenToStudentHomework(uid) {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
  if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();

  const classesRef = collection(db, "classes");

  unsubscribeStudentClassListener = onSnapshot(classesRef, async (classSnap) => {
    const studentClasses = [];

    const promises = classSnap.docs.map(async (cDoc) => {
      const studentRef = doc(db, "classes", cDoc.id, "students", uid);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) studentClasses.push(cDoc.id);
    });

    await Promise.all(promises);

    if (studentClasses.length === 0) {
      studentHomeworkList.textContent = "You are not in any class.";
      return;
    }

    // Listen to homeworks for student classes
    if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
    const hwRef = collection(db, "homeworks");
    unsubscribeHomeworkListener = onSnapshot(hwRef, (hwSnap) => {
      studentHomeworkList.innerHTML = "";
      let hasHw = false;
      hwSnap.forEach((hwDoc) => {
        const hw = hwDoc.data();
        if (studentClasses.includes(hw.classId)) {
          const li = document.createElement("li");
          li.textContent = `${hw.title} – ${hw.description}`;
          studentHomeworkList.appendChild(li);
          hasHw = true;
        }
      });
      if (!hasHw) studentHomeworkList.textContent = "No homework found for your classes.";
    });
  });
}

// Classes for teacher
function listenToClassesForTeacher(uid) {
  if (unsubscribeClassListener) unsubscribeClassListener();
  const q = query(collection(db, "classes"), where("createdBy", "==", uid));
  unsubscribeClassListener = onSnapshot(q, (snap) => {
    classesTableBody.innerHTML = "";
    addStudentClassSelector.innerHTML = "";

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const row = document.createElement("tr");

      // Class Name
      const tdName = document.createElement("td");
      tdName.textContent = data.name;
      row.appendChild(tdName);

      // Students
      const tdStudents = document.createElement("td");
      tdStudents.textContent = "Loading...";
      loadStudentsInClassTable(docSnap.id, tdStudents);
      row.appendChild(tdStudents);

      // Actions
      const tdActions = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete class "${data.name}"?`)) return;
        // Delete all students in subcollection first
        const studentsCol = collection(db, "classes", docSnap.id, "students");
        const studentDocs = await getDocs(studentsCol);
        for (const sDoc of studentDocs.docs) {
          await deleteDoc(doc(db, "classes", docSnap.id, "students", sDoc.id));
        }
        // Delete class
        await deleteDoc(doc(db, "classes", docSnap.id));
      });
      tdActions.appendChild(delBtn);
      row.appendChild(tdActions);

      classesTableBody.appendChild(row);

      // Populate Add Student select
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = data.name;
      addStudentClassSelector.appendChild(option);
    });
  });
}

// Load students into class table
async function loadStudentsInClassTable(classId, tdElement) {
  const studentsCol = collection(db, "classes", classId, "students");
  const studentsSnap = await getDocs(studentsCol);
  if (studentsSnap.empty) {
    tdElement.textContent = "No students";
    return;
  }
  tdElement.textContent = studentsSnap.docs.map(s => s.data().email).join(", ");
}

// --- FORM SUBMISSIONS ---
// Add homework
if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homeworkTitle").value.trim();
    const desc = document.getElementById("homeworkDescription").value.trim();
    if (!title || !desc) return alert("Enter both title and description.");

    try {
      await addDoc(collection(db, "homeworks"), {
        title,
        description: desc,
        assignedBy: auth.currentUser.uid,
        assignedAt: new Date(),
        classId: addStudentClassSelector.value || "", // optional
      });
      homeworkForm.reset();
      alert("Homework added!");
    } catch (err) {
      alert("Error adding homework: " + err.message);
    }
  });
}

// Create class
if (classForm) {
  classForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = classNameInput.value.trim();
    if (!name) return alert("Enter a class name.");

    try {
      await addDoc(collection(db, "classes"), {
        name,
        createdBy: auth.currentUser.uid,
      });
      classForm.reset();
      alert("Class created!");
      listenToClassesForTeacher(auth.currentUser.uid);
    } catch (err) {
      alert("Error creating class: " + err.message);
    }
  });
}

// Add student
if (addStudentBtn) {
  addStudentBtn.addEventListener("click", async () => {
    const email = studentEmailInput.value.trim();
    const classId = addStudentClassSelector.value;
    if (!email || !classId) return alert("Fill both student email and class selection.");

    try {
      const usersQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnap = await getDocs(usersQuery);
      if (userSnap.empty) return alert("Student not found.");

      const studentDoc = userSnap.docs[0];
      await setDoc(doc(db, "classes", classId, "students", studentDoc.id), {
        email,
        addedAt: new Date(),
      });
      alert("Student added to class!");
      studentEmailInput.value = "";
      listenToClassesForTeacher(auth.currentUser.uid);
    } catch (err) {
      alert("Error adding student: " + err.message);
    }
  });
}











