const RoyaltyNft721 = artifacts.require("RoyaltyNft721");

module.exports = function (deployer) {
  deployer.deploy(RoyaltyNft721);
};
