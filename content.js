window.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type !== "CF_SUBMIT") return;

  chrome.runtime.sendMessage(event.data);
});


chrome.runtime.onMessage.addListener(async (msg) => {

  if (msg.type === "CF_SUBMIT_STATUS") {
    window.postMessage(msg, "*");
    return;
  }

  if (msg.type !== "CF_FILL_SUBMIT") return;

  const { code, languageId, tabId, contestId, problemIndex, submitUrl } = msg;

  try {

    if (isHomePage()) {

      const loginUrl =
        `https://codeforces.com/enter?back=${encodeURIComponent(submitUrl)}`;

      window.location.href = loginUrl;

      return;
    }

    if (isLoginPage()) {
      return;
    }

    await waitForSubmitPage();

    const lang = document.querySelector("select[name='programTypeId']");
    const editor = document.querySelector("textarea[name='source']");

    if (!lang || !editor) return;

    lang.value = languageId;
    lang.dispatchEvent(new Event("change", { bubbles: true }));

    await sleep(800);

    editor.value = code;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));

    await waitForTurnstile();

    await sleep(1500);

    const submitBtn =
      document.querySelector("#singlePageSubmitButton") ||
      document.querySelector("input[type='submit']");

    if (!submitBtn) return;

    const handle = getHandle();

    submitBtn.click();

    const timestamp = Math.floor(Date.now() / 1000);

    chrome.runtime.sendMessage({
      type: "CF_SUBMITTED",
      tabId,
      handle,
      contestId,
      problemIndex,
      timestamp,
    });

  } catch (_) {}

});


window.addEventListener("load", () => {

  chrome.runtime.sendMessage({
    type: "CF_REQUEST_SUBMIT_DATA"
  })

})


function isHomePage() {
  return window.location.pathname === "/";
}


function isLoginPage() {
  return window.location.pathname === "/enter";
}


function getHandle() {
  const links = document.querySelectorAll("a[href^='/profile/']");

  for (const link of links) {
    const href = link.getAttribute("href");

    if (!href) continue;

    const handle = href.split("/profile/")[1];

    if (handle) return handle;
  }

  return null;
}


function waitForSubmitPage() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const editor = document.querySelector("textarea[name='source']");

      if (editor) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}


function waitForTurnstile() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const iframe = document.querySelector(
        "iframe[src*='challenges.cloudflare.com']",
      );

      if (!iframe) {
        clearInterval(interval);
        resolve();
        return;
      }

      const label = iframe.getAttribute("aria-label") || "";

      if (label.toLowerCase().includes("success")) {
        clearInterval(interval);
        resolve();
      }
    }, 600);
  });
}


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}