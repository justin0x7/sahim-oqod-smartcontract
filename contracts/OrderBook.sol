// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IToken.sol";
import "./interfaces/IOrderBook.sol";
import "./interfaces/IFractionalNFT.sol";

contract OrderBook is Ownable, IOrderBook {
    using SafeERC20 for IERC20;

    address public NFTAddr;

    using EnumerableSet for EnumerableSet.UintSet;

    /// @notice Ids for buy.
    EnumerableSet.UintSet private totalBidIds;

    /// @notice Ids for sale.
    EnumerableSet.UintSet private totalAskIds;

    mapping(uint256 => EnumerableSet.UintSet) private BidIdsByTokenId;
    mapping(uint256 => EnumerableSet.UintSet) private AskIdsByTokenId;
    mapping(address => EnumerableSet.UintSet) private BidIdsByUser;
    mapping(address => EnumerableSet.UintSet) private AskIdsByUser;

    mapping(uint256 => TradeInfo) public bidTrades;
    mapping(uint256 => TradeInfo) public askTrades;

    address public tradeToken;

    uint256 public bidId;

    uint256 public askId;

    /// @notice 1000 = $1, 100 = $0.1.
    uint256 private PRICE_FIXED_POINT = 1000;

    constructor(address _NFTAddr, address _tradeToken) {
        require(_NFTAddr != address(0), "invalid NFT address");

        NFTAddr = _NFTAddr;
        tradeToken = _tradeToken;
    }

    /// @inheritdoc	IOrderBook
    function bid(
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    ) external override {
        address sender = msg.sender;
        require(_price > 0, "invalid price");
        require(_amounts > 0, "invalid amount");

        IERC20(tradeToken).safeTransferFrom(
            sender,
            address(this),
            _calculateTradeTokenAmount(_price * _amounts)
        );

        uint16 restAmount = _matchTrades(_tokenId, _price, _amounts, true);
        (_tokenId, _price, _amounts);
        if (restAmount > 0) {
            totalBidIds.add(bidId);
            BidIdsByTokenId[_tokenId].add(bidId);
            BidIdsByUser[sender].add(bidId);
            bidTrades[bidId] = TradeInfo(
                sender,
                _price,
                bidId,
                _tokenId,
                restAmount
            );
        }

        emit BidAndSale(sender, _tokenId, _price, _amounts - restAmount);
    }

    /// @inheritdoc	IOrderBook
    function ask(
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    ) external override {
        address sender = msg.sender;
        require(_price > 0, "invalid price");
        require(_amounts > 0, "invalid amount");

        IFractionalNFT(NFTAddr).openTrading(sender, _tokenId, _price, _amounts);
        uint16 restAmount = _matchTrades(_tokenId, _price, _amounts, false);
        (_tokenId, _price, _amounts);
        if (restAmount > 0) {
            totalAskIds.add(askId);
            AskIdsByTokenId[_tokenId].add(askId);
            AskIdsByUser[sender].add(askId);
            askTrades[askId] = TradeInfo(
                sender,
                _price,
                askId,
                _tokenId,
                restAmount
            );
        }

        emit AskAndSale(sender, _tokenId, _price, _amounts - restAmount);
    }

    /// @inheritdoc IOrderBook
    function updatePrice(
        uint256 _tradeId,
        uint256 _newPrice,
        bool _isAsk
    ) external override {
        TradeInfo storage info = _isAsk
            ? askTrades[_tradeId]
            : bidTrades[_tradeId];
        if (_isAsk) {
            IFractionalNFT(NFTAddr).updatePrices(
                info.tokenId,
                _newPrice,
                info.amounts
            );
        }

        info.price = _newPrice;

        emit PriceUpdated(_tradeId, _newPrice, _isAsk);
    }

    function _matchTrades(
        uint256 _tokenId,
        uint256 _price,
        uint16 _amount,
        bool _isBid
    ) internal returns (uint16 restAmount) {
        TradeInfo[] memory trades = _sortTrades(_tokenId, _isBid);

        uint256 length = trades.length;
        if (length == 0) {
            return _amount;
        }

        uint256 startIndex;
        for (uint256 i = 0; i < length; i++) {
            if (_isBid && trades[i].price <= _price) {
                startIndex = i + 1; // this if for check if found fitable id.
            } else if (!_isBid && trades[i].price >= _price) {
                startIndex = i + 1; // this if for check if found fitable id.
            }
        }

        if (startIndex > 0) {
            return _amount;
        }
        startIndex -= 1; // back to origin Id.

        for (uint256 i = startIndex; i < length; i++) {
            if (_amount == 0) return 0;

            uint256 id = trades[i].tradeId;
            uint256 tradeAmount;
            TradeInfo storage info;
            if (trades[i].amounts > _amount) {
                info = _isBid ? askTrades[id] : bidTrades[id];
                info.amounts -= _amount;
                tradeAmount = _amount;
                _amount = 0;
            } else {
                info = _isBid ? askTrades[id] : bidTrades[id];
                if (_isBid) {
                    totalAskIds.remove(id);
                    AskIdsByTokenId[_tokenId].remove(id);
                    AskIdsByUser[info.creator].remove(id);
                    delete askTrades[id];
                } else {
                    totalBidIds.remove(id);
                    BidIdsByTokenId[_tokenId].remove(id);
                    BidIdsByUser[info.creator].remove(id);
                    delete bidTrades[id];
                }

                _amount -= info.amounts;
                tradeAmount = info.amounts;
            }

            _executeTrade(
                _isBid ? info.creator : msg.sender,
                _isBid ? msg.sender : info.creator,
                _tokenId,
                _price,
                info.amounts
            );
        }
    }

    function _sortTrades(
        uint256 _tokenId,
        bool _isAsk
    ) internal view returns (TradeInfo[] memory) {
        uint256[] memory tradeIds = _isAsk
            ? AskIdsByTokenId[_tokenId].values()
            : BidIdsByTokenId[_tokenId].values();

        uint256 length = tradeIds.length;
        if (length == 0) {
            return new TradeInfo[](0);
        }

        TradeInfo[] memory trades = new TradeInfo[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 id = tradeIds[i];
            trades[i] = _isAsk ? askTrades[id] : bidTrades[id];
        }

        TradeInfo memory temp;
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (trades[i].price < trades[j].price) {
                    temp = trades[j];
                    trades[j] = trades[i];
                    trades[i] = temp;
                }
            }
        }

        return trades;
    }

    function _executeTrade(
        address _seller,
        address _buyer,
        uint256 _tokenId,
        uint256 _price,
        uint16 _amount
    ) internal {
        IFractionalNFT(NFTAddr).tradeVotes(
            _seller,
            _buyer,
            _tokenId,
            _price,
            _amount
        );

        IERC20(tradeToken).safeTransfer(
            _seller,
            _calculateTradeTokenAmount(_amount * _price)
        );
    }

    function _calculateTradeTokenAmount(
        uint256 _price
    ) internal view returns (uint256) {
        uint8 decimals = IToken(tradeToken).decimals();
        return (_price * 10 ** decimals) / PRICE_FIXED_POINT;
    }
}
