self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.kilorep;
in
{
  options.services.kilorep = {
    enable = lib.mkEnableOption "Kilorep workout & weight tracker";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "kilorep.packages.\${system}.default";
      description = "The Kilorep server package to run.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = ''
        Address the server binds to. The app has no authentication, so the
        default keeps it on loopback — put it behind your own reverse proxy or
        a VPN. Set to "0.0.0.0" only if you know it is otherwise protected.
      '';
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port the server listens on.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/kilorep.env";
      description = ''
        Optional EnvironmentFile for the service — use it to override settings
        such as DB_FILE_NAME or to inject future secrets without putting them
        in the Nix store.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.kilorep = {
      description = "Kilorep workout & weight tracker";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        HOST = cfg.host;
        PORT = toString cfg.port;
        NODE_ENV = "production";
        # StateDirectory below provisions /var/lib/kilorep for the dynamic user.
        DB_FILE_NAME = "/var/lib/kilorep/workout.db";
        DB_MIGRATIONS_DIR = "${cfg.package}/share/kilorep/migrations";
      };

      serviceConfig = {
        ExecStart = lib.getExe cfg.package;
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;

        DynamicUser = true;
        StateDirectory = "kilorep";
        WorkingDirectory = "/var/lib/kilorep";

        Restart = "on-failure";
        RestartSec = 5;

        # Hardening. MemoryDenyWriteExecute is intentionally omitted — the V8
        # JIT needs W+X memory and the service fails to start with it on.
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectClock = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        ProtectProc = "invisible";
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        CapabilityBoundingSet = "";
        AmbientCapabilities = "";
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
          "~@resources"
        ];
        UMask = "0077";
      };
    };
  };
}
