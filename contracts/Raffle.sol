// Raffle
// Enter the lottary (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automate
// ChainLink Oracle -> Randomness, Automated Execution (ChainLink Keepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

error Raffle__NotEnoughMoney();

contract Raffle is VRFConsumerBaseV2 {
    /* State variables */
    address payable[] private s_players;
    uint256 private immutable i_entranceFee;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);

    // Set entrance minimum amount once deployed
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
    }

    // Enter the lottary paying some amount
    function enterRaffle() public payable {
        // Require
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughMoney();
        }
        // Add player to players list
        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        emit RaffleEnter(msg.sender);
    }

    /* Pick a random winner */
    // Request the random number
    function requestRandomWinner() external {
        // Request using the gived coordinator
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // Maximum gas price you are willing to pay for a request in wei
            i_subscriptionId, // subId that this contract uses for funding requests
            REQUEST_CONFIRMATIONS, // Confirmations the Chainlink node should wait
            i_callbackGasLimit, // Sets a limit to avoid spending to much gas
            NUM_WORDS // How many random number we want
        ); // Return a request id

        emit RequestedRaffleWinner(requestId);
    }

    // Once we get it, do something with it
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {}

    /* View / Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
