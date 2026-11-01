fetch('/api/stats').then((r) => r.json()).then((s) => {
  document.querySelector('[data-stat="cap"]').textContent = s.member_cap;
  document.querySelector('[data-stat="left"]').textContent = s.seats_left;
}).catch(() => {});
