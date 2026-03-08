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

  if (msg.type === "CF_CLOSE_TAB") {

    chrome.tabs.remove(msg.tabId)

  }

})


chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type !== "CF_SUBMIT_STATUS") return

  chrome.tabs.query({}, (tabs) => {

    tabs.forEach(tab => {

      chrome.tabs.sendMessage(tab.id, msg)

    })

  })

})