# Dutch Token Auction
### Install Instructions
Clone the repository and run `yarn` to install `node_modules`.

### General Information
This program is an Anchor implementation of the Dutch Auction, where the auction is instantiated with a start date, end date and starting price. The current price decreases linearly over the duration of the auction from the starting price to zero. This implementation auctions a token (or tokens). 

### Test Suite
| Test | Purpose | Notes |
|------|---------|-------|
|Initialization | Establishes two wallets, funds them, and mints tokens to `wallet1`. These tokens are the 'assets' that will be auctioned. | Isn't a test, rather establishes the testing environment.|
| Can initialize auction | `wallet1` instantiates an auction using the `initialize_auction` method. | 
|Auction instantiator can close the auction. | Closes the auction account using the `close_auction` method. Returns the token back to the instantiator of the auction and refunds rent exemption.| |
|Can bid on an auction| `wallet2` bids on a 1 minute auction after 15 seconds. | Margin of error set to 5% to account for transaction fees, refunding rent, etc.|
|Cannot bid on auction before it begins| Checks constraint for bidding on an auction before it starts | |
|Cannot bid on an auction after it ends| Checks constraint for bidding on an auction after it ends||
|Cannot instantiate an auction with a start date in the past| Checks constraint that auction must start after initialization| |
|Must provide valid date range for the auction| Checks constraint that start date must precede end date| |
|Auction can only be closed by the instantiator| Checks constraint that only the instantiator of the auction can close it| |
|Must pass auction owner into bid| Checks constraint that bids must be sent to the instantiator of the auction, rather than another wallet| |