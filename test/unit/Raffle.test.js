const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          const chainId = network.config.chainId;
          let raffle;
          let vrfCoordinatorV2Mock;
          let raffleEntranceFee;
          let deployer;
          let interval;

          // Deploy before each test
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              raffleEntranceFee = networkConfig[chainId]["entranceFee"];
              interval = await raffle.getInterval();
          });

          describe("constructor", () => {
              it("Sets entranceFee value correctly", async () => {
                  const entranceFee = await raffle.getEntranceFee();
                  assert.equal(
                      entranceFee.toString(),
                      networkConfig[chainId]["entranceFee"]
                  );
              });

              it("Sets raffle state correctly", async () => {
                  const state = await raffle.getRaffleState();
                  assert.equal(state.toString(), "0");
              });

              it("Sets interval correctly", async () => {
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId]["interval"]
                  );
              });
          });

          describe("enterRaffle", () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(
                      raffle.enterRaffle()
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered"
                  );
              });

              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });

              it("emits event on enter", async () => {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.emit(raffle, "RaffleEnter");
              });

              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // Network method used to manipulate time in the hardhat blockchain
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  // To mine an extra block
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  // Pretend to be a Chainlink Keeper
                  await raffle.performUpkeep([]);

                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
              });
          });
      });
