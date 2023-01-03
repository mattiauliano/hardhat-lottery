const { run } = require("hardhat");

// Verify on etherscan
const verify = async (contractAddress, args) => {
    console.log("Verifying contract...");
    // Trying to prevent errors from crashing the program
    try {
        // Run command verify option verify
        await run("verify:verify", {
            // On this contract
            address: contractAddress,
            // With this constructor args
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
};

module.exports = { verify };
