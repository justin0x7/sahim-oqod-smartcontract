# Sahim Contracts

This project is type of fractional NFT for real estate.

## Mint NFT (mean that list a property)

When mint NFT, creator should determine if NFT will be listed for trading just after NFT minted.
If creator doesn't want to trade, anyone can't buy NFT ownerships.
Btw, when mint NFT, 1000 pieces of ownership will be minted and send to creator at first.
But if creator made a choice that NFT can be traded, creator should input initial price for each piece.
for example, if the creator set initial piece price as $5, whole NFT price will be $5,000.
While trading, NFT price will be changed.
taking a simple example.
creator listed NFT as $,5000(piece price is $5) then buyer bought 200 pieces as $1200(piece price $6). then NFT total price will be changed to $5200.

## Trade

Piece is virutal number, not real asset.
Owner who has whole ownership can open/close trading.
But it's possible when only has whole ownership.
Owner can also trade only part of pieces, not whole pieces.

## Profits distribution

Each owners will get profits based on owned amount of pieces.
formula is: profit = total_profit \* owned_pieces / total_pieces.

But I wonder how will profit happened?
investors will deposit? or how?

I leave my opinions and also questions too.
Plz check and let me know your opinion.
If you agree with me, I will build smart contracts with above requirements.
