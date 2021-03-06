export type Dutch = {
  "version": "0.1.0",
  "name": "dutch",
  "instructions": [
    {
      "name": "initializeAuction",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "holderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "startingTime",
          "type": "i64"
        },
        {
          "name": "endingTime",
          "type": "i64"
        },
        {
          "name": "startPrice",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeAuction",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "holderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "bid",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bidderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "auctionOwner",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "auctionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "startingPrice",
            "type": "u32"
          },
          {
            "name": "startingTime",
            "type": "i64"
          },
          {
            "name": "endingTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ProxyClose",
      "msg": "Close auction can only be called by the auction authority"
    },
    {
      "code": 6001,
      "name": "AuctionEarly",
      "msg": "Auction has not yet begun"
    },
    {
      "code": 6002,
      "name": "AuctionLate",
      "msg": "Auction has concluded"
    },
    {
      "code": 6003,
      "name": "InvalidDateRange",
      "msg": "Start date must occur before end date"
    },
    {
      "code": 6004,
      "name": "InvalidStartDate",
      "msg": "Start date must occur in the future"
    },
    {
      "code": 6005,
      "name": "MismatchedOwners",
      "msg": "Auction owner must match auction authority"
    }
  ]
};

export const IDL: Dutch = {
  "version": "0.1.0",
  "name": "dutch",
  "instructions": [
    {
      "name": "initializeAuction",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "holderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "startingTime",
          "type": "i64"
        },
        {
          "name": "endingTime",
          "type": "i64"
        },
        {
          "name": "startPrice",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeAuction",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "holderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "bid",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "auctionAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrowTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bidderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "auctionOwner",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "auctionAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "startingPrice",
            "type": "u32"
          },
          {
            "name": "startingTime",
            "type": "i64"
          },
          {
            "name": "endingTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ProxyClose",
      "msg": "Close auction can only be called by the auction authority"
    },
    {
      "code": 6001,
      "name": "AuctionEarly",
      "msg": "Auction has not yet begun"
    },
    {
      "code": 6002,
      "name": "AuctionLate",
      "msg": "Auction has concluded"
    },
    {
      "code": 6003,
      "name": "InvalidDateRange",
      "msg": "Start date must occur before end date"
    },
    {
      "code": 6004,
      "name": "InvalidStartDate",
      "msg": "Start date must occur in the future"
    },
    {
      "code": 6005,
      "name": "MismatchedOwners",
      "msg": "Auction owner must match auction authority"
    }
  ]
};
