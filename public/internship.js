// =============================================
// QuizBlitz — Internship Application Logic
// =============================================

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var form = $('internship-form');
  var fileInput = $('app-resume');
  var fileNameDisplay = $('file-name');
  var btnSubmit = $('btn-submit');
  var btnText = btnSubmit.querySelector('.btn-text');
  var btnLoader = btnSubmit.querySelector('.btn-loader');
  var formMessage = $('form-message');

  var state = { participantId: null };
  var SESSION_KEY = 'quizblitz_session';

  // File Upload UI Update
  fileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showMessage('Please upload a PDF file.', 'error');
        fileInput.value = '';
        fileNameDisplay.textContent = 'Choose a PDF file...';
        fileNameDisplay.classList.remove('selected');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        showMessage('File size must be less than 5MB.', 'error');
        fileInput.value = '';
        fileNameDisplay.textContent = 'Choose a PDF file...';
        fileNameDisplay.classList.remove('selected');
        return;
      }
      
      fileNameDisplay.textContent = file.name;
      fileNameDisplay.classList.add('selected');
      hideMessage();
    } else {
      fileNameDisplay.textContent = 'Choose a PDF file...';
      fileNameDisplay.classList.remove('selected');
    }
  });

  // Convert File to Base64
  function getBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function (error) { reject(error); };
    });
  }

  function showMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.className = 'form-message ' + type;
    formMessage.hidden = false;
  }

  function hideMessage() {
    formMessage.hidden = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideMessage();

    var name = $('app-name').value.trim();
    var email = $('app-email').value.trim();
    var phone = $('app-phone').value.trim();
    var college = $('app-college').value.trim();
    var branch = $('app-branch').value.trim();
    var year = $('app-year').value.trim();
    var category = $('app-category').value.trim();
    var whyHire = $('app-why').value.trim();
    var file = fileInput.files[0];

    if (!name || !email || !phone || !college || !branch || !year || !category || !whyHire || !file) {
      showMessage('Please fill in all fields and upload a PDF resume.', 'error');
      return;
    }

    // Set Loading State
    btnSubmit.disabled = true;
    btnText.textContent = 'Submitting...';
    btnLoader.hidden = false;

    // Process File and Submit
    getBase64(file).then(function(base64Data) {
      var payload = {
        action: 'submitInternship',
        name: name,
        email: email,
        phone: phone,
        college: college,
        branch: branch,
        year: year,
        category: category,
        whyHire: whyHire,
        resumeName: file.name,
        resumeData: base64Data
      };

      fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        
        // Success
        form.reset();
        fileNameDisplay.textContent = 'Choose a PDF file...';
        fileNameDisplay.classList.remove('selected');
        showMessage('Application submitted successfully! We will get back to you soon.', 'success');
        
        btnSubmit.disabled = false;
        btnText.textContent = 'Submit Application';
        btnLoader.hidden = true;
      })
      .catch(function (err) {
        showMessage('Submission failed: ' + (err.message || 'Unknown error'), 'error');
        btnSubmit.disabled = false;
        btnText.textContent = 'Submit Application';
        btnLoader.hidden = true;
      });
    }).catch(function(err) {
      showMessage('Failed to read file: ' + err.message, 'error');
      btnSubmit.disabled = false;
      btnText.textContent = 'Submit Application';
      btnLoader.hidden = true;
    });
  });

  // Pre-fill data
  function init() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        var session = JSON.parse(raw);
        if (session.participantId) {
          state.participantId = session.participantId;
          
          btnSubmit.disabled = true;
          btnText.textContent = 'Loading details...';
          
          fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getParticipantStatus', participantId: state.participantId })
          })
          .then(res => res.json())
          .then(data => {
            if (data.valid) {
              if (data.internshipState !== 'OPEN') {
                showMessage('The internship application is not open yet. Please wait for the admin.', 'error');
                form.style.opacity = '0.5';
                form.style.pointerEvents = 'none';
                return;
              }
              
              $('app-name').value = data.name || '';
              $('app-branch').value = data.branch || 'CSE';
              $('app-phone').value = data.contact || '';
            }
            btnSubmit.disabled = false;
            btnText.textContent = 'Submit Application';
          })
          .catch(() => {
            btnSubmit.disabled = false;
            btnText.textContent = 'Submit Application';
          });
        }
      }
    } catch (e) {}
  }
  
  init();

})();
