import { program } from "commander";
import { main } from "./main.js";

program.arguments("<config>").option("-v, --verbose", "Verbose output").action(main);

program.parse(process.argv);
