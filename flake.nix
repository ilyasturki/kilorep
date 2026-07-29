{
  description = "Kilorep — workout logging and body weight, packaged as a NixOS service";

  # Tracks what infra-apps tracks, so a local `nix build` builds what the server
  # gets. The deploy resolves this against infra's own nixpkgs anyway
  # (`inputs.nixpkgs.follows`), which is precisely why the two must not drift.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs, ... }:
    let
      # x86_64-linux alone: it is the VPS, it is the laptop, and `deps` below is
      # a fixed-output derivation whose hash covers only the packages bun installs
      # for the host platform — a second system would need a second hash.
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in
    {
      packages.x86_64-linux = rec {
        kilorep = pkgs.callPackage ./nix/package.nix { };
        default = kilorep;
      };

      nixosModules = rec {
        kilorep = import ./nix/module.nix { inherit self; };
        default = kilorep;
      };
    };
}
