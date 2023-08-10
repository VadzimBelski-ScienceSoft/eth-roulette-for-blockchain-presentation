// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Roulette {
    uint256 betAmount;
    uint256 nextRoundTimestamp;
    address creator;
    mapping(address => uint256) winnings;
    uint8[] payouts;
    uint8[] numberRange;
    Winner[] public winners;

    struct Bet {
        address player;
        uint8 number;
    }

    struct Winner {
        address player;
        uint256 timestamp;
        uint256 amount;
    }

    Bet[] public bets;

    constructor() payable {
        creator = msg.sender;
        nextRoundTimestamp = block.timestamp;
        betAmount = 10000000000000000; /* 0.01 ether */
    }

    event RandomNumber(uint256 number);

    event MadeBet(address indexed _from, uint256 _value);

    event Won(
        address player,
        uint256 indexed date,
        uint256 indexed amount
    );

    function getStatus()
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            Bet[] memory
        )
    {        

        Bet[] memory b = new Bet[](bets.length);
        for (uint i = 0; i < bets.length; i++) {
            b[i] = bets[i];
        }

        return (
            bets.length, // number of active bets
            bets.length * betAmount, // value of active bets
            nextRoundTimestamp, // when can we play again
            address(this).balance, // roulette balance
            winnings[msg.sender], // winnings of player
            b
        );
    }

    function getWinners() public view returns (Winner[] memory) {
        Winner[] memory w = new Winner[](winners.length);

        for (uint i = 0; i < winners.length; i++) {
            w[i] = winners[i];
        }

        return w;
    }

    function bet(uint8 number) public payable {
        require(msg.value == betAmount);
        require(number >= 0);

        bets.push(Bet({player: msg.sender, number: number}));

        emit MadeBet(msg.sender, number);
    }

    function spinWheel() public {
        /* are there any bets? */
        require(bets.length > 0);
        /* are we allowed to spin the wheel? */
        require(block.timestamp > nextRoundTimestamp);
        /* next time we are allowed to spin the wheel again */
        nextRoundTimestamp = block.timestamp;
        /* calculate 'random' number */
        bytes32 hash = blockhash(block.number - 1);
        Bet memory lb = bets[bets.length - 1];

        uint256 number = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    hash,
                    lb.player,
                    lb.number
                )
            )
        ) % 37;

        for (uint256 i = 0; i < bets.length; i++) {
            bool won = false;
            Bet memory b = bets[i];

            if (b.number == number) {
                won = true;
            }

            if (won) {
                winners.push(Winner({player: b.player, timestamp : block.timestamp, amount: address(this).balance}));

                winnings[b.player] += address(this).balance;
                payable(b.player).transfer(address(this).balance);

                emit Won(b.player, block.timestamp, address(this).balance);
            }
        }

        /* delete all bets */
        delete bets;

        emit RandomNumber(number);
    }
}
