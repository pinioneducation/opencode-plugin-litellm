// OpenCode V2 plugin: LiteLLM as an OpenAI-compatible provider.
//
// Zero dependencies on purpose. This file runs inside OpenCode's own runtime,
// so it needs no Node.js install, no npm install, and no node_modules folder.
// Copy index.js + package.json into a folder and point OpenCode at it.
//
// Config:
//   { "plugins": [{ "package": "./litellm-plugin",
//                   "options": { "baseURL": "https://your-litellm-host" } }] }
//
// Env fallbacks: LITELLM_BASE_URL, LITELLM_API_KEY, LITELLM_MODELS_TIMEOUT_MS
//
// Models are discovered from `GET {baseURL}/models` at startup, and refreshed
// when a credential is connected or switched through /connect.

const PROVIDER_ID = "litellm"
const DEFAULT_BASE_URL = "http://127.0.0.1:4000/v1"
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_LIMIT = { context: 200000, output: 32000 }

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim()
  }
  return undefined
}

function firstNumber(...values) {
  for (const value of values) {
    const number = typeof value === "string" ? Number(value) : value
    if (typeof number === "number" && Number.isFinite(number) && number > 0) return number
  }
  return undefined
}

/** Accepts `https://host`, `https://host/`, or `https://host/v1/`. */
function normalizeBaseURL(value) {
  const url = new URL(firstString(value) ?? DEFAULT_BASE_URL)
  const path = url.pathname.replace(/\/+$/, "")
  url.pathname = path.endsWith("/v1") ? path : `${path}/v1`
  return url.toString().replace(/\/$/, "")
}

async function discoverModels({ baseURL, apiKey, timeoutMs }) {
  const headers = { accept: "application/json" }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`

  const response = await fetch(`${baseURL}/models`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`GET ${baseURL}/models returned HTTP ${response.status}`)

  const payload = await response.json()
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : []

  return entries
    .map((entry) => (typeof entry === "string" ? { id: entry } : entry))
    .filter((entry) => entry && typeof entry.id === "string" && entry.id.trim() !== "")
}

/** Plain object, shaped like OpenCode's model schema. */
function toModelInfo(entry) {
  const id = entry.id.trim()
  const context = firstNumber(entry.max_input_tokens, entry.context_window, entry.max_context_tokens)
  const output = firstNumber(entry.max_output_tokens, entry.max_tokens)

  return {
    id,
    modelID: id,
    providerID: PROVIDER_ID,
    name: id,
    capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
    variants: [],
    time: { released: 0 },
    cost: [],
    status: "active",
    enabled: true,
    limit: {
      context: context ?? DEFAULT_LIMIT.context,
      output: output ?? DEFAULT_LIMIT.output,
    },
  }
}

async function readStoredKey(ctx) {
  try {
    const connection = await ctx.integration.connection.active(PROVIDER_ID)
    if (!connection) return undefined
    const credential = await ctx.integration.connection.resolve(connection)
    if (!credential) return undefined
    if (typeof credential.key === "string" && credential.key !== "") return credential.key
    if (typeof credential.value?.key === "string" && credential.value.key !== "") {
      return credential.value.key
    }
  } catch {
    // Treat an unreadable connection as "no stored key".
  }
  return undefined
}

/**
 * A plugin definition is just `{ id, setup }`. OpenCode's schema rejects
 * anything else, and accepts a plain object — no helper import required.
 */
export default {
  id: PROVIDER_ID,
  async setup(ctx) {
    const baseURL = normalizeBaseURL(ctx.options?.baseURL ?? process.env.LITELLM_BASE_URL)
    const configuredKey = firstString(ctx.options?.apiKey, process.env.LITELLM_API_KEY)
    const timeoutMs =
      firstNumber(ctx.options?.timeoutMs, process.env.LITELLM_MODELS_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS

    // Make LiteLLM connectable from /connect, like a catalog provider.
    await ctx.integration.transform((editor) => {
      editor.update(PROVIDER_ID, (integration) => {
        integration.name = "LiteLLM"
      })
      editor.method.update({
        integrationID: PROVIDER_ID,
        method: { id: "api-key", type: "key", label: "API key" },
      })
      editor.method.update({
        integrationID: PROVIDER_ID,
        method: { type: "env", names: ["LITELLM_API_KEY"] },
      })
    })

    // Store a key supplied through config/env once, so the provider is usable
    // without going through /connect. Never duplicate an existing connection.
    if (configuredKey) {
      const existing = await ctx.integration.connection.active(PROVIDER_ID).catch(() => undefined)
      if (!existing) {
        try {
          await ctx.integration.connect.key({ integrationID: PROVIDER_ID, key: configuredKey })
        } catch (error) {
          console.warn(`[litellm] could not store API key: ${error.message}`)
        }
      }
    }

    const state = {
      apiKey: configuredKey ?? (await readStoredKey(ctx)) ?? "",
      models: [],
    }

    try {
      state.models = await discoverModels({ baseURL, apiKey: state.apiKey, timeoutMs })
    } catch (error) {
      // Never block OpenCode startup when LiteLLM is down or unreachable.
      console.warn(`[litellm] model discovery failed for ${baseURL}: ${error.message}`)
    }

    await ctx.provider.transform((editor) => {
      editor.add({
        info: {
          id: PROVIDER_ID,
          name: "LiteLLM",
          activation: "enabled",
          integrationID: PROVIDER_ID,
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL },
        },
        models: state.models.map(toModelInfo),
      })
    })

    console.log(`[litellm] registered ${state.models.length} model(s) from ${baseURL}`)

    // Refresh models when a credential is connected or switched through
    // /connect. Event-driven, so nothing polls while OpenCode is idle.
    void (async () => {
      try {
        for await (const _event of ctx.event.subscribe({ types: ["credential.updated"] })) {
          const apiKey = await readStoredKey(ctx)
          if (!apiKey || apiKey === state.apiKey) continue
          try {
            const next = await discoverModels({ baseURL, apiKey, timeoutMs })
            const before = state.models.map((entry) => entry.id).join("\n")
            const after = next.map((entry) => entry.id).join("\n")
            state.apiKey = apiKey
            if (before === after) continue
            state.models = next
            await ctx.provider.reload()
            console.log(`[litellm] refreshed ${next.length} model(s) from ${baseURL}`)
          } catch (error) {
            console.warn(`[litellm] refresh failed: ${error.message}`)
          }
        }
      } catch (error) {
        console.warn(`[litellm] credential watcher stopped: ${error.message}`)
      }
    })()
  },
}
