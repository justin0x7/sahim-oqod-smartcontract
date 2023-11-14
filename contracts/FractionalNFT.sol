// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "./interfaces/IFractionalNFT.sol";

contract FractionalNFT is Ownable, ERC721, IFractionalNFT {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    mapping(address => uint256) private _balances;

    /// @notice Information for owners who owned part of ownership.
    mapping(uint256 => EnumerableSet.AddressSet) private owners;

    /// @notice TokenIds information owner owned.
    mapping(address => EnumerableSet.UintSet) private ownedTokenIds;

    /// @notice Total price of each tokenId.
    mapping(uint256 => PriceInfo) public prices;

    /// @notice VoteInformation by tokenId and owner.
    mapping(uint256 => mapping(address => VoteInfo)) public votesInfo;

    /// @notice MetaData for each tokenId.
    mapping(uint256 => string) private tokensMetaData;

    /// @notice Flags to show NFT is allowed or not.
    mapping(uint256 => bool) public allowedNFTs;

    /// @notice The address of orderBook.
    address public orderBook;

    /// @notice Increasing tokenId.
    uint256 public tokenId;

    /// @notice 1000 = $1, 100 = $0.1.
    uint256 private PRICE_FIXED_POINT = 1000;

    /// @notice The merkleRoot data.
    bytes32 private merkleRoot;

    /// @notice Default votes(pieces) amount for tokenId.
    uint16 public votesAmount = 1000;

    modifier onlyOrderBook() {
        require(
            msg.sender == orderBook,
            "Ownable: caller is not the orderBook"
        );
        _;
    }

    modifier onlyValidTokenId(uint256 _tokenId) {
        require(_tokenId < tokenId && allowedNFTs[_tokenId], "invalid tokenId");
        _;
    }

    constructor() ERC721("Sahim NFT", "SNFT") {
        tokenId = 1;
    }

    /// @inheritdoc	IFractionalNFT
    function mintNFT(string memory _metaData) external override {
        address sender = msg.sender;

        owners[tokenId].add(sender);
        tokensMetaData[tokenId] = _metaData;
        allowedNFTs[tokenId] = false;

        emit NFTMinted(sender, tokenId++);
    }

    /// @inheritdoc IFractionalNFT
    function enableNFT(uint256 _tokenId) external override onlyOwner {
        require(_tokenId < tokenId, "invalid tokenId");
        require(!allowedNFTs[_tokenId], "already enabled");

        address creator = owners[_tokenId].at(0);
        ownedTokenIds[creator].add(_tokenId);
        votesInfo[_tokenId][creator] = VoteInfo(votesAmount, 0, votesAmount);
        allowedNFTs[_tokenId] = true;
        _balances[creator] += 1;
    }

    /// @inheritdoc IFractionalNFT
    function openTrading(
        address _owner,
        uint256 _tradeTokenId,
        uint256 _votePrice,
        uint16 _votesAmount
    ) external override onlyOrderBook onlyValidTokenId(_tradeTokenId) {
        VoteInfo storage voteInfo = votesInfo[_tradeTokenId][_owner];
        require(
            voteInfo.unlistedVotesAmount >= _votesAmount,
            "not enough votes amount to trade"
        );
        voteInfo.listedVotesAmount += _votesAmount;
        voteInfo.unlistedVotesAmount -= _votesAmount;
        _updateAverageVotePrice(_tradeTokenId, _votePrice, _votesAmount);
    }

    /// @inheritdoc IFractionalNFT
    function updatePrices(
        uint256 _tokenId,
        uint256 _price,
        uint16 _amounts
    ) external override onlyOrderBook onlyValidTokenId(_tokenId) {
        _updateAverageVotePrice(_tokenId, _price, _amounts);
    }

    /// @inheritdoc IFractionalNFT
    function tradeVotes(
        address _seller,
        address _buyer,
        uint256 _tradeTokenId,
        uint256 _soldVotePrice,
        uint16 _soldVotesAmount
    ) external override onlyOrderBook {
        VoteInfo storage voteInfo = votesInfo[_tradeTokenId][_seller];

        _updateAverageVotePrice(
            _tradeTokenId,
            _soldVotePrice,
            _soldVotesAmount
        );

        // update Seller's voteInfo.
        voteInfo.ownedVotesAmount -= _soldVotesAmount;
        voteInfo.listedVotesAmount -= _soldVotesAmount;
        bool isSoldAll = voteInfo.ownedVotesAmount == 0;

        // update Buyer's voteInfo.
        voteInfo = votesInfo[_tradeTokenId][_buyer];
        voteInfo.unlistedVotesAmount += _soldVotesAmount;
        voteInfo.ownedVotesAmount += _soldVotesAmount;

        // update owners.
        if (isSoldAll) {
            owners[_tradeTokenId].remove(_seller);
            _balances[_seller] -= 1;
            ownedTokenIds[_seller].remove(_tradeTokenId);
        }
        if (voteInfo.ownedVotesAmount == _soldVotesAmount) {
            owners[_tradeTokenId].add(_buyer);
            _balances[_buyer] += 1;
            ownedTokenIds[_buyer].add(_tradeTokenId);
        }
    }

    /// @inheritdoc IFractionalNFT
    function setOrderBook(address _orderBook) external override onlyOwner {
        require(_orderBook != address(0), "invalid orderBook address");
        orderBook = _orderBook;

        emit OrderBookSet(_orderBook);
    }

    /// @notice Get owner of tokenId.
    /// @dev If one user owns whole ownership of tokenId, return user address, otherwise return zero address.
    function ownerOf(
        uint256 _tokenId
    ) public view override onlyValidTokenId(_tokenId) returns (address) {
        if (owners[_tokenId].length() == 1) {
            return owners[_tokenId].at(0);
        } else {
            return address(0);
        }
    }

    /// @inheritdoc IFractionalNFT
    function getAllOwnedTokenIds(
        address _owner
    ) external view override returns (uint256[] memory) {
        return ownedTokenIds[_owner].values();
    }

    /// @notice Get all owner addresses.
    /// @param _tokenId The tokenId of NFT.
    function getAllOwners(
        uint256 _tokenId
    )
        external
        view
        override
        onlyValidTokenId(_tokenId)
        returns (address[] memory)
    {
        return owners[_tokenId].values();
    }

    /// @notice Get balance of owner.
    /// @dev If owner has some ownerships, balance ++.
    function balanceOf(
        address _owner
    ) public view virtual override returns (uint256) {
        require(
            _owner != address(0),
            "ERC721: address zero is not a valid owner"
        );
        return _balances[_owner];
    }

    function tokenURI(
        uint256 _tokenId
    ) public view virtual override returns (string memory) {
        return tokensMetaData[_tokenId];
    }

    function _updateAverageVotePrice(
        uint256 _tokenId,
        uint256 _votePrice,
        uint16 _votesAmount
    ) internal {
        PriceInfo storage info = prices[_tokenId];
        info.totalPrice =
            info.totalPrice -
            info.averagePrice *
            _votesAmount +
            _votePrice *
            _votesAmount;

        info.averagePrice = info.totalPrice / votesAmount;
    }
}
