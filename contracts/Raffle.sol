// Raffle
// Enter the lottary (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automate
// ChainLink Oracle -> Randomness, Automated Execution (ChainLink Keepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

error Raffle__NotEnoughMoney();

contract Raffle {
    /* State variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /* Events */
    event RaffleEnter(address indexed player);

    // Set entrance minimum amount once deployed
    constructor(uint256 entranceFee) {
        i_entranceFee = entranceFee;
    }

    // Enter the lottary paying some amount
    function enter() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughMoney();
        }
        // Add player to players list
        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        // Named events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    // Pick a random winner

    // View functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
