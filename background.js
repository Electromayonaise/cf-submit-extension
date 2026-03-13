const pendingSubmissions = {}

chrome.runtime.onMessage.addListener((msg, sender) => {

  if (msg.type === "CF_SUBMIT") {

    const { contestId, problemIndex, code, languageId } = msg

    const submitUrl =
      `https://codeforces.com/problemset/submit?contestId=${contestId}&problemIndex=${problemIndex}`

    // Crear ventana minimizada y sin foco — invisible para el usuario
    chrome.windows.create(
      { url: submitUrl, state: "minimized", focused: false },
      (win) => {
        const tab = win.tabs[0]
        pendingSubmissions[tab.id] = {
          contestId,
          problemIndex,
          code,
          languageId,
          submitUrl,
          windowId: win.id,
          phase: "submit"
        }
      }
    )

  }

})

chrome.runtime.onMessage.addListener((msg, sender) => {

  if (msg.type === "CF_REQUEST_SUBMIT_DATA") {

    const tabId = sender.tab.id
    const data  = pendingSubmissions[tabId]
    if (!data) return

    chrome.tabs.sendMessage(tabId, { type: "CF_FILL_SUBMIT", ...data, tabId })

  }

})

chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "CF_LOGIN_REQUIRED") {

    const tabId = msg.tabId
    const data  = pendingSubmissions[tabId]
    if (!data) return

    const loginUrl =
      `https://codeforces.com/enter?back=${encodeURIComponent(data.submitUrl)}`

    data.phase = "login"

    // Login: traer la ventana al frente y focusear al usuario
    chrome.tabs.update(tabId, { url: loginUrl }, () => {
      chrome.windows.update(data.windowId, { state: "normal", focused: true }, () => {
        chrome.tabs.update(tabId, { active: true })
      })
    })

  }

})

chrome.runtime.onMessage.addListener((msg) => {

  // Turnstile necesita intervención manual: mostrar la ventana al usuario
  if (msg.type === "CF_SUBMIT_ERROR") {

    const tabId = msg.tabId
    const data  = pendingSubmissions[tabId]
    if (!data) return

    chrome.windows.update(data.windowId, { state: "normal", focused: true }, () => {
      chrome.tabs.update(tabId, { active: true })
    })

  }

})

// Content.js avisa el handle justo antes de hacer click en submit
chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "CF_CLICKED_SUBMIT") {

    const { tabId, handle, contestId, problemIndex } = msg
    const data = pendingSubmissions[tabId]
    if (!data) return

    data.handle       = handle
    data.contestId    = contestId
    data.problemIndex = problemIndex

  }

})

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {

  if (info.status !== "complete") return

  const data = pendingSubmissions[tabId]
  if (!data || data.phase === "done") return

  const url = tab.url || ""

  // Tras login exitoso, ?back= redirige de vuelta al submit
  // Volver a minimizar y re-disparar el fill (el load event ya pasó)
  if (data.phase === "login" && url.includes("/problemset/submit")) {
    data.phase = "submit"
    chrome.windows.update(data.windowId, { state: "minimized", focused: false })
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        type: "CF_FILL_SUBMIT",
        ...data,
        tabId
      })
    }, 500)
    return
  }

  // CF redirige aquí cuando el submit fue exitoso
  if (data.phase === "submit" && url.includes("/problemset/status")) {
    data.phase = "done"

    broadcast({ type: "CF_SUBMIT_STATUS", status: "submitted" })

    chrome.windows.remove(data.windowId)
    delete pendingSubmissions[tabId]

    if (data.handle) {
      pollVerdict(data.handle, data.contestId, data.problemIndex)
    }

    return
  }

  // Cualquier otra carga en el flujo: mantener minimizada
  if (data.phase === "submit") {
    chrome.windows.update(data.windowId, { state: "minimized", focused: false })
  }

})

async function pollVerdict(handle, contestId, problemIndex) {

  await sleep(4000)

  for (let i = 0; i < 40; i++) {

    try {

      const res  = await fetch(
        `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`
      )
      const data = await res.json()

      if (data.status !== "OK" || !data.result.length) {
        await sleep(3000)
        continue
      }

      const sub = data.result[0]

      if (String(sub.contestId) !== String(contestId) ||
          sub.problem.index     !== problemIndex) {
        await sleep(3000)
        continue
      }

      const verdict = sub.verdict

      if (!verdict || verdict === "TESTING") {
        await sleep(3000)
        continue
      }

      broadcast({
        type:        "CF_SUBMIT_STATUS",
        status:      "finished",
        verdict:     verdictLabel(verdict),
        passedTests: sub.passedTestCount || 0
      })

      return

    } catch (_) {
      await sleep(3000)
    }

  }

  broadcast({
    type:        "CF_SUBMIT_STATUS",
    status:      "finished",
    verdict:     "Unknown (timeout)",
    passedTests: 0
  })

}

function verdictLabel(verdict) {
  const map = {
    "OK":                      "Accepted",
    "WRONG_ANSWER":            "Wrong Answer",
    "TIME_LIMIT_EXCEEDED":     "Time Limit Exceeded",
    "MEMORY_LIMIT_EXCEEDED":   "Memory Limit Exceeded",
    "RUNTIME_ERROR":           "Runtime Error",
    "COMPILATION_ERROR":       "Compilation Error",
    "PRESENTATION_ERROR":      "Presentation Error",
    "IDLENESS_LIMIT_EXCEEDED": "Idleness Limit Exceeded",
    "CHALLENGED":              "Challenged",
    "SKIPPED":                 "Skipped",
    "REJECTED":                "Rejected"
  }
  return map[verdict] || verdict
}

function broadcast(msg) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {})
    }
  })
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}