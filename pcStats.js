const { execSync, exec } = require("child_process");

const format = output => output.toString().replace(/\n$/g, "");

const percentMemUsed = () => {
    const memory = execSync("free | grep Mem | awk '{print $3/$2 * 100.0}'")
    return format(memory);
}

const percentCpuUsed = () => {
    const cpu = execSync('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk \'{print 100 - $1}\'');
    return format(cpu);
}

module.exports = { percentMemUsed, percentCpuUsed };
