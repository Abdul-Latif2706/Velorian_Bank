document.addEventListener('DOMContentLoaded',()=>{
  const $=s=>document.querySelector(s), form=$('#registerForm'), msg=$('#registerMessage');
  if(!form||!msg) return;
  const show=(text,type='error')=>{
    msg.textContent=text;
    msg.className=`form-error show full-field ${type}`;
  };
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('#regName').value.trim(),email=$('#regEmail').value.trim(),country=$('#regCountry').value.trim(),phone=$('#regPhone').value.trim(),accountType=$('#regAccountType').value,currency=$('#regCurrency').value,password=$('#regPassword').value,confirm=$('#regConfirm').value;
    if(password!==confirm) return show('Passwords do not match.');
    if(password.length<8) return show('Password must contain at least 8 characters.');
    if(!$('#regAgree').checked) return show('Please accept the account-opening terms to continue.');
    if(!vbOnlineEnabled()) return show('Online account opening is currently unavailable because the secure banking service has not been connected yet. The website is ready; the administrator only needs to connect the banking API before live accounts can be created.','warning');
    const btn=form.querySelector('button[type=submit]');
    btn.disabled=true; btn.dataset.original=btn.innerHTML; btn.innerHTML='Creating secure account…';
    try{
      const r=await vbOnlineRegister({name,email,country,phone,accountType,currency,password});
      if(r.client) vbMergeRemoteClients([r.client]);
      form.reset();
      show(r.emailSent?`Account created successfully. Your account number is ${r.client.accountNumber}. A confirmation email has been sent to ${r.client.email}.`:`Account created successfully. Your account number is ${r.client.accountNumber}. Email delivery still needs to be configured by the bank administrator.`,r.emailSent?'success':'warning');
    }catch(err){ show(err.message||'Unable to create the account. Please try again.'); }
    finally{ btn.disabled=false; btn.innerHTML=btn.dataset.original||'Open my account <span>→</span>'; }
  });
});
