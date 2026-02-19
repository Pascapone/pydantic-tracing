const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3341'
const loginUrl = new URL('/login', baseUrl).toString()
const attempts = Number(process.env.E2E_PREFLIGHT_ATTEMPTS ?? 30)
const intervalMs = Number(process.env.E2E_PREFLIGHT_INTERVAL_MS ?? 1000)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function looksLikeDokploy(text) {
  const content = text.toLowerCase()
  return content.includes('dokploy') || content.includes('oops, something went wrong')
}

let lastFailure = ''

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(loginUrl, { redirect: 'manual' })
    const body = await response.text()
    const okStatus = response.status >= 200 && response.status < 400

    if (okStatus && !looksLikeDokploy(body)) {
      process.stdout.write(`E2E preflight ready: ${loginUrl}\n`)
      process.exit(0)
    }

    if (looksLikeDokploy(body)) {
      lastFailure = `Received Dokploy-style response from ${loginUrl}`
    } else {
      lastFailure = `Received status ${response.status} from ${loginUrl}`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastFailure = `Cannot reach ${loginUrl}: ${message}`
  }

  if (attempt < attempts) {
    await wait(intervalMs)
  }
}

process.stderr.write(`E2E preflight failed: ${lastFailure}\n`)
process.stderr.write('Start the dev server with `npm run dev:test` and retry.\n')
process.exit(1)
