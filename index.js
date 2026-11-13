import { Model, Plugin, Provider } from "@opencode/plugin"

// OpenCode V2 port of @finger_xie/opencode-plugin-litellm.
// Exposes LiteLLM as an OpenAI-compatible provider and discovers models
// from `GET {baseURL}/models`.

const PROVIDER_ID = "litellm"
const DEFAULT_BASE_URL = "http://127.0.0.1:4000/v1"
const DEFAULT_TIMEOUT_MS = 5000

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

function toModelInfo(providerID, entry) {
  const model = Model.Info.default(providerID, Model.ID.make(entry.id))

  const context = firstNumber(entry.max_input_tokens, entry.context_window, entry.max_context_tokens)
  const output = firstNumber(entry.max_output_tokens, entry.max_tokens)
  if (context !== undefined || output !== undefined) {
    model.limit = {
      ...model.limit,
      ...(context !== undefined ? { context } : {}),
      ...(output !== undefined ? { output } : {}),
    }
  }

  return model
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
    // Ignore: treat an unreadable connection as "no stored key".
  }
  return undefined
}

export default Plugin.define({
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
      console.warn(`[litellm] model discovery failed for ${baseURL}: ${error.message}`)
    }

    const providerID = Provider.ID.make(PROVIDER_ID)

    await ctx.provider.transform((editor) => {
      editor.add({
        info: {
          ...Provider.Info.empty(providerID),
          name: "LiteLLM",
          activation: "enabled",
          integrationID: PROVIDER_ID,
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL },
        },
        models: state.models.map((entry) => toModelInfo(providerID, entry)),
      })
    })

    console.log(`[litellm] registered ${state.models.length} model(s) from ${baseURL}`)

    // Refresh models when a user connects a credential through /connect.
    // This avoids polling; models are re-fetched only when the integration state changes.
    await ctx.event.on("integration.credential.created", async (event) => {
      if (event.data?.integrationID !== PROVIDER_ID) return
      try {
        const next = await discoverModels({ baseURL, apiKey: event.data?.key || "", timeoutMs })
        const before = state.models.map((entry) => entry.id).join("\n")
        const after = next.map((entry) => entry.id).join("\n")
        if (before === after) return
        state.models = next
        await ctx.provider.reload()
        console.log(`[litellm] refreshed ${next.length} model(s) from ${baseURL}`)
      } catch (error) {
        console.warn(`[litellm] refresh failed: ${error.message}`)
      }
    })
  },
})
