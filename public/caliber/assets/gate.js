/* CALIBER — client-side password gate. No backend: the password is never stored in this file,
   only its SHA-256 hex digest, checked with crypto.subtle at submit time. Runs as a synchronous
   head script, before <body> is parsed, so it can hide the page before first paint. Unlock state
   lives in sessionStorage so navigating between pages in the same tab session does not re-prompt;
   a new tab/session (or private window) prompts again. Self-contained: no external requests. */
(function(){
  var KEY='caliber_gate_ok';
  var HASH='2603bfe8116223b2d78c76664f2fd6957e77c5a1e20652206375bcbdd9bcc736';

  function unlocked(){
    try{return window.sessionStorage&&sessionStorage.getItem(KEY)==='1';}
    catch(e){return false;}
  }
  function markUnlocked(){
    try{if(window.sessionStorage)sessionStorage.setItem(KEY,'1');}
    catch(e){/* no persistence available: page still unlocks, next page just re-prompts */}
  }

  if(unlocked())return;

  /* ---- hide the real page instantly (before body exists) and paint the overlay design ----
     body>* goes visibility:hidden (no layout shift, not focusable, not in the a11y tree); the
     overlay is exempted by id. html/body background is forced dark so there is no white flash
     while styles.css is still loading. Colours/fonts are the site's own tokens (styles.css
     :root), hardcoded here since this script runs before that stylesheet is guaranteed parsed. */
  var CSS=
    'html,body{background:#0A0A09 !important}'+
    'body>*{visibility:hidden !important}'+
    '#caliber-gate-overlay,#caliber-gate-overlay *{visibility:visible !important}'+
    '#caliber-gate-overlay{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:#0A0A09;padding:24px;font-family:"Inter",system-ui,-apple-system,sans-serif}'+
    '#caliber-gate-overlay .cg-card{width:100%;max-width:360px;text-align:center}'+
    '#caliber-gate-overlay .cg-mark{font-family:"Fraunces","Times New Roman",serif;font-weight:500;font-size:1.25rem;letter-spacing:.16em;color:#E9E5DC;margin:0 0 2.2rem}'+
    '#caliber-gate-overlay .cg-title{font-family:"Fraunces","Times New Roman",serif;font-weight:400;font-size:1.7rem;line-height:1.15;letter-spacing:-.01em;color:#E9E5DC;margin:0 0 .6rem}'+
    '#caliber-gate-overlay .cg-sub{font-size:.92rem;color:#8A857A;margin:0 0 2rem;line-height:1.6}'+
    '#caliber-gate-overlay form{display:flex;flex-direction:column;gap:14px}'+
    '#caliber-gate-overlay .cg-label{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:#7E796E;text-align:left}'+
    '#caliber-gate-overlay input[type=password]{background:#141310;border:1px solid #33302A;color:#E9E5DC;font-size:1rem;padding:.85em 1em;border-radius:2px;font-family:"Inter",system-ui,-apple-system,sans-serif;width:100%}'+
    '#caliber-gate-overlay input[type=password]:focus{outline:none;border-color:#B08A54}'+
    '#caliber-gate-overlay .cg-submit{background:#E9E5DC;color:#0A0A09;border:0;padding:.9em 1.6em;border-radius:2px;font-weight:500;font-size:.86rem;letter-spacing:.03em;cursor:pointer;font-family:"Inter",system-ui,-apple-system,sans-serif;margin-top:4px}'+
    '#caliber-gate-overlay .cg-submit:hover{background:#fff}'+
    '#caliber-gate-overlay .cg-error{font-size:.82rem;color:#C08670;margin:2px 0 0;text-align:left}';
  var styleEl=document.createElement('style');
  styleEl.id='caliber-gate-style';
  styleEl.textContent=CSS;
  (document.head||document.documentElement).appendChild(styleEl);

  function toHex(buf){
    var b=new Uint8Array(buf),hex='';
    for(var i=0;i<b.length;i++){var h=b[i].toString(16);hex+=h.length===1?'0'+h:h;}
    return hex;
  }

  function buildOverlay(){
    var overlay=document.createElement('div');
    overlay.id='caliber-gate-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','caliber-gate-title');

    var card=document.createElement('div');
    card.className='cg-card';
    var mark=document.createElement('p');
    mark.className='cg-mark';
    mark.textContent='CALIBER';
    var title=document.createElement('h1');
    title.className='cg-title';
    title.id='caliber-gate-title';
    title.textContent='This page is password protected';
    card.appendChild(mark);
    card.appendChild(title);

    var supported=!!(window.crypto&&window.crypto.subtle&&window.crypto.subtle.digest&&window.TextEncoder);
    if(!supported){
      var warn=document.createElement('p');
      warn.className='cg-sub';
      warn.textContent='This browser cannot run the check required to unlock this page. Try a current version of Chrome, Firefox, Safari, or Edge.';
      card.appendChild(warn);
      overlay.appendChild(card);
      return overlay;
    }

    var sub=document.createElement('p');
    sub.className='cg-sub';
    sub.textContent='Enter the password to continue.';
    card.appendChild(sub);

    var form=document.createElement('form');
    form.id='caliber-gate-form';
    form.setAttribute('novalidate','');

    var label=document.createElement('label');
    label.className='cg-label';
    label.setAttribute('for','caliber-gate-input');
    label.textContent='Password';

    var input=document.createElement('input');
    input.type='password';
    input.id='caliber-gate-input';
    input.name='password';
    input.autocomplete='off';
    input.spellcheck=false;

    var submit=document.createElement('button');
    submit.type='submit';
    submit.className='cg-submit';
    submit.textContent='Enter';

    var error=document.createElement('p');
    error.id='caliber-gate-error';
    error.className='cg-error';
    error.setAttribute('role','alert');
    error.textContent='Incorrect password. Try again.';
    error.hidden=true;

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(submit);
    form.appendChild(error);
    card.appendChild(form);
    overlay.appendChild(card);

    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      var value=input.value;
      window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)).then(function(buf){
        if(toHex(buf)===HASH){
          markUnlocked();
          styleEl.remove();
          overlay.remove();
        }else{
          error.hidden=false;
          input.value='';
          input.focus();
        }
      }).catch(function(){
        error.hidden=false;
        input.value='';
        input.focus();
      });
    });

    return overlay;
  }

  function mount(){
    var overlay=buildOverlay();
    (document.body||document.documentElement).appendChild(overlay);
    var input=document.getElementById('caliber-gate-input');
    if(input)input.focus();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',mount);
  }else{
    mount();
  }
})();
