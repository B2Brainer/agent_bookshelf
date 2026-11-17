// Coverage gate run after the test suite.
const coverage = 72;
const threshold = 80;
console.error(`Coverage threshold not met: ${coverage}% < ${threshold}% required`);
process.exit(1);
