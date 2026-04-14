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

  var keyOverlayCurrent = document.getElementById("key-debug-current");
  var keyOverlayLog = document.getElementById("key-debug-log");
  var debugLines = [];

  var appendDebugLine = function (message) {
    if (!keyOverlayLog) return;
    debugLines.unshift(message);
    debugLines = debugLines.slice(0, 12);
    keyOverlayLog.innerHTML = debugLines
      .map(function (line) {
        return "<div>" + line + "</div>";
      })
      .join("");
  };

  window.__V2_DEBUG__ = {
    log: function (message) {
      appendDebugLine(message);
    },
  };

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

  var updateKeyOverlay = function (event, phase) {
    if (!keyOverlayCurrent) return;
    var keyCode = event.keyCode || event.which || 0;
    keyOverlayCurrent.textContent =
      "phase=" +
      phase +
      " type=" +
      event.type +
      " key=" +
      String(event.key) +
      " code=" +
      String(event.code) +
      " keyCode=" +
      keyCode;
    appendDebugLine(
      phase +
        " " +
        event.type +
        " key=" +
        String(event.key) +
        " code=" +
        String(event.code) +
        " keyCode=" +
        keyCode,
    );
  };

  document.addEventListener(
    "keydown",
    function (event) {
      updateKeyOverlay(event, "boot-capture");
    },
    true,
  );

  document.addEventListener(
    "keyup",
    function (event) {
      updateKeyOverlay(event, "boot-keyup");
    },
    true,
  );

  window.addEventListener("error", function (event) {
    bootState.stage = "window-error";
    appendDebugLine(
      "window-error " +
        (event && event.message ? event.message : "Unknown startup error"),
    );
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
    appendDebugLine("unhandledrejection " + reason);
    renderPanel("Phase 3 Preview Failed", reason);
  });
})();
