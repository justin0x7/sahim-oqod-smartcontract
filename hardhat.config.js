// /**
//  * @type import('hardhat/config').HardhatUserConfig
//  */
// require("@nomiclabs/hardhat-waffle");
// require("@nomiclabs/hardhat-ethers");
// require("@openzeppelin/hardhat-upgrades");
// require("hardhat-contract-sizer");
// require("solidity-coverage");
// require("dotenv").config();
// const { utils } = require("ethers");

// module.exports = {
//     defaultNetwork: "hardhat",
//     networks: {
//         hardhat: {},
//         fuji: {
//             url: "https://api.avax-test.network/ext/bc/C/rpc",
//             chainId: 43113,
//             accounts: [
//                 process.env.DEPLOYER_WALLET,
//                 process.env.DEPLOYER_WALLET_2,
//             ],
//             gasPrice: utils.parseUnits("100", "gwei").toNumber(),
//         },
//     },
//     solidity: {
//         compilers: [
//             {
//                 version: "0.8.17",
//                 settings: {
//                     optimizer: {
//                         enabled: true,
//                         runs: 2000,
//                     },
//                 },
//             },
//         ],
//     },

//     mocha: {
//         timeout: 200000,
//     },
// };


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("dotenv").config();
const { utils } = require("ethers");

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
    },
    solidity: {
        compilers: [
            {
                version: "0.8.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 2000,
                    },
                },
            },
        ],
    },

    mocha: {
        timeout: 200000,
    },
};
