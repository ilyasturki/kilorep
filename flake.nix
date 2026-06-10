{
  description = "Kilorep — minimalist workout session & weight tracker, packaged as a NixOS service";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    systems.url = "github:nix-systems/default-linux";

    bun2nix.url = "github:nix-community/bun2nix?ref=2.1.0";
    bun2nix.inputs.nixpkgs.follows = "nixpkgs";
    bun2nix.inputs.systems.follows = "systems";
  };

  # bun2nix's CLI is cached here, so generating bun.nix doesn't rebuild it.
  nixConfig = {
    extra-substituters = [ "https://nix-community.cachix.org" ];
    extra-trusted-public-keys = [
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  outputs =
    inputs:
    let
      eachSystem = inputs.nixpkgs.lib.genAttrs (import inputs.systems);

      pkgsFor = eachSystem (
        system:
        import inputs.nixpkgs {
          inherit system;
          overlays = [ inputs.bun2nix.overlays.default ];
        }
      );
    in
    {
      packages = eachSystem (
        system:
        let
          pkgs = pkgsFor.${system};
          kilorep = pkgs.callPackage ./nix/package.nix {
            # Respect .gitignore so node_modules/.nuxt/.output/.data stay out of
            # the build source; bun2nix's hook recreates node_modules itself.
            src = pkgs.nix-gitignore.gitignoreSource [ ] ./.;
          };
        in
        {
          default = kilorep;
          inherit kilorep;
        }
      );

      nixosModules.default = import ./nix/module.nix inputs.self;
    };
}
