(()=>{
  const $=id=>document.getElementById(id);
  const password=$('password');
  const button=$('loginBtn');
  const error=$('error');
  async function login(){
    error.textContent='';
    button.disabled=true;
    try{
      const r=await fetch('/api/auth-login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({password:password.value})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        if(r.status===429) throw new Error('Troppi tentativi. Riprova più tardi.');
        throw new Error('Password non valida.');
      }
      if(!data.mfaRequired||!data.redirect) throw new Error('Accesso sicuro non disponibile.');
      window.location.assign(data.redirect);
    }catch(e){
      error.textContent=e.message||'Accesso non riuscito.';
      button.disabled=false;
      password.select();
    }
  }
  button.addEventListener('click',login);
  password.addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  password.focus();
})();
