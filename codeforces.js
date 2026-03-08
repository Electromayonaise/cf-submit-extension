async function getLastSubmission(handle) {

  const res =
    await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`)

  const data = await res.json()

  if (data.status !== "OK") {
    throw new Error("API error")
  }

  return data.result[0]

}