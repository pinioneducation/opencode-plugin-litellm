# opencode-plugin-litellm

OpenCode **V2** plugin that adds [LiteLLM](https://github.com/BerriAI/litellm) as a provider. It uses OpenCode's built-in OpenAI-compatible runtime and discovers models automatically from `GET {baseURL}/models`.

This is a V2 port of [`@finger_xie/opencode-plugin-litellm`](https://github.com/yuyu1025/opencode-plugin-litellm). That package targets the V1 plugin API and fails to load on OpenCode 2.x.

## Features

- Registers a `litellm` provider (`@opencode/ai/providers/openai-compatible`).
- Discovers models from LiteLLM's `/v1/models` at startup and when a credential is connected via `/connect`.
- Adds a **LiteLLM** entry to `/connect`, with an API key method and a `LITELLM_API_KEY` env method.
- Reads context and output token limits from LiteLLM when available.
- Never blocks OpenCode startup when LiteLLM is unreachable or the key is missing.

## Requirements

- OpenCode 2.2.x
- Node.js 22 or newer

## Install

Clone the repository and install dependencies:

```sh
git clone <your-repo-url> opencode-plugin-litellm
cd opencode-plugin-litellm
npm install
```

Point OpenCode at the directory in `opencode.jsonc`. Relative paths resolve from the config file.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugin-src/litellm",
      "options": {
        "baseURL": "https://your-litellm-host"
      }
    }
  ]
}
```

## Options

| Option      | Env variable                | Default                    | Notes                                                  |
| ----------- | --------------------------- | -------------------------- | ------------------------------------------------------ |
| `baseURL`   | `LITELLM_BASE_URL`          | `http://127.0.0.1:4000/v1` | `/v1` is appended when missing.                        |
| `apiKey`    | `LITELLM_API_KEY`           | none                       | Stored once as a credential. Prefer `/connect` instead. |
| `timeoutMs` | `LITELLM_MODELS_TIMEOUT_MS` | `5000`                     | Timeout for model discovery.                           |

## Connect

1. Run `/connect`, choose **LiteLLM**, and paste your API key.
2. Run `/models` and pick a `litellm/...` model.

## Troubleshooting

- **Provider is missing even with a valid key.** Check for a Console workspace policy that denies providers, such as `provider.use * → deny`. Add `{ "action": "provider.use", "resource": "litellm", "effect": "allow" }` in the workspace's Policies.
- **No models listed.** Verify your LiteLLM endpoint is reachable: `curl -H "Authorization: Bearer $LITELLM_API_KEY" https://your-litellm-instance/v1/models`. Confirm it returns a model list.
- **Models not updating after LiteLLM changes.** Models refresh only when you connect a new credential via `/connect`. To force a refresh, disconnect and reconnect your key.
- **Default limits.** If LiteLLM doesn't report token limits, models use OpenCode's defaults: 200k context and 32k output.

## License

MIT. See [LICENSE](./LICENSE).
