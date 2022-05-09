const { execSync, exec } = require("child_process");

const percentMemUsed = () => {
    const memory = execSync("free | grep Mem | awk '{print $3/$2 * 100.0}'")
    return memory.toString().replace(/\n$/g, "");
}

module.exports = {percentMemUsed};
