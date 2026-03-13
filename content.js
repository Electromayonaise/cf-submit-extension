window.addEventListener("message", (event) => {

  if (!event.data) return
  if (event.data.type !== "CF_SUBMIT") return

  chrome.runtime.sendMessage(event.data)

})

chrome.runtime.onMessage.addListener(async (msg) => {

  if (msg.type === "CF_SUBMIT_STATUS") {
    window.postMessage(msg, "*")
    return
  }

  if (msg.type !== "CF_FILL_SUBMIT") return

  const { code, languageId, tabId, contestId, problemIndex } = msg

  try {

    if (isHomePage()) {
      chrome.runtime.sendMessage({ type: "CF_LOGIN_REQUIRED", tabId })
      return
    }

    if (isLoginPage()) {
      return
    }

    await waitForSubmitPage()

    const lang   = document.querySelector("select[name='programTypeId']")
    const editor = document.querySelector("textarea[name='source']")

    if (!lang || !editor) return

    lang.value = languageId
    lang.dispatchEvent(new Event("change", { bubbles: true }))

    await sleep(800)

    editor.value = code
    editor.dispatchEvent(new Event("input",  { bubbles: true }))
    editor.dispatchEvent(new Event("change", { bubbles: true }))

    const turnstileOk = await waitForTurnstile()

    if (!turnstileOk) {
      chrome.runtime.sendMessage({ type: "CF_SUBMIT_ERROR", tabId })
      return
    }

    await sleep(2000)

    const submitBtn =
      document.querySelector("#singlePageSubmitButton") ||
      document.querySelector("input[type='submit']")

    if (!submitBtn) return

    const handle = getHandle()

    // Avisar el handle ANTES del click para que background lo tenga listo
    chrome.runtime.sendMessage({
      type: "CF_CLICKED_SUBMIT",
      tabId,
      handle,
      contestId,
      problemIndex
    })

    submitBtn.click()

    // Si no hubo redirección y aparece un error, es fallo de turnstile
    const failed = await detectSubmitFailure()

    if (failed) {
      chrome.runtime.sendMessage({ type: "CF_SUBMIT_ERROR", tabId })
    }

    // Si no falla, CF redirige a /problemset/status
    // El background detecta eso en onUpdated, cierra la tab y hace el poll

  } catch (_) {}

})

window.addEventListener("load", () => {
  chrome.runtime.sendMessage({ type: "CF_REQUEST_SUBMIT_DATA" })
})

function waitForTurnstile() {

  return new Promise(resolve => {

    const APPEAR_TIMEOUT   = 5000
    const COMPLETE_TIMEOUT = 20000

    let appeared = false
    let appearTimer

    const waitAppear = setInterval(() => {

      if (getTurnstileFrame()) {
        clearInterval(waitAppear)
        clearTimeout(appearTimer)
        appeared = true
        waitForCompletion()
      }

    }, 300)

    appearTimer = setTimeout(() => {
      if (!appeared) {
        clearInterval(waitAppear)
        resolve(true)
      }
    }, APPEAR_TIMEOUT)

    function waitForCompletion() {

      let completeTimer

      const waitDone = setInterval(() => {

        const tokenInput =
          document.querySelector("input[name='cf-turnstile-response']") ||
          document.querySelector("input[name='g-recaptcha-response']")

        const solved =
          !getTurnstileFrame() ||
          (tokenInput && tokenInput.value && tokenInput.value.length > 10)

        if (solved) {
          clearInterval(waitDone)
          clearTimeout(completeTimer)
          resolve(true)
        }

      }, 400)

      completeTimer = setTimeout(() => {
        clearInterval(waitDone)
        resolve(false)
      }, COMPLETE_TIMEOUT)

    }

  })

}

function getTurnstileFrame() {
  return document.querySelector("iframe[src*='challenges.cloudflare.com']") ||
         document.querySelector("iframe[src*='turnstile']")
}

function detectSubmitFailure() {

  return new Promise(resolve => {

    const CHECK_DURATION = 4000

    const interval = setInterval(() => {

      const errorEl =
        document.querySelector(".error:not(:empty)") ||
        document.querySelector(".fieldError:not(:empty)")

      if (errorEl && errorEl.textContent.trim().length > 0) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve(true)
      }

    }, 300)

    const timer = setTimeout(() => {
      clearInterval(interval)
      resolve(false)
    }, CHECK_DURATION)

  })

}

function isHomePage() {
  return window.location.pathname === "/"
}

function isLoginPage() {
  return window.location.pathname === "/enter"
}

function getHandle() {
  const link = document.querySelector("a[href^='/profile/']")
  if (!link) return null
  return link.textContent.trim()
}

function waitForSubmitPage() {

  return new Promise(resolve => {

    const interval = setInterval(() => {

      const lang   = document.querySelector("select[name='programTypeId']")
      const editor = document.querySelector("textarea[name='source']")

      if (lang && editor) {
        clearInterval(interval)
        resolve()
      }

    }, 300)

  })

}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}