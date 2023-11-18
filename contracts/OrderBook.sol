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
        require(_checkTokenId(_tokenId), "invalid tokenId");
        require(_price > 0, "invalid price");
        require(_amounts > 0, "invalid amount");

        IERC20(tradeToken).safeTransferFrom(
            sender,
            address(this),
            _convertPriceToTokenAmount(_price * _amounts)
        );

        uint16 restAmount = _matchTrades(_tokenId, _price, _amounts, true);
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
            bidId++;
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
        require(_checkTokenId(_tokenId), "invalid tokenId");
        require(_price > 0, "invalid price");
        require(_amounts > 0, "invalid amount");

        IFractionalNFT(NFTAddr).openTrading(sender, _tokenId, _price, _amounts);
        uint16 restAmount = _matchTrades(_tokenId, _price, _amounts, false);
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
            askId++;
        }

        emit AskAndSale(sender, _tokenId, _price, _amounts - restAmount);
    }

    /// @inheritdoc IOrderBook
    function closeBidAsk(uint256 _tradeId, bool _isBid) external override {
        address sender = msg.sender;
        require(
            (_isBid && _tradeId < bidId) || (!_isBid && _tradeId < askId),
            "invalid tradeId"
        );
        require(
            (_isBid && bidTrades[_tradeId].creator == sender) ||
                (!_isBid && askTrades[_tradeId].creator == sender),
            "no permission"
        );
        uint256 tokenId = _isBid
            ? bidTrades[_tradeId].tokenId
            : askTrades[_tradeId].tokenId;
        if (_isBid) {
            TradeInfo memory info = bidTrades[_tradeId];
            IERC20(tradeToken).safeTransfer(
                sender,
                _convertPriceToTokenAmount(info.amounts * info.price)
            );
            delete bidTrades[_tradeId];
            totalBidIds.remove(_tradeId);
            BidIdsByTokenId[tokenId].remove(_tradeId);
            BidIdsByUser[sender].remove(_tradeId);
        } else {
            TradeInfo memory info = askTrades[_tradeId];
            delete askTrades[_tradeId];
            totalAskIds.remove(_tradeId);
            AskIdsByTokenId[tokenId].remove(_tradeId);
            AskIdsByUser[sender].remove(_tradeId);
            IFractionalNFT(NFTAddr).closeTrading(sender, tokenId, info.amounts);
        }

        emit BidAskClosed(_tradeId, _isBid);
    }

    /// @inheritdoc IOrderBook
    function updatePrice(
        uint256 _tradeId,
        uint256 _newPrice,
        bool _isAsk
    ) external override {
        address sender = msg.sender;
        require(
            (_isAsk && _tradeId < askId) || (!_isAsk && _tradeId < bidId),
            "invalid tradeId"
        );
        TradeInfo storage info = _isAsk
            ? askTrades[_tradeId]
            : bidTrades[_tradeId];
        require(info.creator == sender, "no permission");
        require(_newPrice != info.price, "same price");
        if (_isAsk) {
            IFractionalNFT(NFTAddr).updatePrices(
                info.tokenId,
                _newPrice,
                info.amounts
            );
        } else {
            uint256 offsetAmount = 0;
            if (_newPrice < info.price) {
                offsetAmount = (info.price - _newPrice) * info.amounts;
                IERC20(tradeToken).safeTransfer(
                    sender,
                    _convertPriceToTokenAmount(offsetAmount)
                );
            } else {
                offsetAmount = (_newPrice - info.price) * info.amounts;
                IERC20(tradeToken).safeTransferFrom(
                    sender,
                    address(this),
                    _convertPriceToTokenAmount(offsetAmount)
                );
            }
        }

        info.price = _newPrice;

        uint16 restAmount = _matchTrades(
            info.tokenId,
            _newPrice,
            info.amounts,
            !_isAsk
        );
        uint16 saledAmount = info.amounts - restAmount;

        if (restAmount == 0) {
            if (_isAsk) {
                totalAskIds.remove(_tradeId);
                AskIdsByTokenId[info.tokenId].remove(_tradeId);
                AskIdsByUser[sender].remove(_tradeId);
                delete askTrades[_tradeId];
            } else {
                totalBidIds.remove(_tradeId);
                BidIdsByTokenId[info.tokenId].remove(_tradeId);
                BidIdsByUser[sender].remove(_tradeId);
                delete bidTrades[_tradeId];
            }
        }

        emit PriceUpdated(_tradeId, _newPrice, saledAmount, _isAsk);
    }

    /// @inheritdoc IOrderBook
    function getAllBidAskByTokenId(
        uint256 _tokenId,
        bool _isBid
    ) external view override returns (TradeInfo[] memory) {
        uint256 length = _isBid
            ? BidIdsByTokenId[_tokenId].length()
            : AskIdsByTokenId[_tokenId].length();
        TradeInfo[] memory info = new TradeInfo[](length);
        if (length == 0) {
            return info;
        }

        uint256[] memory tradeIds = _isBid
            ? BidIdsByTokenId[_tokenId].values()
            : AskIdsByTokenId[_tokenId].values();

        for (uint256 i = 0; i < length; i++) {
            uint256 tradeId = tradeIds[i];
            info[i] = _isBid ? bidTrades[tradeId] : askTrades[tradeId];
        }

        return info;
    }

    /// @inheritdoc IOrderBook
    function getAllBidAskByCreator(
        address _creator,
        bool _isBid
    ) external view override returns (TradeInfo[] memory) {
        uint256 length = _isBid
            ? BidIdsByUser[_creator].length()
            : AskIdsByUser[_creator].length();
        TradeInfo[] memory info = new TradeInfo[](length);
        if (length == 0) {
            return info;
        }

        uint256[] memory tradeIds = _isBid
            ? BidIdsByUser[_creator].values()
            : AskIdsByUser[_creator].values();

        for (uint256 i = 0; i < length; i++) {
            uint256 tradeId = tradeIds[i];
            info[i] = _isBid ? bidTrades[tradeId] : askTrades[tradeId];
        }

        return info;
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
                break;
            } else if (!_isBid && trades[i].price >= _price) {
                startIndex = i + 1; // this if for check if found fitable id.
                break;
            }
        }

        if (startIndex == 0) {
            return _amount;
        }
        startIndex -= 1; // back to origin Id.

        uint256 matchTokenId = _tokenId;
        for (uint256 i = startIndex; i < length; i++) {
            if (_amount == 0) return 0;

            uint256 id = trades[i].tradeId;
            TradeInfo storage info = _isBid ? askTrades[id] : bidTrades[id];
            address seller = _isBid ? info.creator : msg.sender;
            address buyer = _isBid ? msg.sender : info.creator;
            uint256 price = _isBid ? _price : info.price;
            uint16 tradeAmount;
            if (trades[i].amounts > _amount) {
                info.amounts -= _amount;
                tradeAmount = _amount;
                _amount = 0;
            } else {
                if (_isBid) {
                    totalAskIds.remove(id);
                    AskIdsByTokenId[matchTokenId].remove(id);
                    AskIdsByUser[info.creator].remove(id);
                    tradeAmount = info.amounts;
                    delete askTrades[id];
                } else {
                    totalBidIds.remove(id);
                    BidIdsByTokenId[matchTokenId].remove(id);
                    BidIdsByUser[info.creator].remove(id);
                    tradeAmount = info.amounts;
                    delete bidTrades[id];
                }

                _amount -= info.amounts;
            }

            _executeTrade(seller, buyer, matchTokenId, price, tradeAmount);
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
            _convertPriceToTokenAmount(_amount * _price)
        );
    }

    function _checkTokenId(uint256 _tokenId) internal view returns (bool) {
        return _tokenId > 0 && IFractionalNFT(NFTAddr).tokenId() > _tokenId;
    }

    function _convertPriceToTokenAmount(
        uint256 _price
    ) internal view returns (uint256) {
        uint8 decimals = IToken(tradeToken).decimals();
        return (_price * 10 ** decimals) / PRICE_FIXED_POINT;
    }
}
