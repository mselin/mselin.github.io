(() => {
  const el = document.getElementById('typed');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = ['Full-stack and DevOps engineer · homelab builder', 'Python, TypeScript, Go and C#', 'Talos, Flux and ZFS', 'C64 SID music'];
  let l = 0, i = 0, del = false;
  el.textContent = '';
  (function tick() {
    const s = lines[l];
    i += del ? -1 : 1;
    el.textContent = s.slice(0, i);
    let wait = del ? 25 : 55;
    if (!del && i === s.length) { del = true; wait = 2200; }
    else if (del && i === 0) { del = false; l = (l + 1) % lines.length; wait = 350; }
    setTimeout(tick, wait);
  })();
})();
