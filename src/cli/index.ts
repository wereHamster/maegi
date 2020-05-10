import program from "commander";
import { main } from "./main";

program
  .arguments("<source>")
  .option("-v, --verbose", "Verbose output")
  .option("--icons <dir>", "output directory for icons (default: src/icons)")
  .option("--images <dir>", "output directory for images (default: assets)")
  .action(main);

program.parse(process.argv);
