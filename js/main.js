import { translate, translations } from './i18n.js';
const KEY='uhs-preferred-language';
const safeStorage={
 get(){try{return localStorage.getItem(KEY)}catch{return null}},
 set(v){try{localStorage.setItem(KEY,v)}catch{/* Works without localStorage */}}
};
function applyLanguage(lang){
 const locale=lang==='en'?'en':'si';
 document.documentElement.lang=locale;
 document.querySelectorAll('[data-i18n]').forEach(node=>{const key=node.dataset.i18n;node.textContent=translate(locale,key)});
 // Only trusted in-repository translation strings are rendered as HTML.
 document.querySelectorAll('[data-i18n-html]').forEach(node=>{const key=node.dataset.i18nHtml;node.innerHTML=translate(locale,key)});
 for(const button of document.querySelectorAll('[data-lang]')){
  const selected=button.dataset.lang===locale;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
 }
 document.title=location.pathname.endsWith('login.html')?'School Portal | G/Upper Homadola School':'G/Upper Homadola School | '+(locale==='si'?'මුල් පිටුව':'Welcome');
 safeStorage.set(locale);
}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>applyLanguage(button.dataset.lang)));
applyLanguage(safeStorage.get() || 'si');
const menuToggle=document.getElementById('menu-toggle');
const menu=document.getElementById('main-nav');
function closeMenu(){menu?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false');menuToggle?.setAttribute('aria-label','Open menu')}
menuToggle?.addEventListener('click',()=>{
 const open=menu.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close menu':'Open menu');
});
menu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
document.addEventListener('click',e=>{if(menu?.classList.contains('open')&&!e.target.closest('.site-header'))closeMenu()});
document.querySelectorAll('#year').forEach(el=>el.textContent=String(new Date().getFullYear()));
const siteHeader=document.getElementById('site-header'),topButton=document.getElementById('scroll-top');
function onScroll(){siteHeader?.classList.toggle('scrolled',scrollY>15);topButton?.classList.toggle('show',scrollY>500)}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();
topButton?.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
const sectionIds=['home','about','academics','news','gallery','contact'];
const navLinks=[...document.querySelectorAll('[data-nav]')];
if('IntersectionObserver' in window && navLinks.length){
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)for(const link of navLinks){const active=link.dataset.nav===entry.target.id;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')}
 },{rootMargin:'-20% 0px -60% 0px'});
 for(const id of sectionIds){const section=document.getElementById(id);if(section)observer.observe(section)}
}
