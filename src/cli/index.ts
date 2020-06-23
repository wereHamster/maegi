import program from "commander";
import { main } from "./main";

program
  .arguments("<config>")
  .option("-v, --verbose", "Verbose output")
  .action(main);

program.parse(process.argv);
