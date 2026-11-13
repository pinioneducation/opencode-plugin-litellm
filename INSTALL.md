# Installation

## Prerequisites

- OpenCode 2.2.x or newer.
- A running LiteLLM instance with API access.

No other software is required. The plugin has no dependencies, so you do not need Node.js, npm, or Git.

## Step 1 — Create the plugin folder

```sh
mkdir -p ~/.config/opencode/litellm-plugin
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.config\opencode\litellm-plugin" | Out-Null
```

## Step 2 — Copy the two files

Download [`index.js`](./index.js) and [`package.json`](./package.json) into that folder.

Using a terminal, macOS:

```sh
cd ~/.config/opencode/litellm-plugin
curl -LO https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/index.js
curl -LO https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/package.json
```

Windows PowerShell:

```powershell
$d = "$env:USERPROFILE\.config\opencode\litellm-plugin"
Invoke-WebRequest "https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/index.js" -OutFile "$d\index.js"
Invoke-WebRequest "https://raw.githubusercontent.com/pinioneducation/opencode-plugin-litellm/main/package.json" -OutFile "$d\package.json"
```

The folder should now contain exactly two files, with no `node_modules`.

## Step 3 — Configure OpenCode

Edit `~/.config/opencode/opencode.jsonc` (Windows: `C:\Users\<you>\.config\opencode\opencode.jsonc`):

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

If the file already has settings, add the `"plugins"` array alongside them instead of replacing the file.

## Step 4 — Restart OpenCode

Quit completely and reopen. Check that the plugin loaded:

```sh
opencode api get /api/plugin | grep litellm
```

Expected:

```json
{
  "id": "litellm",
  "state": { "status": "active" }
}
```

If you see `"status": "failed"`, the `error` field names the cause.

## Step 5 — Connect the API key

Run `/connect` in OpenCode, choose **LiteLLM**, then **API key**, and paste your key.

## Step 6 — Pick a model

Run `/models` and choose a model under **LiteLLM**.

## Step 7 — Check workspace policy (only if the provider is hidden)

If LiteLLM is connectable but never appears in the model list, check the Console workspace policy:

Console → **Policies** → **Providers**:

```
litellm  allow
```

A blanket `provider.use * → deny` hides every provider that is not explicitly allowed, even with valid credentials.

## Alternative — single file, no config entry

OpenCode auto-loads `.js` files from `~/.config/opencode/plugins/`. Copy `index.js` there, rename it if you like, and set the URL through the environment:

```sh
export LITELLM_BASE_URL=https://your-litellm-host
```

This works without touching `opencode.jsonc`, but the environment variable must be visible to the process that starts OpenCode.

## Updating

Re-download both files over the existing ones and restart OpenCode. There is no install step.

## Troubleshooting

| Issue | Solution |
| --- | --- |
| Plugin not in `/api/plugin` | Confirm the folder contains `index.js` and `package.json`, and that the config path resolves next to `opencode.jsonc`. Restart OpenCode fully. |
| `"status": "failed"` | Read the `error` field. A syntax error or a missing file is the usual cause. |
| Provider missing but plugin active | Console policy is denying it. Allow `litellm`. |
| No models | The key is missing, wrong, or expired. Reconnect through `/connect`, or test with curl. |
