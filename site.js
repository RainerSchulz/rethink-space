/* RE-THINK SPACE — Sprachumschalter und Mobilnavigation */
(function () {
  var KEY = "rethink-lang";

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* egal */ }
  }

  function apply(lang) {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang);
    var buttons = document.querySelectorAll(".lang button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].dataset.lang === lang));
    }
  }

  var initial = stored();
  if (initial !== "de" && initial !== "en") {
    initial = (navigator.language || "de").toLowerCase().indexOf("de") === 0 ? "de" : "en";
  }
  apply(initial);

  document.addEventListener("click", function (ev) {
    var langBtn = ev.target.closest(".lang button");
    if (langBtn) {
      apply(langBtn.dataset.lang);
      remember(langBtn.dataset.lang);
      return;
    }
    var burger = ev.target.closest(".burger");
    if (burger) {
      var nav = document.querySelector(".nav");
      if (nav) {
        var open = nav.classList.toggle("open");
        burger.setAttribute("aria-expanded", String(open));
      }
      return;
    }
    if (!ev.target.closest(".nav")) {
      var openNav = document.querySelector(".nav.open");
      if (openNav) openNav.classList.remove("open");
    }
  });

  var form = document.querySelector("form[data-contact]");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var note = form.querySelector(".form-status");
      if (note) note.hidden = false;
    });
  }
})();

/* Portrait-Platzhalter, solange Bilder/Lierfeld.jpg fehlt */
(function () {
  var box = document.querySelector("[data-portrait]");
  if (!box) return;
  var img = box.querySelector("img");
  if (!img) return;
  function placeholder() {
    box.innerHTML =
      '<div class="ph"><span class="initials">JL</span>' +
      '<span class="de">Portrait einsetzen als<br>Bilder/Lierfeld.jpg</span>' +
      '<span class="en">Add portrait as<br>Bilder/Lierfeld.jpg</span></div>';
  }
  img.addEventListener("error", placeholder);
  if (img.complete && img.naturalWidth === 0) placeholder();
})();
