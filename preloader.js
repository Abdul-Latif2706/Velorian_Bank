
/* =========================================================
   VELORIAN BANK — PREMIUM GLOBAL PRELOADER
   Works across all public, admin and client HTML pages.
   ========================================================= */
(function () {
  "use strict";

  var loader = document.getElementById("vb-preloader");
  if (!loader) return;

  var start = Date.now();
  var minimumVisibleTime = 850;
  var hidden = false;

  function hideLoader() {
    if (hidden) return;
    hidden = true;

    var elapsed = Date.now() - start;
    var delay = Math.max(0, minimumVisibleTime - elapsed);

    setTimeout(function () {
      loader.classList.add("vb-preloader-hide");
      setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, 650);
    }, delay);
  }

  if (document.readyState === "complete") {
    hideLoader();
  } else {
    window.addEventListener("load", hideLoader, { once: true });
  }

  // Safety fallback so a broken image or slow asset cannot trap the user.
  setTimeout(hideLoader, 4500);
})();
