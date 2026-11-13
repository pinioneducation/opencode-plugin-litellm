# Installation Steps for opencode-plugin-litellm

## Prerequisites

- OpenCode 2.2.x (or newer)
- Node.js 22 or newer
- Git
- A running LiteLLM instance with API access

## Step 1: Clone the plugin repository

Choose a location where you want to keep the plugin. A common place is inside your OpenCode config directory or a shared plugins folder.

```sh
git clone https://github.com/pinioneducation/opencode-plugin-litellm.git
cd opencode-plugin-litellm
npm install
```

## Step 2: Update your `opencode.jsonc` config

Open or create `~/.config/opencode/opencode.jsonc` (or `%APPDATA%\opencode\opencode.jsonc` on Windows) and add the plugin with your LiteLLM base URL:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/path/to/opencode-plugin-litellm",
      // or use relative path from config location:
      // "package": "../plugins/opencode-plugin-litellm",
      // or from npm registry once published:
      // "package": "@pinioneducation/opencode-plugin-litellm",
      
      "options": {
        "baseURL": "https://your-litellm-instance.example.com"
      }
    }
  ]
}
```

**On Windows:**
```jsonc
"package": "C:\\Users\\<user>\\path\\to\\opencode-plugin-litellm"
```

**On macOS/Linux:**
```jsonc
"package": "/Users/<user>/path/to/opencode-plugin-litellm"
```

## Step 3: Restart OpenCode

Close the OpenCode desktop app completely and reopen it, or in the terminal:

```sh
opencode service restart
# then
opencode
```

Wait ~10 seconds for the plugin to load. Check the logs:

```sh
opencode api get /api/plugin | grep litellm
```

You should see:
```json
{
  "id": "litellm",
  "state": { "status": "active" }
}
```

## Step 4: Connect your LiteLLM API key

```sh
opencode /connect
```

Select **LiteLLM** → **API key** → paste your key.

## Step 5: Verify models are available

```sh
opencode /models
```

You should see the models listed under the `litellm` provider.

## Step 6: (Optional) Check workspace policy

If the provider doesn't appear in OpenCode even with a valid key, check your Console workspace policy. The workspace must allow `litellm`:

**Console** → **Policies** → **Providers** section → add:
```
litellm  allow
```

Or allow all:
```
*  allow
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin not loading | Check `opencode service logs` for errors. Ensure the path in `package` is correct. |
| "Provider not found: litellm" | The plugin loaded but the workspace policy is denying it. Add `litellm` to the **Providers** allow list in Console. |
| No models listed | Verify the API key is connected (`/connect`). Run `curl -H "Authorization: Bearer $KEY" https://your-litellm-instance/v1/models` to confirm the endpoint works. |
| Models not updating | Models refresh only when you connect a new credential via `/connect`. To force a refresh, disconnect and reconnect your key. |

## Environment variables (alternative to config)

Instead of putting the URL in `opencode.jsonc`, you can use env vars:

```sh
export LITELLM_BASE_URL=https://your-litellm-instance.example.com
export LITELLM_API_KEY=your-api-key
```

Then in `opencode.jsonc`:
```jsonc
"plugins": [
  {
    "package": "/path/to/opencode-plugin-litellm"
    // baseURL and apiKey will be read from env vars
  }
]
```

## Next steps

1. Use `/models` to select a LiteLLM model in a session.
2. Start a conversation — the plugin uses OpenCode's built-in OpenAI-compatible runtime, so all standard model operations work.
