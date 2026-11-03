/* Contact form: sends to the Google Apps Script web app set in the form's data-endpoint.
   Until data-endpoint is filled in, submitting opens a pre-filled email instead. */
(function(){
  const form = document.getElementById('contact-form');
  if(!form) return;
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button.textContent;
  const email = form.dataset.email;

  function show(message, type, withEmailLink){
    status.textContent = message;
    status.className = 'form-status ' + type;
    if(withEmailLink){
      status.append(' Please email me at ');
      const a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      status.append(a, '.');
    }
  }

  function openEmail(data){
    const body = 'Name: ' + data.get('name') + '\nEmail: ' + data.get('email') +
      '\nNeeds help with: ' + (data.get('service') || 'Not specified') + '\n\n' + data.get('message');
    window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Enquiry from ' + data.get('name')) +
      '&body=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!form.reportValidity()) return;
    const data = new FormData(form);
    if(data.get('website')) return; // spam trap
    const endpoint = (form.dataset.endpoint || '').trim();

    if(!endpoint){
      openEmail(data);
      show('Your email app should open with your message ready to send.', 'info');
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending…';
    show('', 'info');
    try{
      const res = await fetch(endpoint, { method:'POST', body:new URLSearchParams(data) });
      const out = await res.json();
      if(!out.ok) throw new Error(out.error || '');
      form.reset();
      show("Thanks! Your message is in. Check your inbox for a confirmation — I'll reply personally within 24 hours.", 'success');
    }catch(err){
      show(err.message || "Sorry, your message couldn't be sent.", 'error', true);
    }finally{
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  });
})();
