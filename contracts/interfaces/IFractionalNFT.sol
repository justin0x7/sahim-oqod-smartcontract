// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IFractionalNFT {
    struct VoteInfo {
        uint256 ownedVotesAmount;
        uint16 listedVotesAmount;
        uint16 unlistedVotesAmount;
    }

    struct PriceInfo {
        uint256 totalPrice;
        uint256 averagePrice;
    }

    /// @notice Mint NFT with exact metaData.
    /// @param _metaData The metaData of tokenId.
    function mintNFT(string memory _metaData) external;

    /// @notice Update listedVotePrice.
    /// @dev Only orderbook can call this funciton.
    /// @param _tokenId Listed tokenId for trade.
    /// @param _price The price of vote.
    /// @param _amounts The amount of votes.
    function updatePrices(
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    ) external;

    /// @notice Trade votes.
    /// @dev This function can be called by only OrderBook.
    /// @param _seller The address of seller.
    /// @param _buyer The address of buyer.
    /// @param _tradeTokenId The tokenId of trading NFT.
    /// @param _soldVotePrice The price of one vote that be sold.
    /// @param _soldVotesAmount The amounts of votes that be sold.
    function tradeVotes(
        address _seller,
        address _buyer,
        uint256 _tradeTokenId,
        uint256 _soldVotePrice,
        uint16 _soldVotesAmount
    ) external;

    /// @notice Open trading with certain votes amount and price.
    /// @dev Only orderBook can call this function.
    /// @param _owner The address of owner.
    /// @param _tradeTokenId The tokenId of NFT to trade.
    /// @param _votePrice The price of each vote.
    /// @param _votesAmount The amount of votes to trade.
    function openTrading(
        address _owner,
        uint256 _tradeTokenId,
        uint256 _votePrice,
        uint16 _votesAmount
    ) external;

    /// @notice Set orderBook contract address.
    /// @dev Only owner can call this function.
    /// @param _orderBook The address of orderBook contract.
    function setOrderBook(address _orderBook) external;

    /// @notice Set enable the certain tokenId.
    /// @dev Only owner can call this function.
    function enableNFT(uint256 _tokenId) external;

    /// @notice Get all owners who have ownership of the specific tokenId.
    /// @param _tokenId The tokenId of NFT.
    function getAllOwners(
        uint256 _tokenId
    ) external view returns (address[] memory);

    /// @notice Get all tokenIds that owner owned.
    function getAllOwnedTokenIds(
        address _owner
    ) external view returns (uint256[] memory);

    event NFTMinted(address indexed minter, uint256 tokenId);

    event OrderBookSet(address indexed orderBook);
}
