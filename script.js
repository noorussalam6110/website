// Year auto-update
document.getElementById("year").textContent = new Date().getFullYear();

// Admission Form
function submitAdmission(e){
  e.preventDefault();
  const alertBox = document.getElementById('admissionAlert');
  alertBox.className = 'alert alert-success';
  alertBox.textContent = 'Application submitted successfully!';
  alertBox.style.display = 'block';
  e.target.reset();
  setTimeout(()=> alertBox.style.display='none', 4000);
  return false;
}

// Contact Form
function submitContact(e){
  e.preventDefault();
  const alertBox = document.getElementById('contactAlert');
  alertBox.className = 'alert alert-success';
  alertBox.textContent = 'Message sent successfully!';
  alertBox.style.display = 'block';
  e.target.reset();
  setTimeout(()=> alertBox.style.display='none', 4000);
  return false;
}

// Result Checker
function showResult(e){
  e.preventDefault();
  const roll = document.getElementById('roll').value.trim();
  const resultBox = document.getElementById('resultOutput');
  
  if(roll === '12345'){
    resultBox.className = 'alert alert-success';
    resultBox.textContent = '🎉 Congratulations! You passed with distinction.';
  } else {
    resultBox.className = 'alert alert-warning';
    resultBox.textContent = 'No result found for Roll Number: ' + roll;
  }
  resultBox.style.display = 'block';
  setTimeout(()=> resultBox.style.display='none', 5000);
  e.target.reset();
  return false;
}

// Gallery Modal
function openModal(src){
  const modalImg = document.getElementById('modalImg');
  modalImg.src = src;
  const modal = new bootstrap.Modal(document.getElementById('imgModal'));
  modal.show();
}
const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => {
    container.classList.add('active');
})

loginBtn.addEventListener('click', () => {
    container.classList.remove('active');
})
