const { execSync } = require("child_process");
console.log("Fixing EAS build directory permissions...");
execSync("sudo chmod -R 777 /Users/expo/workingdir/build", { stdio: "inherit" });
