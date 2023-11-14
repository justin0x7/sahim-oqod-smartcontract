const { expect } = require("chai");
const { ethers } = require("hardhat");

const { deploy, bigNum, smallNum } = require("../scripts/utils");

describe("FractionalNFT test", function () {
    before(async function () {
        [this.deployer, this.creator_1, this.buyer_1, this.orderBook] =
            await ethers.getSigners();

        this.fractionalNFT = await deploy("FractionalNFT", "FractionalNFT");
    });

    it("check deployment", async function () {
        console.log("deployed successfully!");
    });

    it("check basic values", async function () {
        expect(await this.fractionalNFT.symbol()).to.be.equal("SNFT");
        expect(await this.fractionalNFT.name()).to.be.equal("Sahim NFT");
    });

    it("mint NFT and check", async function () {
        let metaData = "test NFT - 1";
        let expectTokenId = 1;

        await this.fractionalNFT.connect(this.creator_1).mintNFT(metaData);
        await expect(
            this.fractionalNFT.ownerOf(expectTokenId)
        ).to.be.revertedWith("invalid tokenId");
        await expect(
            this.fractionalNFT.getAllOwners(expectTokenId)
        ).to.be.revertedWith("invalid tokenId");
        expect(
            (
                await this.fractionalNFT.getAllOwnedTokenIds(
                    this.creator_1.address
                )
            ).length
        ).to.be.equal(0);
        expect(
            await this.fractionalNFT.balanceOf(this.creator_1.address)
        ).to.be.equal(0);
        expect(await this.fractionalNFT.tokenURI(expectTokenId)).to.be.equal(
            metaData
        );
    });

    describe("enable NFT", function () {
        let tokenId = 1;
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.fractionalNFT.connect(this.creator_1).enableNFT(tokenId)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if tokenId is invalid", async function () {
            await expect(this.fractionalNFT.enableNFT(10)).to.be.revertedWith(
                "invalid tokenId"
            );
        });

        it("enable NFT and check", async function () {
            await this.fractionalNFT.enableNFT(tokenId);

            expect(await this.fractionalNFT.ownerOf(tokenId)).to.be.equal(
                this.creator_1.address
            );

            let allOwners = await this.fractionalNFT.getAllOwners(tokenId);
            expect(allOwners.length).to.be.equal(1);
            expect(allOwners[0]).to.be.equal(this.creator_1.address);

            let allTokenIds = await this.fractionalNFT.getAllOwnedTokenIds(
                this.creator_1.address
            );
            expect(allTokenIds.length).to.be.equal(1);
            expect(allTokenIds[0]).to.be.equal(tokenId);

            expect(
                await this.fractionalNFT.balanceOf(this.creator_1.address)
            ).to.be.equal(1);
        });

        it("reverts if NFT is already enabled", async function () {
            await expect(
                this.fractionalNFT.enableNFT(tokenId)
            ).to.be.revertedWith("already enabled");
        });
    });

    describe("setOrderBook", function () {
        it("reverts if caller is not the owner", async function () {
            await expect(
                this.fractionalNFT
                    .connect(this.creator_1)
                    .setOrderBook(this.orderBook.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("reverts if orderBook address is zero", async function () {
            await expect(
                this.fractionalNFT.setOrderBook(ethers.constants.AddressZero)
            ).to.be.revertedWith("invalid orderBook address");
        });

        it("setOrderBook", async function () {
            await expect(
                this.fractionalNFT.setOrderBook(this.orderBook.address)
            )
                .to.be.emit(this.fractionalNFT, "OrderBookSet")
                .withArgs(this.orderBook.address);
        });
    });

    describe("open trading", function () {
        let tokenId = 1;
        let votesAmount = 1000;
        let price;
        it("reverts if caller is not OrderBook", async function () {
            price = bigNum(50, 3);
            await expect(
                this.fractionalNFT.openTrading(
                    this.creator_1.address,
                    tokenId,
                    BigInt(price),
                    votesAmount
                )
            ).to.be.revertedWith("Ownable: caller is not the orderBook");
        });

        it("reverts if tokenId is invalid", async function () {
            await expect(
                this.fractionalNFT
                    .connect(this.orderBook)
                    .openTrading(
                        this.creator_1.address,
                        10,
                        BigInt(price),
                        votesAmount
                    )
            ).to.be.revertedWith("invalid tokenId");
        });

        it("reverts if voteAmount is bigger than owned", async function () {
            await expect(
                this.fractionalNFT
                    .connect(this.orderBook)
                    .openTrading(
                        this.creator_1.address,
                        tokenId,
                        BigInt(price),
                        2000
                    )
            ).to.be.revertedWith("not enough votes amount to trade");
        });

        it("open trading and check", async function () {
            let beforeVoteInfo = await this.fractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            await this.fractionalNFT
                .connect(this.orderBook)
                .openTrading(
                    this.creator_1.address,
                    tokenId,
                    BigInt(price),
                    votesAmount
                );
            let afterVoteInfo = await this.fractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            expect(
                afterVoteInfo.listedVotesAmount -
                    beforeVoteInfo.listedVotesAmount
            ).to.be.equal(votesAmount);
            expect(
                beforeVoteInfo.unlistedVotesAmount -
                    afterVoteInfo.unlistedVotesAmount
            ).to.be.equal(votesAmount);
            let priceInfo = await this.fractionalNFT.prices(tokenId);
            let expectTotalPrice = BigInt(price) * BigInt(votesAmount);
            let expectAveragePrice = BigInt(expectTotalPrice) / BigInt(1000);
            expect(priceInfo.totalPrice).to.be.equal(expectTotalPrice);
            expect(priceInfo.averagePrice).to.be.equal(expectAveragePrice);
        });
    });

    describe("update price", function () {
        let tokenId = 1;
        let price = bigNum(52, 3); // $52
        let votesAmount = 50;
        it("reverts if caller is not orderBook", async function () {
            await expect(
                this.fractionalNFT.updatePrices(
                    tokenId,
                    BigInt(price),
                    votesAmount
                )
            ).to.be.revertedWith("Ownable: caller is not the orderBook");
        });

        it("reverts if tokenId is invalid", async function () {
            await expect(
                this.fractionalNFT
                    .connect(this.orderBook)
                    .updatePrices(10, BigInt(price), votesAmount)
            ).to.be.revertedWith("invalid tokenId");
        });

        it("updatePrices and check", async function () {
            let beforePrice = await this.fractionalNFT.prices(tokenId);
            await this.fractionalNFT
                .connect(this.orderBook)
                .updatePrices(tokenId, BigInt(price), votesAmount);
            let afterPrice = await this.fractionalNFT.prices(tokenId);
            let expectTotalPrice =
                BigInt(beforePrice.totalPrice) -
                BigInt(votesAmount) * BigInt(beforePrice.averagePrice) +
                BigInt(votesAmount) * BigInt(price);
            let expectAveragePrice = BigInt(expectTotalPrice) / BigInt(1000);
            expect(BigInt(afterPrice.totalPrice)).to.be.equal(
                BigInt(expectTotalPrice)
            );
            expect(BigInt(afterPrice.averagePrice)).to.be.equal(
                BigInt(expectAveragePrice)
            );
        });
    });

    describe("tradeVotes", function () {
        let tokenId = 1;
        let votesAmount = 60;
        let price = bigNum(53, 3);
        it("reverts if caller is not orderBook", async function () {
            await expect(
                this.fractionalNFT.tradeVotes(
                    this.creator_1.address,
                    this.buyer_1.address,
                    tokenId,
                    price,
                    votesAmount
                )
            ).to.be.revertedWith("Ownable: caller is not the orderBook");
        });

        it("tradeVotes and check", async function () {
            let beforePrice = await this.fractionalNFT.prices(tokenId);
            let beforeVoteInfo = await this.fractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            let beforeOwners = await this.fractionalNFT.getAllOwners(tokenId);
            await this.fractionalNFT
                .connect(this.orderBook)
                .tradeVotes(
                    this.creator_1.address,
                    this.buyer_1.address,
                    tokenId,
                    price,
                    votesAmount
                );
            let afterPrice = await this.fractionalNFT.prices(tokenId);
            let afterVoteInfo = await this.fractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            let afterOwners = await this.fractionalNFT.getAllOwners(tokenId);

            let expectTotalPrice =
                BigInt(beforePrice.totalPrice) -
                BigInt(votesAmount) * BigInt(beforePrice.averagePrice) +
                BigInt(votesAmount) * BigInt(price);
            let expectAveragePrice = BigInt(expectTotalPrice) / BigInt(1000);

            expect(BigInt(afterPrice.totalPrice)).to.be.equal(
                BigInt(expectTotalPrice)
            );
            expect(BigInt(afterPrice.averagePrice)).to.be.equal(
                BigInt(expectAveragePrice)
            );

            expect(
                beforeVoteInfo.ownedVotesAmount - afterVoteInfo.ownedVotesAmount
            ).to.be.equal(votesAmount);
            expect(
                beforeVoteInfo.listedVotesAmount -
                    afterVoteInfo.listedVotesAmount
            ).to.be.equal(votesAmount);

            expect(afterOwners.length - beforeOwners.length).to.be.equal(1);
            expect(afterOwners[1]).to.be.equal(this.buyer_1.address);
            expect(await this.fractionalNFT.ownerOf(tokenId)).to.be.equal(
                ethers.constants.AddressZero
            );
        });

        it("buy all listed amounts", async function () {
            let beforeOwners = await this.fractionalNFT.getAllOwners(tokenId);
            let beforeVoteInfo = await this.fractionalNFT.votesInfo(
                tokenId,
                this.creator_1.address
            );
            votesAmount = beforeVoteInfo.listedVotesAmount;
            let beforeOwnedTokenIds =
                await this.fractionalNFT.getAllOwnedTokenIds(
                    this.creator_1.address
                );

            await this.fractionalNFT
                .connect(this.orderBook)
                .tradeVotes(
                    this.creator_1.address,
                    this.buyer_1.address,
                    tokenId,
                    price,
                    votesAmount
                );

            let afterOwners = await this.fractionalNFT.getAllOwners(tokenId);
            let afterOwnedTokenIds =
                await this.fractionalNFT.getAllOwnedTokenIds(
                    this.creator_1.address
                );

            expect(beforeOwners.length - afterOwners.length).to.be.equal(1);
            expect(
                beforeOwnedTokenIds.length - afterOwnedTokenIds.length
            ).to.be.equal(1);
        });
    });
});
