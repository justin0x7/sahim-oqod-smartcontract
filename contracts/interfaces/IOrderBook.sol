// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOrderBook {
    struct TradeInfo {
        address creator;
        uint256 price;
        uint256 tradeId;
        uint256 tokenId;
        uint16 amounts;
    }

    event BidAskClosed(uint256 _tradeId, bool _isBid);

    event BidAndSale(
        address indexed buyer,
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    );

    event AskAndSale(
        address indexed seller,
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    );

    event PriceUpdated(
        uint256 _tradeId,
        uint256 _newPrice,
        uint256 _saledAmount,
        bool _isAsk
    );

    /// @notice Buy votes with exact price.
    /// @param _tokenId The tokenId of NFT for buy.
    /// @param _price The price to buy votes.
    /// @param _amounts The amount of vote to buy.
    function bid(uint256 _tokenId, uint256 _price, uint16 _amounts) external;

    /// @notice Sell votes with exact price
    /// @param _price The price to sell votes.
    /// @param _amounts The amount of vote to sell.
    function ask(uint256 _tokenId, uint256 _price, uint16 _amounts) external;

    /// @notice Update vote price.
    function updatePrice(
        uint256 _tradeId,
        uint256 _newPrice,
        bool _isAsk
    ) external;

    /// @notice Close Bid/Ask.
    /// @dev Only trader owner can call this function.
    function closeBidAsk(uint256 _tradeId, bool _isBid) external;

    /// @notice Get all bid/ask information by tokenId.
    function getAllBidAskByTokenId(
        uint256 _tokenId,
        bool _isBid
    ) external view returns (TradeInfo[] memory);

    /// @notice Get all bid/ask information by creator.
    function getAllBidAskByCreator(
        address _creator,
        bool _isBid
    ) external view returns (TradeInfo[] memory);
}
