const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
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
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              raffleEntranceFee = networkConfig[chainId]["entranceFee"];
              interval = await raffle.getInterval();
          });

          describe("constructor", () => {
              it("sets entranceFee value correctly", async () => {
                  const entranceFee = await raffle.getEntranceFee();
                  assert.equal(entranceFee.toString(), networkConfig[chainId]["entranceFee"]);
              });

              it("sets raffle state correctly", async () => {
                  const state = await raffle.getRaffleState();
                  assert.equal(state.toString(), "0");
              });

              it("sets interval correctly", async () => {
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
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
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  );
              });

              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // Network method used to manipulate time in the hardhat blockchain
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
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

          describe("checkUpkeep", () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);

                  // Simulate a function call with returns
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  // It should be false --> !false == true
                  assert(!upkeepNeeded);
              });

              it("returns false if raffle isn't open", async () => {
                  /* Change state to 'calculating' */
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep([]);

                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });

              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", () => {
              it("can only run if checkUpkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });

              it("reverts when checkUpkeep is false", async () => {
                  await expect(raffle.performUpkeep([])).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  );
              });

              it("emits and event", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  // This event is emitted by vrfCoordinator contract
                  const requestId = vrfCoordinatorV2Mock.interface.parseLog(txReceipt.events[0])
                      .args.requestId;
                  assert(requestId.toNumber() > 0);
              });

              it("updates the raffle state to 'calculating'", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  await raffle.performUpkeep([]);

                  const raffleState = await raffle.getRaffleState();
                  assert(raffleState.toString() === "1");
              });
          });

          describe("fulfillRandomWords", () => {
              // Want to have at least one player in the Raffle
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
              });

              it("can only be called after performUpkeep", async () => {
                  // Check vrfCoordinatorV2Mock contract
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });

              // Too big, should be splitted ---> LEARNING PURPOSE
              it("picks a winner, resets the lottery, and sends money", async () => {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1; // deployer = 0
                  const accounts = await ethers.getSigners();
                  // Connect and enterRaffle for each account
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }

                  const startingTimeStamp = await raffle.getLatestTimeStamp();
                  /* In a real test net we must wait fulfillRandomWords to finish
                     to call performUpkeep. In local net we simulate this
                     behavior using a listener inside a Promise.
                  */
                  await new Promise(async (resolve, reject) => {
                      // listener for an event
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!");
                          // Catch the error if too much time passes
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const numPlayers = await raffle.getNumOfPlayers();
                              const winnerEndingBalance = await accounts[1].getBalance();

                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  // The winner ending balance must be equal
                                  winnerEndingBalance.toString(),
                                  // to all the money that everybody else entered in this contract
                                  winnerStartingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee)
                                          .toString()
                                  )
                              );

                              // To know who the winner is
                              console.log(recentWinner);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[2].address);
                              console.log(accounts[3].address);
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });

                      // Fire the event
                      const tx = await raffle.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      // From console logs
                      const winnerStartingBalance = await accounts[1].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          vrfCoordinatorV2Mock.interface.parseLog(txReceipt.events[0]).args
                              .requestId,
                          raffle.address
                      );
                  });
              });
          });
      });
