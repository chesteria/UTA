(function () {
  var app = document.getElementById("app");
  if (!app) return;

  var bootState = {
    stage: "classic-script-start",
    checks: {
      module: "noModule" in document.createElement("script"),
      promise: typeof Promise !== "undefined",
      fetch: typeof window.fetch === "function",
      localStorage:
        typeof window.localStorage !== "undefined" &&
        typeof window.localStorage.getItem === "function",
    },
    userAgent: navigator.userAgent,
  };

  window.__V2_BOOT__ = bootState;

  var renderPanel = function (title, message) {
    app.innerHTML =
      '<div class="boot-panel">' +
      "<h1>" +
      title +
      "</h1>" +
      "<p>" +
      message +
      "</p>" +
      "<pre>" +
      "stage: " +
      bootState.stage +
      "\nmodule: " +
      bootState.checks.module +
      "\npromise: " +
      bootState.checks.promise +
      "\nfetch: " +
      bootState.checks.fetch +
      "\nlocalStorage: " +
      bootState.checks.localStorage +
      "\nuserAgent: " +
      bootState.userAgent +
      "</pre>" +
      "</div>";
  };

  renderPanel("Phase 3 Preview Booting", "Classic script loaded.");

  window.addEventListener("error", function (event) {
    bootState.stage = "window-error";
    renderPanel(
      "Phase 3 Preview Failed",
      event && event.message ? event.message : "Unknown startup error",
    );
  });

  window.addEventListener("unhandledrejection", function (event) {
    bootState.stage = "unhandled-rejection";
    var reason =
      event && event.reason && event.reason.message
        ? event.reason.message
        : String((event && event.reason) || "Unknown promise rejection");
    renderPanel("Phase 3 Preview Failed", reason);
  });
})();
