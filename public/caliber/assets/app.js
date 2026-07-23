/* CALIBER — quiet-luxury foundation behaviour. No storage, no fetch.
   Chrome (header/footer) and per-page content are baked directly into the HTML now; this file
   only wires the interactive remainder: nav toggle, scroll reveal, batch lookup, the COA
   example-lot list, and the product-page reserve button.
   Loads on all 19 pages. data.js (window.CALIBER) loads on coa.html only, so every function
   here that touches window.CALIBER guards for its absence and no-ops cleanly instead of
   throwing. */
(function(){
  var D=window.CALIBER||{};
  var cart=[];

  function param(k){return new URLSearchParams(location.search).get(k);}

  /* ---- scroll reveal (D21: WeakSet guard, skip already-observed elements on re-entry) ---- */
  var revealed=(typeof WeakSet!=='undefined')?new WeakSet():null;
  function reveal(){
    var els=[].slice.call(document.querySelectorAll('.rv'));
    if(revealed){
      els=els.filter(function(e){
        if(revealed.has(e))return false;
        revealed.add(e);
        return true;
      });
    }
    if(!els.length)return;
    if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
    var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
    els.forEach(function(e){io.observe(e);});
  }

  /* ---- nav toggle (D11: header is baked, not injected; keeps aria-expanded in sync) ---- */
  function wireNav(){
    var t=document.getElementById('navtoggle'),n=document.getElementById('topnav');
    if(!t||!n)return;
    t.addEventListener('click',function(){
      var open=n.classList.toggle('open');
      t.setAttribute('aria-expanded',open?'true':'false');
    });
  }

  /* ---- batch lookup (coa.html) ---- */
  function renderCOA(inputSel,resultSel){
    var input=document.querySelector(inputSel||'#coa-input'),out=document.querySelector(resultSel||'#coa-result'),btn=document.querySelector('#coa-btn');
    function look(){
      if(!input||!out)return;
      var lot=(input.value||'').trim().toUpperCase();
      if(!lot&&param('lot')){lot=param('lot').toUpperCase();input.value=lot;}
      var c=D.coas&&D.coas[lot];
      if(!c){out.innerHTML='<div class="note" style="border-left-color:var(--fail)">No record for '+(lot||'that lot')+'. Try a lot from the catalogue, for example GLD-BLK-014.</div>';return;}
      var statusClass=c.result==='PASS'?'status--pass':'status--fail';
      out.innerHTML='<div class="rv in">'+
        '<div class="proto" style="margin-top:0;margin-bottom:1.4rem"><span class="proto__mark">Design prototype</span><p>Caliber is a design prototype. The products, certificates of analysis, laboratories, and customer reviews shown here are fictional.</p></div>'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:1rem;margin-bottom:1.4rem">'+
          '<div><span class="prow__sku">'+c.sku+'</span><h2 style="margin:.15em 0 0">'+c.name+'</h2></div>'+
          '<span class="'+statusClass+'">&bull; '+c.result+'</span></div>'+
        '<div class="thinbar" style="margin-bottom:1.4rem"><span style="width:'+c.purity+'%"></span></div>'+
        '<dl class="record">'+
          '<div class="record__row"><dt>Lot</dt><dd>'+lot+'</dd></div>'+
          '<div class="record__row"><dt>Purity</dt><dd>'+c.purity+'%</dd></div>'+
          '<div class="record__row"><dt>Identity</dt><dd>'+c.identity+'</dd></div>'+
          '<div class="record__row"><dt>Observed mass</dt><dd>'+c.mass+'</dd></div>'+
          '<div class="record__row"><dt>Method</dt><dd>'+c.method+'</dd></div>'+
          '<div class="record__row"><dt>Laboratory</dt><dd>'+c.lab+'</dd></div>'+
          '<div class="record__row"><dt>Date</dt><dd>'+c.date+'</dd></div>'+
        '</dl></div>';
    }
    if(btn)btn.addEventListener('click',look);
    if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter')look();});
    if(input&&out&&param('lot'))look();
  }

  /* ---- COA example-lot list (D20) ---- */
  function renderCOAExamples(sel){
    var h=document.querySelector(sel);
    if(!h||!D.coas)return;
    h.innerHTML=Object.keys(D.coas).sort().join(' &middot; ');
  }

  /* ---- product-page reserve button; reads its own SKU from data-sku on the button itself ---- */
  function wireReserve(sel){
    var b=document.querySelector(sel);
    if(!b)return;
    b.addEventListener('click',function(){
      var sku=b.getAttribute('data-sku');
      if(sku)cart.push(sku);
      var original=b.textContent;
      b.textContent='Reserved ✓';
      setTimeout(function(){b.textContent=original;},1500);
    });
  }

  window.CaliberApp={renderCOA:renderCOA,renderCOAExamples:renderCOAExamples,wireReserve:wireReserve,reveal:reveal};
  document.addEventListener('DOMContentLoaded',function(){wireNav();reveal();});
})();
