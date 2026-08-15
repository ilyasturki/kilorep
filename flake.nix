{
  description = "Kilorep — workout logging and body weight, packaged as a NixOS service";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs, ... }:
    let
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
