// Old and language-neutral legal URLs (/privacy/) send the reader to the page in their own
// language: Dutch for a Dutch browser, English otherwise. The page also links both, and a
// meta refresh falls back to English when scripts are off.
(function () {
  const root = document.documentElement;
  const nl = /^nl\b/i.test(navigator.language || '');
  const target = nl ? root.dataset.nl : root.dataset.en;
  if (target) location.replace(target);
})();
