const { execSync, exec } = require("child_process");

const percentMemUsed = () => {
    const memory = execSync("free | grep Mem | awk '{ printf(\"free: %.4f %\n\", $4/$2 * 100.0) }'")
    return memory;
}

module.exports = {percentMemUsed};
