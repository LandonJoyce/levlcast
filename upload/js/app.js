function showToast() {
  const toast = document.getElementById('success-toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function handleSubmit(e) {
  e.preventDefault();
  const email = e.target.querySelector('.email-input').value.trim();
  if (!email) return;

  // TODO: swap this fetch for your real endpoint (Supabase, Formspree, etc.)
  // Example Formspree: fetch('https://formspree.io/f/YOUR_ID', { method:'POST', body: JSON.stringify({email}), headers:{'Content-Type':'application/json'} })

  showToast();
  e.target.reset();
}

document.getElementById('waitlist-form').addEventListener('submit', handleSubmit);
document.getElementById('waitlist-form-2').addEventListener('submit', handleSubmit);
