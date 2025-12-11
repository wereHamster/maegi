let
  pkgs = import <nixpkgs> {};

  nodejs = pkgs.nodejs-18_x;

in pkgs.mkShell {
  buildInputs = [
    nodejs
    pkgs.nodePackages.pnpm
  ];
}
