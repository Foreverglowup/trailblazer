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
const classForm = document.getElementById("classForm");
const classNameInput = document.getElementById("className");
const classSelector = document.getElementById("classSelector");
const addStudentBtn = document.getElementById("addStudentBtn");
const studentEmailInput = document.getElementById("studentEmailInput");
const addStudentClassSelector = document.getElementById("addStudentClassSelector");
const studentListContainer = document.getElementById("studentListContainer");

// Store unsubscribe functions to detach listeners on logout
let unsubscribeHomeworkListener = null;
let unsubscribeClassListener = null;
let unsubscribeStudentClassListener = null;

// SIGN UP
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user role and email in Firestore
    await setDoc(doc(db, "users", user.uid), { email, role });

    alert(`Signed up as ${role}!`);
  } catch (error) {
    alert(error.message);
  }
});

// LOG IN
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
});

// LOG OUT
logoutBtn.addEventListener("click", async () => {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
  if (unsubscribeClassListener) unsubscribeClassListener();
  if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();

  await signOut(auth);
});

// REAL-TIME LISTENER: Teacher homework
function listenToTeacherHomework(uid) {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();

  const q = query(collection(db, "homeworks"), where("assignedBy", "==", uid));
  unsubscribeHomeworkListener = onSnapshot(q, (querySnapshot) => {
    homeworkItems.innerHTML = "";

    if (querySnapshot.empty) {
      homeworkItems.textContent = "No homework assigned yet";
      return;
    }

    querySnapshot.forEach((hwDoc) => {
      const hw = hwDoc.data();
      const li = document.createElement("li");
      li.textContent = `${hw.title} – ${hw.description} `;

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.style.marginLeft = "10px";
      delBtn.style.backgroundColor = "#d32f2f";
      delBtn.style.color = "white";
      delBtn.style.border = "none";
      delBtn.style.padding = "4px 8px";
      delBtn.style.cursor = "pointer";
      delBtn.style.borderRadius = "4px";
      delBtn.style.fontWeight = "600";

      delBtn.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "homeworks", hwDoc.id));
          alert("Homework deleted!");
        } catch (error) {
          alert("Error deleting homework: " + error.message);
        }
      });

      li.appendChild(delBtn);
      homeworkItems.appendChild(li);
    });
  });
}

// REAL-TIME LISTENER: Student homework (for classes student belongs to)
function listenToStudentHomework(uid) {
  if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
  if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();

  const classesRef = collection(db, "classes");

  // Listen to classes and find those that contain this student
  unsubscribeStudentClassListener = onSnapshot(classesRef, async (classSnapshot) => {
    const studentClasses = [];

    const classDocs = classSnapshot.docs;

    // Gather promises to check student membership in each class
    const checkPromises = classDocs.map(async (classDoc) => {
      const studentRef = doc(db, "classes", classDoc.id, "students", uid);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        studentClasses.push(classDoc.id);
      }
    });

    await Promise.all(checkPromises);

    if (studentClasses.length === 0) {
      studentHomeworkList.textContent = "You are not in any class.";
      return;
    }

    // Listen to homeworks realtime, filter for classes student belongs to
    if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();

    const hwRef = collection(db, "homeworks");
    unsubscribeHomeworkListener = onSnapshot(hwRef, (hwSnapshot) => {
      studentHomeworkList.innerHTML = "";

      let hasHw = false;

      hwSnapshot.forEach((hwDoc) => {
        const hw = hwDoc.data();
        if (studentClasses.includes(hw.classId)) {
          const li = document.createElement("li");
          li.textContent = `${hw.title} – ${hw.description}`;
          studentHomeworkList.appendChild(li);
          hasHw = true;
        }
      });

      if (!hasHw) {
        studentHomeworkList.textContent = "No homework found for your classes.";
      }
    });
  });
}

// REAL-TIME LISTENER: Classes for teacher (populate dropdowns)
function listenToClassesForTeacher(uid) {
  if (unsubscribeClassListener) unsubscribeClassListener();

  const q = query(collection(db, "classes"), where("createdBy", "==", uid));
  unsubscribeClassListener = onSnapshot(q, (querySnapshot) => {
    classSelector.innerHTML = "";
    addStudentClassSelector.innerHTML = "";

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const option1 = document.createElement("option");
      option1.value = docSnap.id;
      option1.textContent = data.name;
      classSelector.appendChild(option1);

      const option2 = document.createElement("option");
      option2.value = docSnap.id;
      option2.textContent = data.name;
      addStudentClassSelector.appendChild(option2);
    });

    // Load students for the first class automatically when classes change
    if (classSelector.value) loadStudentsInClass(classSelector.value);
  });
}

