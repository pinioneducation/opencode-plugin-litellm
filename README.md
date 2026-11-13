# opencode-plugin-litellm

OpenCode **V2** plugin that adds [LiteLLM](https://github.com/BerriAI/litellm) as a provider. It uses OpenCode's built-in OpenAI-compatible runtime and discovers models automatically from `GET {baseURL}/models`.

**Zero dependencies.** It needs no Node.js install, no `npm install`, and has no `node_modules` folder. The plugin runs inside OpenCode's own runtime, so all you copy is two plain files.

This is a V2 port of [`@finger_xie/opencode-plugin-litellm`](https://github.com/yuyu1025/opencode-plugin-litellm). That package targets the V1 plugin API and fails to load on OpenCode 2.x.

## Features

- Registers a `litellm` provider (`@opencode/ai/providers/openai-compatible`).
- Discovers models from LiteLLM's `/v1/models` at startup, and refreshes them when a credential is connected through `/connect`.
- Adds a **LiteLLM** entry to `/connect`, with an API key method and a `LITELLM_API_KEY` env method.
- Reads context and output token limits from LiteLLM when available.
- Never blocks OpenCode startup when LiteLLM is unreachable or the key is missing.
- No polling: model refresh is event-driven, so idle OpenCode makes no requests.

## Requirements

- OpenCode 2.2.x or newer.

That's it. No Node.js, no npm, no Git.

## Install

1. Create the folder `~/.config/opencode/litellm-plugin`
   (on Windows: `C:\Users\<you>\.config\opencode\litellm-plugin`).

2. Put two files in it: [`index.js`](./index.js) and [`package.json`](./package.json).

   Using a terminal:

   ```sh
   mkdir -p ~/.config/opencode/litellm-plugin
   cd ~/.config/opencode/litellm-plugin
   curl -LO https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/index.js
   curl -LO https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/package.json
   ```

   On Windows PowerShell:

   ```powershell
   $d = "$env:USERPROFILE\.config\opencode\litellm-plugin"
   New-Item -ItemType Directory -Force -Path $d | Out-Null
   Invoke-WebRequest "https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/index.js" -OutFile "$d\index.js"
   Invoke-WebRequest "https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/package.json" -OutFile "$d\package.json"
   ```

   Or download the repository as a ZIP from GitHub and copy the two files.

3. Point OpenCode at the folder in `opencode.jsonc`:

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": [
       {
         "package": "./litellm-plugin",
         "options": {
           "baseURL": "https://your-litellm-host"
         }
       }
     ]
   }
   ```

   Relative paths resolve from the config file, so `./litellm-plugin` means the folder next to it.

4. Restart OpenCode.

> **Using a single file instead?** OpenCode also auto-loads `.js` files placed directly in `~/.config/opencode/plugins/`, with no config entry at all. In that case the base URL comes from the `LITELLM_BASE_URL` environment variable, because a config entry cannot point at a bare file.

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
- **Models not updating after LiteLLM changes.** Models refresh when a credential is connected or switched. Reconnect your key through `/connect` to force a refresh.
- **Default limits.** If LiteLLM doesn't report token limits, models use OpenCode's defaults: 200k context and 32k output.

## Updating

Re-download the two files over the old ones and restart OpenCode. There is nothing to install or build.

## License

MIT. See [LICENSE](./LICENSE).
