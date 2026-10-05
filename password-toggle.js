(function(){
  function bindPasswordToggles(root){
    (root||document).querySelectorAll('.password-toggle[data-target]').forEach(function(btn){
      if(btn.dataset.passwordBound === '1') return;
      btn.dataset.passwordBound = '1';
      btn.type = 'button';
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '10';
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var input = document.getElementById(btn.getAttribute('data-target'));
        if(!input) return;
        var reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        btn.textContent = reveal ? 'Hide' : 'Show';
        btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
        btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ bindPasswordToggles(); });
  else bindPasswordToggles();
})();
