const kh = require('kuberhealthy');

let fail = false;
failEnv = process.env["FAILURE"];
if (failEnv == 'true') {
    fail = true;
}

const reportSuccess = async () => {
    try {
      await kh.ReportSuccess()
    } catch (e) {
      console.error(e)
      process.exit(1)
    }
    process.exit(0)
}

const reportFailure = async () => {
    try {
      await kh.ReportFailure(["example failure message"]);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    process.exit(0);
}

if (fail) {
    console.log("Reporting failure.");
    reportFailure(["example failure message"]);
}

console.log("Reporting success.");
reportSuccess();