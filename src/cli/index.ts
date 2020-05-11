import program from "commander";
import { main } from "./main";

program
  .option("-v, --verbose", "Verbose output")
  .option("-c, --config <path>", "Use this config file")
  .action(main);

program.parse(process.argv);
