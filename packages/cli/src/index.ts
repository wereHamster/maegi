import { main } from "@maegi/core";
import { program } from "commander";

program.arguments("<config>").option("-v, --verbose", "Verbose output").action(main);

program.parse(process.argv);
