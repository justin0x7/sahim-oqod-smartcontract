const { expect } = require("chai");
const { ethers } = require("hardhat");

const { deploy, bigNum, smallNum } = require("../scripts/utils");

describe("OrderBook test", function () {
    before(async function () {
        [
            this.deployer,
            this.creator_1,
            this.creator_2,
            this.bidder_1,
            this.bidder_2,
        ] = await ethers.getSigners();

        this.mockToken = await deploy(
            "TestERC20",
            "TestERC0",
            "MockToken",
            "MToken",
            18
        );
        this.FractionalNFT = await deploy("FractionalNFT", "FractionalNFT");
        this.OrderBook = await deploy(
            "OrderBook",
            "OrderBook",
            this.FractionalNFT.address,
            this.mockToken.address
        );

        await this.FractionalNFT.setOrderBook(this.OrderBook.address);
    });

    it("check deployment", async function () {
        console.log("deployed successfully!");
    });

    describe("mint NFT", async function () {
        it("mint NFT", async function () {
            await this.FractionalNFT.connect(this.creator_1).mintNFT("");
        });

        it("enable NFT", async function () {
            await this.FractionalNFT.enableNFT(1);
        });
    });

    describe("bid", function () {
        let tokenId = 1;
        it("reverts if tokenId is invalid", async function () {
            await expect(
                this.OrderBook.connect(this.creator_1).bid(100, 0, 0)
            ).to.be.revertedWith("invalid tokenId");
        });

        it("reverts if price is invalid", async function () {
            await expect(
                this.OrderBook.connect(this.creator_1).bid(tokenId, 0, 0)
            ).to.be.revertedWith("invalid price");
        });

        it("reverts if amounts is invalid", async function () {
            await expect(
                this.OrderBook.connect(this.creator_1).bid(tokenId, 500, 0)
            ).to.be.revertedWith("invalid amount");
        });

        it("bid and check", async function () {
            // mint mock token
            let mintAmount = bigNum(1000, 18);
            await this.mockToken.mintToken(
                BigInt(mintAmount),
                this.bidder_1.address
            );

            // bid
            await this.mockToken
                .connect(this.bidder_1)
                .approve(this.OrderBook.address, BigInt(mintAmount));

            expect(
                (await this.OrderBook.getAllBidAskByTokenId(tokenId, true))
                    .length
            ).to.be.equal(0);
            let votesAmount = 200;
            let bidPrice = 550; // $0.55
            await expect(
                this.OrderBook.connect(this.bidder_1).bid(
                    tokenId,
                    BigInt(bidPrice),
                    votesAmount
                )
            )
                .to.be.emit(this.OrderBook, "BidAndSale")
                .withArgs(this.bidder_1.address, tokenId, bidPrice, 0);

            let bids = await this.OrderBook.getAllBidAskByCreator(
                this.bidder_1.address,
                true
            );
            expect(bids.length).to.be.equal(1);
            expect(bids[0].creator).to.be.equal(this.bidder_1.address);
            expect(bids[0].price).to.be.equal(bidPrice);
            expect(bids[0].tokenId).to.be.equal(tokenId);
            expect(bids[0].tradeId).to.be.equal(0);

            await this.OrderBook.connect(this.bidder_1).bid(
                tokenId,
                bidPrice / 2,
                votesAmount
            );
            bids = await this.OrderBook.getAllBidAskByCreator(
                this.bidder_1.address,
                true
            );
            expect(bids.length).to.be.equal(2);
            expect(bids[1].creator).to.be.equal(this.bidder_1.address);
            expect(bids[1].price).to.be.equal(bidPrice / 2);
            expect(bids[1].tokenId).to.be.equal(tokenId);
            expect(bids[1].tradeId).to.be.equal(1);
        });
    });

    describe("ask", function () {
        let tokenId = 1;
        let askPrice = 600;
        let askAmount = 300;
        it("reverts if tokenId is invalid", async function () {
            await expect(this.OrderBook.ask(0, 0, 0)).to.be.revertedWith(
                "invalid tokenId"
            );
        });

        it("reverts if price is invalid", async function () {
            await expect(this.OrderBook.ask(tokenId, 0, 0)).to.be.revertedWith(
                "invalid price"
            );
        });

        it("reverts if amounts is invalid", async function () {
            await expect(
                this.OrderBook.ask(tokenId, askPrice, 0)
            ).to.be.revertedWith("invalid amount");
        });

        it("reverts if unlisted amounts is not enough", async function () {
            await expect(
                this.OrderBook.ask(tokenId, askPrice, 10000)
            ).to.be.revertedWith("not enough votes amount to trade");
        });

        it("ask and check", async function () {
            let allBids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );
            expect(Number(allBids[0].price)).to.be.lessThan(Number(askPrice));
            expect(
                (await this.OrderBook.getAllBidAskByTokenId(tokenId, false))
                    .length
            ).to.be.equal(0);

            await expect(
                this.OrderBook.connect(this.creator_1).ask(
                    tokenId,
                    askPrice,
                    askAmount
                )
            )
                .to.be.emit(this.OrderBook, "AskAndSale")
                .withArgs(this.creator_1.address, tokenId, askPrice, 0);

            let asks = await this.OrderBook.getAllBidAskByCreator(
                this.creator_1.address,
                false
            );
            expect(asks.length).to.be.equal(1);
            expect(asks[0].creator).to.be.equal(this.creator_1.address);
            expect(asks[0].price).to.be.equal(askPrice);
            expect(asks[0].tokenId).to.be.equal(tokenId);
            expect(asks[0].tradeId).to.be.equal(0);

            await this.OrderBook.connect(this.creator_1).ask(
                tokenId,
                askPrice * 2,
                askAmount
            );

            asks = await this.OrderBook.getAllBidAskByCreator(
                this.creator_1.address,
                false
            );
            expect(asks.length).to.be.equal(2);
            expect(asks[1].creator).to.be.equal(this.creator_1.address);
            expect(asks[1].price).to.be.equal(askPrice * 2);
            expect(asks[1].tokenId).to.be.equal(tokenId);
            expect(asks[1].tradeId).to.be.equal(1);
        });
    });

    describe("matchTrades and check", function () {
        let tokenId = 1;
        it("bid and matchTrades", async function () {
            let beforeBids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );
            let beforeAsks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );
            let bidPrice = beforeBids[1].price;
            let bidAmount = beforeBids[1].amounts;

            let beforeTokenBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let beforeBidderVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );

            let askPrice = bidPrice - 100;
            let askAmount = BigInt(bidAmount) / BigInt(2);
            await expect(
                this.OrderBook.connect(this.creator_1).ask(
                    tokenId,
                    askPrice,
                    askAmount
                )
            )
                .to.be.emit(this.OrderBook, "AskAndSale")
                .withArgs(
                    this.creator_1.address,
                    tokenId,
                    askPrice,
                    Number(askAmount)
                );
            let afterBids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );
            let afterAsks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );

            let afterTokenBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let afterBidderVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );
            let expectTokenAmount =
                (BigInt(afterBids[0].price) *
                    BigInt(askAmount) *
                    BigInt(bigNum(1, 18))) /
                BigInt(1000);

            expect(beforeAsks.length).to.be.equal(afterAsks.length);
            expect(beforeBids.length).to.be.equal(afterBids.length);

            expect(
                BigInt(beforeBids[0].amounts) - BigInt(afterBids[0].amounts)
            ).to.be.equal(BigInt(askAmount));

            expect(
                smallNum(BigInt(afterTokenBal) - BigInt(beforeTokenBal), 18)
            ).to.be.equal(smallNum(expectTokenAmount, 18));
            expect(
                Number(afterBidderVoteInfo.ownedVotesAmount) -
                    Number(beforeBidderVoteInfo.ownedVotesAmount)
            ).to.be.equal(Number(askAmount));
            expect(
                Number(afterBidderVoteInfo.unlistedVotesAmount) -
                    Number(beforeBidderVoteInfo.unlistedVotesAmount)
            ).to.be.equal(Number(askAmount));
        });

        it("ask and matchTrades", async function () {
            let beforeAsks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );
            let beforeBids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );

            let askPrice = beforeAsks[1].price;
            let askAmount = beforeAsks[1].amounts;

            let beforeTokenBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let beforeCreatorVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            let beforeBidderVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );

            let bidPrice = askPrice - 100;
            let bidAmount = BigInt(askAmount) / BigInt(2);
            let requireTokenAmount =
                (BigInt(bidPrice) * BigInt(bidAmount) * BigInt(bigNum(1, 18))) /
                BigInt(1000);

            await this.mockToken.mintToken(
                BigInt(requireTokenAmount),
                this.bidder_1.address
            );

            await this.mockToken
                .connect(this.bidder_1)
                .approve(this.OrderBook.address, BigInt(requireTokenAmount));

            await expect(
                this.OrderBook.connect(this.bidder_1).bid(
                    tokenId,
                    bidPrice,
                    bidAmount
                )
            )
                .to.be.emit(this.OrderBook, "BidAndSale")
                .withArgs(
                    this.bidder_1.address,
                    tokenId,
                    bidPrice,
                    Number(bidAmount)
                );

            let afterBids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );
            let afterAsks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );

            let afterTokenBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let afterCreatorVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            let afterBidderVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );

            expect(beforeAsks.length).to.be.equal(afterAsks.length);
            expect(beforeBids.length).to.be.equal(afterBids.length);

            expect(
                BigInt(beforeAsks[0].amounts) - BigInt(afterAsks[0].amounts)
            ).to.be.equal(BigInt(bidAmount));

            expect(
                smallNum(BigInt(afterTokenBal) - BigInt(beforeTokenBal), 18)
            ).to.be.equal(smallNum(requireTokenAmount, 18));
            expect(
                Number(beforeCreatorVoteInfo.ownedVotesAmount) -
                    Number(afterCreatorVoteInfo.ownedVotesAmount)
            ).to.be.equal(Number(bidAmount));
            expect(
                Number(beforeCreatorVoteInfo.listedVotesAmount) -
                    Number(afterCreatorVoteInfo.listedVotesAmount)
            ).to.be.equal(Number(bidAmount));
            expect(
                Number(afterBidderVoteInfo.ownedVotesAmount) -
                    Number(beforeBidderVoteInfo.ownedVotesAmount)
            ).to.be.equal(Number(bidAmount));
            expect(
                Number(afterBidderVoteInfo.unlistedVotesAmount) -
                    Number(beforeBidderVoteInfo.unlistedVotesAmount)
            ).to.be.equal(Number(bidAmount));
        });
    });

    describe("update price", function () {
        let tokenId = 1;
        it("reverts if tradeId is invalid", async function () {
            await expect(
                this.OrderBook.updatePrice(100, 1000, true)
            ).to.be.revertedWith("invalid tradeId");
        });

        it("reverts if caller is invalid", async function () {
            await expect(
                this.OrderBook.updatePrice(1, 1000, true)
            ).to.be.revertedWith("no permission");
        });

        it("update bid price - not match", async function () {
            let bids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );

            let tradeId = bids[0].tradeId;
            let newPrice = Number(bids[0].price) + Number(10);
            let plusAmount =
                (BigInt(10) * BigInt(bids[0].amounts) * BigInt(bigNum(1, 18))) /
                BigInt(1000);

            await this.mockToken
                .connect(this.bidder_1)
                .approve(this.OrderBook.address, BigInt(plusAmount));

            let beforeBal = await this.mockToken.balanceOf(
                this.bidder_1.address
            );
            await expect(
                this.OrderBook.connect(this.bidder_1).updatePrice(
                    tradeId,
                    newPrice,
                    false
                )
            )
                .to.be.emit(this.OrderBook, "PriceUpdated")
                .withArgs(tradeId, newPrice, 0, false);
            let afterBal = await this.mockToken.balanceOf(
                this.bidder_1.address
            );

            bids = await this.OrderBook.getAllBidAskByTokenId(tokenId, true);
            expect(bids[0].price).to.be.equal(newPrice);
            expect(BigInt(beforeBal) - BigInt(afterBal)).to.be.equal(
                BigInt(plusAmount)
            );

            newPrice = Number(bids[0].price) - Number(30);
            plusAmount =
                (BigInt(30) * BigInt(bids[0].amounts) * BigInt(bigNum(1, 18))) /
                BigInt(1000);

            beforeBal = await this.mockToken.balanceOf(this.bidder_1.address);
            await this.OrderBook.connect(this.bidder_1).updatePrice(
                tradeId,
                newPrice,
                false
            );
            afterBal = await this.mockToken.balanceOf(this.bidder_1.address);

            expect(BigInt(afterBal) - BigInt(beforeBal)).to.be.equal(
                BigInt(plusAmount)
            );
        });

        it("update ask price - not match", async function () {
            let asks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );

            let tradeId = asks[0].tradeId;
            let newPrice = Number(asks[0].price) + Number(10);

            await expect(
                this.OrderBook.connect(this.creator_1).updatePrice(
                    tradeId,
                    newPrice,
                    true
                )
            )
                .to.be.emit(this.OrderBook, "PriceUpdated")
                .withArgs(tradeId, newPrice, 0, true);

            asks = await this.OrderBook.getAllBidAskByTokenId(tokenId, false);
            expect(asks[0].price).to.be.equal(newPrice);
        });

        it("update bid price - match", async function () {
            let asks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );
            let bids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );

            let tradeId = bids[0].tradeId;
            let newPrice = asks[1].price;
            let plusAmount = newPrice - bids[0].price;
            let beforeBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let beforeVotesInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );
            plusAmount =
                (BigInt(plusAmount) *
                    BigInt(bigNum(1, 18)) *
                    BigInt(bids[0].amounts)) /
                BigInt(1000);
            await this.mockToken.mintToken(
                BigInt(plusAmount),
                this.bidder_1.address
            );
            await this.mockToken
                .connect(this.bidder_1)
                .approve(this.OrderBook.address, BigInt(plusAmount));
            await expect(
                this.OrderBook.connect(this.bidder_1).updatePrice(
                    tradeId,
                    newPrice,
                    false
                )
            )
                .to.be.emit(this.OrderBook, "PriceUpdated")
                .withArgs(tradeId, newPrice, bids[0].amounts, false);

            let afterBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let afterVotesInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );

            let expectAmount = BigInt(bids[0].amounts) * BigInt(newPrice);
            expectAmount =
                (BigInt(expectAmount) * BigInt(bigNum(1, 18))) / BigInt(1000);
            expect(
                afterVotesInfo.ownedVotesAmount -
                    beforeVotesInfo.ownedVotesAmount
            ).to.be.equal(bids[0].amounts);
            expect(BigInt(afterBal) - BigInt(beforeBal)).to.be.equal(
                BigInt(expectAmount)
            );
        });

        it("update ask price - match", async function () {
            let asks = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                false
            );
            let bids = await this.OrderBook.getAllBidAskByTokenId(
                tokenId,
                true
            );

            let tradeId = asks[1].tradeId;
            let newPrice = bids[0].price;
            let beforeBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let beforeVotesInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );
            await expect(
                this.OrderBook.connect(this.creator_1).updatePrice(
                    tradeId,
                    newPrice,
                    true
                )
            )
                .to.be.emit(this.OrderBook, "PriceUpdated")
                .withArgs(tradeId, newPrice, bids[0].amounts, true);
            let afterBal = await this.mockToken.balanceOf(
                this.creator_1.address
            );
            let afterVotesInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.bidder_1.address
            );
            let expectAmount = BigInt(bids[0].amounts) * BigInt(newPrice);
            expectAmount =
                (BigInt(expectAmount) * BigInt(bigNum(1, 18))) / BigInt(1000);

            expect(
                afterVotesInfo.ownedVotesAmount -
                    beforeVotesInfo.ownedVotesAmount
            ).to.be.equal(bids[0].amounts);
            expect(BigInt(afterBal) - BigInt(beforeBal)).to.be.equal(
                BigInt(expectAmount)
            );
        });
    });

    describe("cose Bid/Ask", function () {
        let tokenId = 1;
        let tradeId = 0;

        it("reverts if tradeId is invalid", async function () {
            await expect(
                this.OrderBook.closeBidAsk(100, true)
            ).to.be.revertedWith("invalid tradeId");
        });

        it("reverts if caller is invalid", async function () {
            await expect(
                this.OrderBook.closeBidAsk(tokenId, false)
            ).to.be.revertedWith("no permission");
        });

        it("close bid and check", async function () {
            let bidPrice = 100;
            let votesAmount = 20;
            let beforeBal = await this.mockToken.balanceOf(
                this.bidder_1.address
            );
            await this.mockToken
                .connect(this.bidder_1)
                .approve(this.OrderBook.address, bigNum(20, 18));
            await this.OrderBook.connect(this.bidder_1).bid(
                tokenId,
                BigInt(bidPrice),
                votesAmount
            );

            let tradeId = (await this.OrderBook.bidId()) - 1;
            await expect(
                this.OrderBook.connect(this.bidder_1).closeBidAsk(tradeId, true)
            )
                .to.be.emit(this.OrderBook, "BidAskClosed")
                .withArgs(tradeId, true);

            let afterBal = await this.mockToken.balanceOf(
                this.bidder_1.address
            );

            expect(
                (
                    await this.OrderBook.getAllBidAskByCreator(
                        this.bidder_1.address,
                        true
                    )
                ).length
            ).to.be.equal(0);

            expect(BigInt(afterBal)).to.be.equal(BigInt(beforeBal));
        });

        it("close ask and check", async function () {
            let beforeVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            await expect(
                this.OrderBook.connect(this.creator_1).closeBidAsk(
                    tradeId,
                    false
                )
            )
                .to.be.emit(this.OrderBook, "BidAskClosed")
                .withArgs(tradeId, false);
            let afterVoteInfo = await this.FractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );

            expect(
                BigInt(afterVoteInfo.unlistedVotesAmount) -
                    BigInt(beforeVoteInfo.unlistedVotesAmount)
            ).to.be.equal(BigInt(beforeVoteInfo.listedVotesAmount));

            expect(
                (await this.OrderBook.getAllBidAskByTokenId(tokenId, false))
                    .length
            ).to.be.equal(0);
        });
    });
});
