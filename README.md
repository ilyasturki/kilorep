# kilorep

A workout log and body weight tracker. I wrote it to replace the Google Sheet I used to fill in between sets.

The phone app is the product, and it works offline: a whole session runs with no connection and no account. A server is optional. It syncs your phone with other devices, serves the same app on the web, and exposes your training to an agent over MCP. You can use mine at [kilorep.com](https://kilorep.com) or run your own.

The phone app is Android only for now. MIT licensed.

## Install

Download the APK from the [latest release](https://github.com/ilyasturki/kilorep/releases/latest) and open it on the phone. Android asks once to allow installs from your browser or file manager. Later releases install over it and keep your data.

The app starts local. Nothing leaves the phone until you sign in to a server in Settings, under Server.

## kilorep.com

Sign in with Google, on the web or from the app (Settings, Server, "Sign in to kilorep.com"). Your phone then syncs with the web app, and you can connect an MCP client.

## Self-host on NixOS

The flake exposes a package and a NixOS module, for `x86_64-linux`.

```nix
# flake.nix
{
  inputs.kilorep.url = "github:ilyasturki/kilorep";

  outputs = { nixpkgs, kilorep, ... }: {
    nixosConfigurations.server = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [ kilorep.nixosModules.default ./configuration.nix ];
    };
  };
}
```

```nix
# configuration.nix
services.kilorep.enable = true;
```

That runs the server on `127.0.0.1:3000`, as a systemd service with its SQLite database in `/var/lib/kilorep`. Migrations run at boot.

Create your account on the machine. It prompts for the password:

```sh
sudo kilorep-account create you@example.com
```

`kilorep-account` also has `list`, `password <email>` and `delete <email>`.

### Reverse proxy

The service expects one proxy in front of it for TLS (`trustedProxyHops = 1`, the default). With Caddy:

```nix
services.caddy = {
  enable = true;
  virtualHosts."kilorep.example.com".extraConfig = ''
    reverse_proxy 127.0.0.1:3000
  '';
};
```

Then in the app: Settings, Server, "Use my own server", and enter `https://kilorep.example.com`.

If nothing proxies the server and you reach it directly, set `host = "0.0.0.0"`, `trustedProxyHops = 0`, and `origin` to the address you type in the browser (`http://192.168.1.50:3000`). Over plain http it is required. Without it, the session cookie is marked `Secure` and sign-in silently does nothing.

### Google sign-in

Optional. Without it, accounts sign in with the password set by `kilorep-account`.

1. In the Google Cloud console, create an OAuth client of type "Web application".
2. Add `https://kilorep.example.com/api/auth/google/callback` as an Authorized redirect URI, exactly.
3. While the consent screen's publishing status is "Testing", add your address as a test user.
4. Put the client secret in a file outside the Nix store:

   ```sh
   # /run/secrets/kilorep.env
   GOOGLE_CLIENT_SECRET=...
   ```

5. Configure the service:

   ```nix
   services.kilorep = {
     enable = true;
     googleClientId = "000000000000-xxxx.apps.googleusercontent.com";
     environmentFile = "/run/secrets/kilorep.env";
   };
   ```

A Google identity whose verified address matches an existing account links to it. An unknown one is refused unless `allowRegistration = true`, which only an instance serving more than one person needs.

Every option is documented in [`nix/module.nix`](nix/module.nix).

## Run without Nix

Building needs [bun](https://bun.sh). Running needs Node 24, for `node:sqlite`.

```sh
bun install
bun run build:server
cp .env.example .env    # DATABASE_PATH, and ORIGIN if served over http
bun run account:create you@example.com
bun run start           # http://localhost:3000
```

Run it from the repository root, where it finds `.env` and the `drizzle/` migrations. `.env.example` lists every variable, Google sign-in included.

## MCP

The server speaks MCP over Streamable HTTP at `/api/mcp`. An agent can read your workouts, plans, exercises, progress and body weight, and log or edit them.

Create a token in Settings, under API tokens. It is shown once. Then point the client at the endpoint with the token as a bearer:

```json
{
	"mcpServers": {
		"kilorep": {
			"type": "http",
			"url": "https://kilorep.com/api/mcp",
			"headers": { "Authorization": "Bearer kr_..." }
		}
	}
}
```

Or, for Claude Code:

```sh
claude mcp add --transport http kilorep https://kilorep.com/api/mcp \
  --header "Authorization: Bearer kr_..."
```

Use your own server's address if you self-host. There is no REST API; apart from sign-in, the server only answers MCP and sync.

## Development

```sh
bun install
bun run db:seed    # dev@kilorep.local / devdevdev, with eight weeks of training
bun run dev        # http://localhost:5173
```

The checks CI runs:

```sh
bun run format
bun run lint
bun run check
bun run test
bun run build:app
```

[docs/TESTING.md](docs/TESTING.md) covers the seeded account, Google sign-in in development and testing in a browser. The other files in `docs/` say how the app behaves, how it looks and what it leaves out.

## Android

The app is the static build (`bun run build:app`) wrapped by Capacitor. With the Android SDK and a phone over adb:

```sh
bun run app:install
```

That installs a debug build as `io.github.ilyasturki.kilorep.dev`, beside the release one.

Release builds are signed in CI. Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which builds the APK, signs it and attaches it to a GitHub release. It needs four repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.

To sign locally, set the same values as `KILOREP_KEYSTORE` (a path to the keystore), `KILOREP_KEYSTORE_PASSWORD`, `KILOREP_KEY_ALIAS` and `KILOREP_KEY_PASSWORD`, then:

```sh
bun run app:sync
cd android && ./gradlew assembleRelease
```

Without them, `assembleRelease` produces an unsigned APK, on purpose. Android only updates an app with an APK signed by the same key, so the keystore must never be lost or replaced.

## License

[MIT](LICENSE)
