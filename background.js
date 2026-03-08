const pendingSubmissions = {}

chrome.runtime.onMessage.addListener((msg, sender) => {

  if (msg.type === "CF_SUBMIT") {

    const { contestId, problemIndex, code, languageId } = msg

    const submitUrl =
      `https://codeforces.com/problemset/submit?contestId=${contestId}&problemIndex=${problemIndex}`

    chrome.tabs.create({ url: submitUrl, active: false }, (tab) => {

      const tabId = tab.id

      pendingSubmissions[tabId] = {
        contestId,
        problemIndex,
        code,
        languageId,
        submitUrl
      }

    })

  }

})


chrome.runtime.onMessage.addListener((msg, sender) => {

  if (msg.type === "CF_REQUEST_SUBMIT_DATA") {

    const tabId = sender.tab.id

    const data = pendingSubmissions[tabId]

    if (!data) return

    chrome.tabs.sendMessage(tabId, {
      type: "CF_FILL_SUBMIT",
      ...data,
      tabId
    })

  }

})


chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "CF_LOGIN_REQUIRED") {

    const tabId = msg.tabId
    const data = pendingSubmissions[tabId]

    if (!data) return

    const loginUrl =
      `https://codeforces.com/enter?back=${encodeURIComponent(data.submitUrl)}`

    chrome.tabs.update(tabId, { url: loginUrl })

  }

})


chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "CF_SUBMITTED") {

    const { tabId, handle, contestId, problemIndex, timestamp } = msg

    broadcast({
      type: "CF_SUBMIT_STATUS",
      status: "submitted"
    })

    setTimeout(() => {
      chrome.tabs.remove(tabId)
      delete pendingSubmissions[tabId]
    }, 2000)

    if (handle) {
      pollVerdict(handle, contestId, problemIndex, timestamp)
    }

  }

})


async function pollVerdict(handle, contestId, problemIndex, timestamp) {

  let submissionId = null

  for (let i = 0; i < 25; i++) {

    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`
    )

    const data = await res.json()

    if (data && data.result) {

      const submission = data.result.find(s =>

        s.problem &&
        s.problem.contestId == contestId &&
        s.problem.index == problemIndex &&
        s.creationTimeSeconds >= timestamp
      )

      if (submission) {

        submissionId = submission.id
        break

      }

    }

    await sleep(1500)

  }

  if (!submissionId) return


  for (let i = 0; i < 80; i++) {

    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20`
    )

    const data = await res.json()

    if (!data || !data.result) {
      await sleep(2000)
      continue
    }

    const submission =
      data.result.find(s => String(s.id) === String(submissionId))

    if (!submission) {
      await sleep(2000)
      continue
    }

    if (submission.verdict && submission.verdict !== "TESTING") {

      broadcast({
        type: "CF_SUBMIT_STATUS",
        status: "finished",
        verdict:
          submission.verdict === "OK"
            ? "Accepted"
            : submission.verdict.replace(/_/g, " "),
        passedTests: submission.passedTestCount
      })

      return

    }

    await sleep(2000)

  }

}


function broadcast(msg) {

  chrome.tabs.query({}, (tabs) => {

    tabs.forEach(tab => {

      chrome.tabs.sendMessage(tab.id, msg)

    })

  })

}


function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}