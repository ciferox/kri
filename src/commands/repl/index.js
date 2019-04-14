import impl from "adone/lib/commands/repl/impl";

const {
    cli: { chalk }
} = adone;

export default impl({
    banner: `${chalk.bold.hex("689f63")("Node.JS")} ${process.version}, ${chalk.bold.hex("ab47bc")("ADONE")} v${adone.package.version}, ${chalk.bold.hex("ffeb3b")("KRI")} v${kri.package.version}`
});
