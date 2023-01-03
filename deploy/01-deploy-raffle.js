const { network } = require("hardhat");
const {
    developmentChains,
    networkConfig,
} = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorV2Address, subscriptionId;

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        // Create a subId using mock
        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        // Get access to subId through events
        subscriptionId = transactionReceipt.events[0].args.subId;
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId][vrfCoordinatorV2];
    }
    const entranceFee = networkConfig[chainId][entranceFee];
    const gasLane = networkConfig[chainId][gasLane];
    const args = [vrfCoordinatorV2Address, entranceFee, gasLane];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });
};
