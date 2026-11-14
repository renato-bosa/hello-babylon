(function () {
  window.virtualControls = {
    left: false,
    right: false,
    up: false,
    down: false,
    confirmJustPressed: false,
    backJustPressed: false,
  };

  function isTouchDevice() {
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.location.search.includes("mobile=true")
    );
  }

  window.isNeonRushTouchDevice = isTouchDevice;

  function initMobileControls() {
    if (!isTouchDevice()) {
      return;
    }

    const mobileControls = document.getElementById("mobile-controls");
    if (!mobileControls) return;

    const buttons = {
      left: document.getElementById("btn-left"),
      right: document.getElementById("btn-right"),
      accel: document.getElementById("btn-accel"),
      brake: document.getElementById("btn-brake"),
    };

    const activeTouches = new Map();

    function activateControl(control, element) {
      if (control === "accel") {
        window.virtualControls.up = true;
        window.virtualControls.confirmJustPressed = true;
      } else if (control === "brake") {
        window.virtualControls.down = true;
        window.virtualControls.backJustPressed = true;
      } else {
        window.virtualControls[control] = true;
      }
      if (element) element.classList.add("active");
    }

    function deactivateControl(control, element) {
      if (control === "accel") {
        window.virtualControls.up = false;
      } else if (control === "brake") {
        window.virtualControls.down = false;
      } else if (control === "left" || control === "right") {
        window.virtualControls[control] = false;
      }
      if (element) element.classList.remove("active");
    }

    function getButtonAtPoint(x, y) {
      for (const [control, element] of Object.entries(buttons)) {
        if (!element) continue;
        const rect = element.getBoundingClientRect();

        if (control === "left" || control === "right") {
          const marginX = rect.width * 0.2;
          const marginY = rect.height * 0.2;
          const left = control === "left" ? rect.left - marginX : rect.left;
          const right = control === "right" ? rect.right + marginX : rect.right;
          const top = rect.top - marginY;
          const bottom = rect.bottom + marginY;
          if (x >= left && x <= right && y >= top && y <= bottom) {
            return { control, element };
          }
        } else if (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          return { control, element };
        }
      }
      return null;
    }

    function releaseTouch(touchId) {
      const touchData = activeTouches.get(touchId);
      if (!touchData) return;

      const ctrl = touchData.control;
      const elem = touchData.element;
      activeTouches.delete(touchId);

      if (ctrl && ctrl !== "deadzone") {
        let stillTouching = false;
        activeTouches.forEach(function (data) {
          if (data.control === ctrl) stillTouching = true;
        });
        if (!stillTouching) {
          deactivateControl(ctrl, elem);
        }
      }
    }

    Object.entries(buttons).forEach(function ([control, element]) {
      if (!element) return;

      element.addEventListener(
        "touchstart",
        function (e) {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            activeTouches.set(touch.identifier, { control, element });
          }
          activateControl(control, element);
        },
        { passive: false }
      );

      element.addEventListener("mousedown", function (e) {
        e.preventDefault();
        activateControl(control, element);
      });

      element.addEventListener("mouseup", function (e) {
        e.preventDefault();
        deactivateControl(control, element);
      });

      element.addEventListener("mouseleave", function () {
        deactivateControl(control, element);
      });
    });

    document.addEventListener(
      "touchend",
      function (e) {
        let handled = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const id = e.changedTouches[i].identifier;
          if (activeTouches.has(id)) {
            handled = true;
            releaseTouch(id);
          }
        }
        if (handled) e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchcancel",
      function (e) {
        let handled = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const id = e.changedTouches[i].identifier;
          if (activeTouches.has(id)) {
            handled = true;
            releaseTouch(id);
          }
        }
        if (handled) e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchmove",
      function (e) {
        let handled = false;
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const touchData = activeTouches.get(touch.identifier);
          if (!touchData) continue;
          handled = true;

          const hit = getButtonAtPoint(touch.clientX, touch.clientY);
          const newControl = hit && hit.control;
          const isDirectional = function (ctrl) {
            return ctrl === "left" || ctrl === "right";
          };
          const wasDirectional =
            isDirectional(touchData.control) || touchData.control === "deadzone";

          if (newControl && newControl !== touchData.control) {
            if (wasDirectional && isDirectional(newControl)) {
              if (touchData.control !== "deadzone") {
                deactivateControl(touchData.control, touchData.element);
              }
              activateControl(newControl, hit.element);
              activeTouches.set(touch.identifier, {
                control: newControl,
                element: hit.element,
              });
            }
          } else if (!newControl && wasDirectional) {
            if (touchData.control !== "deadzone") {
              deactivateControl(touchData.control, touchData.element);
              activeTouches.set(touch.identifier, {
                control: "deadzone",
                element: null,
              });
            }
          }
        }
        if (handled) e.preventDefault();
      },
      { passive: false }
    );
  }

  window.setMobileControlsVisible = function (visible) {
    const el = document.getElementById("mobile-controls");
    if (!el || !isTouchDevice()) return;
    el.classList.toggle("show", !!visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileControls);
  } else {
    initMobileControls();
  }
})();
