chrome.runtime.onMessage.addListener((msg, sender) => {

  if (msg.type === "CF_SUBMIT") {

    const { contestId, problemIndex, code, languageId } = msg

    const url =
      `https://codeforces.com/problemset/submit?contestId=${contestId}&problemIndex=${problemIndex}`

    chrome.tabs.create({ url, active: false }, (tab) => {

      const tabId = tab.id

      const listener = (id, info) => {

        if (id !== tabId) return
        if (info.status !== "complete") return

        chrome.tabs.sendMessage(tabId, {
          type: "CF_FILL_SUBMIT",
          code,
          languageId,
          tabId
        })

        chrome.tabs.onUpdated.removeListener(listener)

      }

      chrome.tabs.onUpdated.addListener(listener)

    })

  }

})


chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "CF_SUBMITTED") {

    const { tabId, handle } = msg

    broadcast({
      type: "CF_SUBMIT_STATUS",
      status: "submitted"
    })

    setTimeout(() => {
      chrome.tabs.remove(tabId)
    }, 2000)

    if (handle) {
      pollVerdict(handle)
    }

  }

})


async function pollVerdict(handle) {

  let submissionId = null

  // esperar a que aparezca el submission nuevo
  for (let i = 0; i < 20; i++) {

    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`
    )

    const data = await res.json()

    if (data && data.result && data.result.length > 0) {

      submissionId = data.result[0].id
      break

    }

    await sleep(1500)

  }

  if (!submissionId) return


  // esperar a que termine el judge
  for (let i = 0; i < 60; i++) {

    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=5`
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