// AUTH STATE CHANGE
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
    authSection.style.display = "block";
    dashboard.style.display = "none";
    teacherDashboard.style.display = "none";
    studentDashboard.style.display = "none";
    logoutBtn.style.display = "none";

    // Detach listeners on logout
    if (unsubscribeHomeworkListener) unsubscribeHomeworkListener();
    if (unsubscribeClassListener) unsubscribeClassListener();
    if (unsubscribeStudentClassListener) unsubscribeStudentClassListener();
  }
});

// ADD HOMEWORK FORM SUBMISSION
if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("homeworkTitle").value.trim();
    const description = document.getElementById("homeworkDescription").value.trim();
    if (!title || !description) {
      alert("Enter both title and description.");
      return;
    }

    try {
      await addDoc(collection(db, "homeworks"), {
        title,
        description,
        assignedBy: auth.currentUser.uid,
        assignedAt: new Date(),
        classId: classSelector.value,
      });
      alert("Homework added!");
      homeworkForm.reset();
    } catch (error) {
      alert("Error adding homework: " + error.message);
    }
  });
}

// CREATE CLASS FORM SUBMISSION
if (classForm) {
  classForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = classNameInput.value.trim();
    if (!name) {
      alert("Enter a class name.");
      return;
    }

    try {
      await addDoc(collection(db, "classes"), {
        name,
        createdBy: auth.currentUser.uid,
      });
      alert("Class created!");
      classForm.reset();
    } catch (error) {
      alert("Error creating class: " + error.message);
    }
  });
}

// ADD STUDENT TO CLASS BUTTON
if (addStudentBtn) {
  addStudentBtn.addEventListener("click", async () => {
    const email = studentEmailInput.value.trim();
    const classId = addStudentClassSelector.value;

    if (!email || !classId) {
      alert("Fill both student email and class selection.");
      return;
    }

    try {
      // Find user with this email
      const usersQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnapshot = await getDocs(usersQuery);
      if (userSnapshot.empty) {
        alert("Student not found.");
        return;
      }

      const studentDoc = userSnapshot.docs[0];
      const studentId = studentDoc.id;

      // Add student to class subcollection
      await setDoc(doc(db, "classes", classId, "students", studentId), {
        email,
        addedAt: new Date(),
      });

      alert("Student added to class!");
      studentEmailInput.value = "";

      // Reload student list
      loadStudentsInClass(classId);
    } catch (error) {
      alert("Error adding student: " + error.message);
    }
  });
}

// Load students in selected class
async function loadStudentsInClass(classId) {
  studentListContainer.innerHTML = `<h4>Students in Selected Class</h4>`;
  if (!classId) {
    studentListContainer.innerHTML += "<p>No class selected.</p>";
    return;
  }

  const studentsCol = collection(db, "classes", classId, "students");
  const studentsSnapshot = await getDocs(studentsCol);

  if (studentsSnapshot.empty) {
    studentListContainer.innerHTML += "<p>No students added yet.</p>";
    return;
  }

  const ul = document.createElement("ul");
  ul.style.maxWidth = "400px";
  ul.style.padding = "0";
  ul.style.listStyle = "none";

  studentsSnapshot.forEach((studentDoc) => {
    const student = studentDoc.data();
    const li = document.createElement("li");
    li.style.background = "white";
    li.style.padding = "10px 12px";
    li.style.marginBottom = "10px";
    li.style.borderRadius = "6px";
    li.style.boxShadow = "0 0 5px rgba(0,0,0,0.08)";
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.fontFamily = "'Poppins', Arial, sans-serif";

    li.textContent = student.email;

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.style.backgroundColor = "#d32f2f";
    removeBtn.style.color = "white";
    removeBtn.style.border = "none";
    removeBtn.style.padding = "5px 10px";
    removeBtn.style.borderRadius = "4px";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.fontWeight = "600";

    removeBtn.addEventListener("click", async () => {
      const confirmRemove = confirm(`Remove student ${student.email} from this class?`);
      if (!confirmRemove) return;

      try {
        await deleteDoc(doc(db, "classes", classId, "students", studentDoc.id));
        alert(`Removed ${student.email} from class.`);
        // Reload student list after removal
        await loadStudentsInClass(classId);
      } catch (err) {
        alert("Error removing student: " + err.message);
      }
    });

    li.appendChild(removeBtn);
    ul.appendChild(li);
  });

  studentListContainer.appendChild(ul);
}

// Reload students list when the teacher selects a different class
classSelector.addEventListener("change", () => {
  const selectedClassId = classSelector.value;
  loadStudentsInClass(selectedClassId);
});



