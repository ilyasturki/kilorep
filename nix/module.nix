{ self }:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.kilorep;

  # The service's identity, in one place: the unit and the account CLI below must
  # name the same user and the same StateDirectory or the CLI opens a different
  # database than the server writes.
  serviceUser = "kilorep";
  stateDirectory = "kilorep";
  stateDir = "/var/lib/${stateDirectory}";

  # Loopback in the spellings `host` accepts. Binding to one of these is the only
  # signal available that something is proxying the instance.
  loopbackHosts = [
    "127.0.0.1"
    "::1"
    "[::1]"
    "localhost"
  ];

  # `kilorep-account` cannot simply be run from a shell: DynamicUser means the
  # state directory belongs to a uid systemd allocates, and a root-run CLI would
  # leave the database and its WAL sidecars owned by root for a service that
  # cannot write them. Naming the same User= gets the same dynamic uid back, and
  # StateDirectory= puts /var/lib/kilorep in front of it with the right owner.
  #
  # Root only — a system transient unit is not something an unprivileged user
  # can start.
  accountTool = pkgs.writeShellScriptBin "kilorep-account" ''
    exec ${config.systemd.package}/bin/systemd-run \
      --quiet --collect --pty --pipe \
      --property=DynamicUser=yes \
      --property=User=${serviceUser} \
      --property=StateDirectory=${stateDirectory} \
      --property=WorkingDirectory=${stateDir} \
      --setenv=DATABASE_PATH=${cfg.databasePath} \
      ${lib.getExe' cfg.package "kilorep-account"} "$@"
  '';
in
{
  options.services.kilorep = {
    enable = lib.mkEnableOption "the Kilorep workout tracker";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.kilorep;
      defaultText = lib.literalExpression "kilorep.packages.\${system}.kilorep";
      description = "The Kilorep package to run.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = ''
        Address the server binds to. Keep loopback when fronted by a reverse
        proxy; see `trustedProxyHops`, which assumes one is there.
      '';
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "TCP port the server listens on.";
    };

    databasePath = lib.mkOption {
      type = lib.types.str;
      default = "${stateDir}/kilorep.db";
      description = ''
        Filesystem path to the SQLite database. The directory is created on
        first run and the schema is migrated at boot.

        Keep it inside ${stateDir}: that is the service's StateDirectory,
        and it is the only place the DynamicUser can write. Pointing this
        elsewhere means arranging ownership yourself, for the WAL and
        shared-memory sidecars as well as the file itself.
      '';
    };

    allowRegistration = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Whether a Google identity nobody has seen before becomes a new account.
        While this is off, an unknown one is refused.

        An instance serving one person never needs this: `kilorep-account
        create` makes the first account on the machine, without exposing
        anything. Turn it on only for an instance that genuinely serves more
        than one person.

        It does not gate linking. A Google identity whose verified address
        already belongs to an account attaches to it either way, which is how
        you put your own `kilorep-account create` account behind Google without
        opening the instance to strangers.
      '';
    };

    googleClientId = lib.mkOption {
      type = lib.types.str;
      default = "";
      example = "000000000000-xxxx.apps.googleusercontent.com";
      description = ''
        OAuth client id for Google sign-in. Empty on both this and the secret is
        the ordinary case: the sign-in screen offers no Google button, and
        accounts made with `kilorep-account create` sign in with their password.

        The client's Authorized redirect URI must be exactly
        `<your origin>/api/auth/google/callback`. A mismatch fails on Google's
        own page as `redirect_uri_mismatch`, before this server is involved —
        and behind a proxy it is `trustedProxyHops` above that stops the server
        deriving `http://` and asking for the wrong one.

        A client id is not a secret; the client secret is, which is why it has no
        option here — see `environmentFile`.
      '';
    };

    origin = lib.mkOption {
      type = lib.types.str;
      default = "";
      example = "http://192.168.1.50:3000";
      description = ''
        The origin this instance is reached at. Not optional for anything served
        over plain http.

        adapter-node otherwise derives the origin from the request headers, and
        its default protocol is `https` — it never inspects the socket. An
        instance on http://192.168.1.50:3000 then believes it is https, and two
        things break quietly at once: the session cookie goes out `Secure`,
        which browsers drop over http, so sign-in appears to succeed and does
        nothing; and the Google redirect URI is built as https://…, matching no
        console entry.

        Behind a TLS-terminating proxy, `trustedProxyHops` sets PROTOCOL_HEADER
        and does the same job, so this can stay empty.
      '';
    };

    corsOrigins = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      example = [ "https://kilorep.example.com" ];
      description = ''
        Extra origins allowed to call /api/* from a browser. The Capacitor
        origins are always allowed and the web surface is served by this same
        server, so most instances need none of these.

        Each entry must be a full origin — scheme, host and port. A trailing
        slash is forgiven; anything that is not a URL is dropped with a warning
        in the log rather than silently matching nothing.
      '';
    };

    trustedProxyHops = lib.mkOption {
      type = lib.types.ints.unsigned;
      default = 1;
      description = ''
        How many reverse proxies sit in front of the server. One is right for a
        single Caddy or nginx; zero means the server is reached directly and no
        forwarded header is believed.

        Above zero this sets adapter-node's ADDRESS_HEADER, XFF_DEPTH and
        PROTOCOL_HEADER together, and they are only ever set together: with the
        protocol header missing the server concludes `http` behind a proxy that
        terminated TLS, and the session cookie goes out without `Secure`; with
        the address header missing every request appears to come from the proxy,
        and the login throttle counts the whole instance as one caller, so ten
        wrong passwords lock out every user for fifteen minutes.

        A client can prepend entries to x-forwarded-for, so only the last
        `trustedProxyHops` of them are yours to believe. Leaving this above zero
        on a directly-exposed instance therefore hands the throttle bypass to
        anyone who sends the header.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/kilorep.env";
      description = ''
        systemd EnvironmentFile, and the only correct place for
        GOOGLE_CLIENT_SECRET.

        Everything set through a module option is written to the Nix store,
        which every user on the machine can read — so a secret set there is a
        secret published locally. systemd reads this file at start instead, and
        the store never sees it. Kilorep has no other secret: the account
        passwords are scrypt hashes and the session tokens are random and stored
        hashed, so without Google sign-in this option is only a way to override
        configuration off-store.

        GOOGLE_CLIENT_SECRET=... on a line of its own is the whole of what it
        needs to contain.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    # Believing x-forwarded-for with nothing in front to overwrite it is worse
    # than not reading it at all, and binding off loopback is the only signal
    # available that nothing is.
    warnings =
      lib.optional (cfg.trustedProxyHops > 0 && !lib.elem cfg.host loopbackHosts) ''
        services.kilorep binds ${cfg.host} with trustedProxyHops = ${toString cfg.trustedProxyHops}.
        If nothing proxies this instance, the client address is whatever the caller
        puts in x-forwarded-for, and the login throttle can be bypassed at will.
        Set trustedProxyHops = 0 for a directly-exposed instance.
      ''
      # The half-configured case fails silently otherwise: the server needs both
      # halves before it will offer Google at all, so the login screen just shows
      # no button and nothing anywhere says why.
      ++ lib.optional (cfg.googleClientId != "" && cfg.environmentFile == null) ''
        services.kilorep sets googleClientId but no environmentFile, so
        GOOGLE_CLIENT_SECRET cannot reach the service and Google sign-in stays
        off. Put the secret in an environmentFile — never in a module option,
        which would write it to the world-readable Nix store.
      '';

    environment.systemPackages = [ accountTool ];

    systemd.services.kilorep = {
      description = "Kilorep workout tracker";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        HOST = cfg.host;
        PORT = toString cfg.port;
        NODE_ENV = "production";
        DATABASE_PATH = cfg.databasePath;
        ALLOW_REGISTRATION = lib.boolToString cfg.allowRegistration;
      }
      // lib.optionalAttrs (cfg.origin != "") {
        ORIGIN = cfg.origin;
      }
      // lib.optionalAttrs (cfg.googleClientId != "") {
        GOOGLE_CLIENT_ID = cfg.googleClientId;
      }
      // lib.optionalAttrs (cfg.corsOrigins != [ ]) {
        CORS_ORIGINS = lib.concatStringsSep "," cfg.corsOrigins;
      }
      // lib.optionalAttrs (cfg.trustedProxyHops > 0) {
        ADDRESS_HEADER = "x-forwarded-for";
        XFF_DEPTH = toString cfg.trustedProxyHops;
        PROTOCOL_HEADER = "x-forwarded-proto";
      };

      serviceConfig = {
        ExecStart = lib.getExe cfg.package;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) [ cfg.environmentFile ];

        Restart = "on-failure";
        RestartSec = "5s";

        DynamicUser = true;
        User = serviceUser;
        StateDirectory = stateDirectory;
        StateDirectoryMode = "0750";
        WorkingDirectory = stateDir;

        # Cheap fork-bomb guard. No memory cap: this box is shared and a cap
        # buys a coarse backstop at the price of OOM-killing the app under
        # legitimate load.
        TasksMax = 256;

        # Hardening. Node needs outbound network and the state directory.
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectKernelLogs = true;
        ProtectControlGroups = true;
        ProtectClock = true;
        ProtectHostname = true;
        ProtectProc = "invisible";
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        # V8's JIT needs writable+executable pages; leaving this on crashes Node
        # at startup.
        MemoryDenyWriteExecute = false;
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
          "~@resources"
        ];
        RestrictAddressFamilies = [
          "AF_UNIX"
          "AF_INET"
          "AF_INET6"
        ];
        CapabilityBoundingSet = [ "" ];
        AmbientCapabilities = [ "" ];
        UMask = "0077";
      };
    };
  };
}
