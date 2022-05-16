import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";
import { Program } from "@project-serum/anchor";
import { Dutch } from "../target/types/dutch";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import assert from "assert";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("dutch", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
  const SYSVAR_RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;
  const MARGIN_OF_ERROR = 1.01;

  const program = anchor.workspace.Dutch as Program<Dutch>;

  const wallet1 = anchor.web3.Keypair.generate();
  const wallet2 = anchor.web3.Keypair.generate();
  let mint: PublicKey;
  let wallet1TokenAccount: spl.Account;

  const deriveAuctionAccountPDA = async (authority: PublicKey) => {
    const programAddress = await anchor.web3.PublicKey.findProgramAddress(
      [authority.toBuffer()],
      program.programId
    );
    return programAddress;
  };

  const delay = (milliseconds: number) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  };

  it("Initialization", async () => {
    /* INITIALIZE 2 WALLETS WITH 25 SOL */
    const signature1 = await program.provider.connection.requestAirdrop(
      wallet1.publicKey,
      25 * LAMPORTS_PER_SOL
    );

    await program.provider.connection.confirmTransaction(signature1);

    const signature2 = await program.provider.connection.requestAirdrop(
      wallet2.publicKey,
      25 * LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(signature2);

    const balance1 = await program.provider.connection.getBalance(
      wallet1.publicKey
    );
    assert(balance1 === 25000000000, "wallet1 incorrectly accredited");
    const balance2 = await program.provider.connection.getBalance(
      wallet2.publicKey
    );
    assert(balance2 === 25000000000, "wallet2 incorrectly accredited");

    /* CREATE A TOKEN AND MINT 20 TO WALLET 1 */
    mint = await spl.createMint(
      program.provider.connection,
      wallet1,
      wallet1.publicKey,
      undefined,
      0
    );
    wallet1TokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      wallet1.publicKey
    );
    await spl.mintTo(
      program.provider.connection,
      wallet1,
      mint,
      wallet1TokenAccount.address,
      wallet1.publicKey,
      20
    );

    // check that total supply is 20
    const supply = await program.provider.connection.getTokenSupply(mint);
    assert(supply.value.amount === "20");
    assert(supply.value.decimals === 0);

    // check that wallet1 holds all the tokens
    const tokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        wallet1.publicKey,
        { programId: spl.TOKEN_PROGRAM_ID }
      );
    const decodedTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data);
    });
    assert(decodedTokenAccounts[0].amount.toString() === "20");
  });

  it("Can initialize auction", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);
    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime), // now
        new anchor.BN(currentTime + 3600), // 1 hour from now
        1000000000, // 1 SOL starting price
        new anchor.BN(1), // 1 token
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount.address,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    /* ASSERTIONS BELOW */
    // Make sure that the values stored on the auction account are correct
    const account = await program.account.auctionAccount.fetch(
      auctionAccountPDA
    );
    assert(account.amount.toNumber() === 1, "Incorrect Token Amount");
    assert(
      account.authority.toBase58() === wallet1.publicKey.toBase58(),
      "Incorrect Authority"
    );
    assert(account.startingPrice === 1000000000, "Incorrect Starting Price");
    assert(
      account.startingTime.toNumber() == currentTime,
      "Incorrect Starting Time"
    );
    assert(
      account.endingTime.toNumber() == currentTime + 3600,
      "Incorrect Ending Time"
    );
    assert(account.bump == auctionAccountPDABump, "Incorrect Bump");

    // Check that the owner has been debited 1 token
    const tokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        wallet1.publicKey,
        { programId: spl.TOKEN_PROGRAM_ID }
      );
    const decodedOwnerTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data);
    });
    assert(
      decodedOwnerTokenAccounts[0].amount.toString() === "19",
      "Owner was not debited 1 token"
    );

    // Ensure that the auction account owns a token account holding 1 token
    const auctionTokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        auctionAccountPDA,
        { programId: spl.TOKEN_PROGRAM_ID }
      );
    const decodedTokenAccounts = auctionTokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data);
    });
    assert(
      decodedTokenAccounts[0].amount.toString() === "1",
      "Auction token account isn't holding the proper amount of tokens"
    );
  });

  it("Auction instantiator can close the auction.", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      auctionAccountPDA,
      true
    );

    await program.methods
      .closeAuction()
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        holderTokenAccount: wallet1TokenAccount.address,
        escrowTokenAccount: escrowTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    /* ASSERTIONS BELOW */
    // Check that the owner has received their token back
    const tokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        wallet1.publicKey,
        { programId: spl.TOKEN_PROGRAM_ID }
      );
    const decodedTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data);
    });
    assert(
      decodedTokenAccounts[0].amount.toString() === "20",
      "Owner did not receive their token back"
    );

    // Ensure that the auction token account is closed
    const auctionTokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        auctionAccountPDA,
        { programId: spl.TOKEN_PROGRAM_ID, mint: mint }
      );
    assert(
      auctionTokenAccounts.value.length === 0,
      "Auction token account is not closed"
    );

    // Ensure that the auction account is now closed
    try {
      await program.account.auctionAccount.fetch(auctionAccountPDA);
      assert(false, "Account does exist");
    } catch (e) {
      assert(
        e.message === "Account does not exist " + auctionAccountPDA.toBase58()
      );
    }
  });

  it("Can bid on an auction", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);
    const duration = 60; // 1 minute from now

    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime), // now
        new anchor.BN(currentTime + duration),
        1 * LAMPORTS_PER_SOL, // 1 SOL starting price
        new anchor.BN(1), // 1 token
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    const bidderTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet2,
      mint,
      wallet2.publicKey
    );

    const balance1Before = await program.provider.connection.getBalance(
      wallet1.publicKey
    );
    const balance2Before = await program.provider.connection.getBalance(
      wallet2.publicKey
    );
    const wait = 15;
    await delay(wait * 1000);

    await program.methods
      .bid()
      .accounts({
        authority: wallet2.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        bidderTokenAccount: bidderTokenAccount.address,
        auctionOwner: wallet1.publicKey,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet2])
      .rpc({ commitment: "confirmed" });

    /* ASSERTIONS BELOW */
    // Check that the adequate payment was made from wallet2 to wallet1
    const endTime = currentTime + wait;
    const expectedCost =
      LAMPORTS_PER_SOL -
      ((endTime - currentTime) / duration) * LAMPORTS_PER_SOL;

    const balance1After = await program.provider.connection.getBalance(
      wallet1.publicKey
    );
    const balance2After = await program.provider.connection.getBalance(
      wallet2.publicKey
    );

    console.log(
      "Expected Cost (lamports):    ",
      expectedCost,
      "\nWallet 1 Received:           ",
      balance1After - balance1Before,
      "\nWallet 2 Gave:               ",
      balance2Before - balance2After,
      "\nApproved Margin of Error:    ",
      `+/-${Math.round((MARGIN_OF_ERROR - 1) * 100)}%`,
      "\nWallet 1 Error:              ",
      Math.abs(
        (expectedCost - (balance1After - balance1Before)) / expectedCost
      ),
      "\nWallet 1 Error:              ",
      Math.abs((expectedCost - (balance2Before - balance2After)) / expectedCost)
    );
    assert(
      balance1After - balance1Before <= expectedCost * MARGIN_OF_ERROR,
      "Wallet 1 did not receive the proper funds"
    );
    assert(
      balance2Before - balance2After <= expectedCost * MARGIN_OF_ERROR,
      "Wallet 2 was not debited the proper amount"
    );

    // Check that wallet2 received the token
    const tokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        wallet2.publicKey,
        { programId: spl.TOKEN_PROGRAM_ID, mint: mint }
      );
    const decodedTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data);
    });
    assert(
      decodedTokenAccounts[0].amount.toString() === "1",
      "Purchaser did not receive the token"
    );

    // Ensure that the auction token account is closed
    const auctionTokenAccounts =
      await program.provider.connection.getTokenAccountsByOwner(
        auctionAccountPDA,
        { programId: spl.TOKEN_PROGRAM_ID, mint: mint }
      );
    assert(
      auctionTokenAccounts.value.length === 0,
      "Auction token account is not closed"
    );

    // Ensure that the auction account is now closed
    try {
      await program.account.auctionAccount.fetch(auctionAccountPDA);
      assert(false, "Account does exist");
    } catch (e) {
      assert(
        e.message === "Account does not exist " + auctionAccountPDA.toBase58()
      );
    }
  });

  it("Cannot bid on auction before it begins", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);

    // initialize an auction in the future
    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime + 1000), // a time in the future
        new anchor.BN(currentTime + 1001),
        1 * LAMPORTS_PER_SOL, // 1 SOL starting price
        new anchor.BN(1), // 1 token
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    const bidderTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet2,
      mint,
      wallet2.publicKey
    );

    // attempt to bid on the auction before it begins
    try {
      await program.methods
        .bid()
        .accounts({
          authority: wallet2.publicKey,
          auctionAccount: auctionAccountPDA,
          escrowTokenAccount: escrowTokenAccount,
          bidderTokenAccount: bidderTokenAccount.address,
          auctionOwner: wallet1.publicKey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet2])
        .rpc({ commitment: "confirmed" });
      assert(false, "Successfully bid");
    } catch (e) {
      assert(e.message.indexOf("Auction has not yet begun.") != -1);
    }

    // close auction for posterity
    await program.methods
      .closeAuction()
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        holderTokenAccount: wallet1TokenAccount.address,
        escrowTokenAccount: escrowTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });
  });

  it("Cannot bid on an auction after it ends", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);

    // initialize an auction
    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime),
        new anchor.BN(currentTime + 1), // a very short auction
        1 * LAMPORTS_PER_SOL,
        new anchor.BN(1),
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    const bidderTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet2,
      mint,
      wallet2.publicKey
    );

    await delay(2500); // wait 1.5 seconds - slightly more than the duration of the auction

    // attempt to bid on the auction after it has ended
    try {
      await program.methods
        .bid()
        .accounts({
          authority: wallet2.publicKey,
          auctionAccount: auctionAccountPDA,
          escrowTokenAccount: escrowTokenAccount,
          bidderTokenAccount: bidderTokenAccount.address,
          auctionOwner: wallet1.publicKey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet2])
        .rpc({ commitment: "confirmed" });
      assert(false, "Successfully bid");
    } catch (e) {
      assert(e.message.indexOf("Auction has concluded") != -1);
    }

    // close auction for posterity
    await program.methods
      .closeAuction()
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        holderTokenAccount: wallet1TokenAccount.address,
        escrowTokenAccount: escrowTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });
  });

  it("Cannot instantiate an auction with a start date in the past", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);

    // try to initialize an auction in the past
    try {
      await program.methods
        .initializeAuction(
          new anchor.BN(currentTime - 100), // a prehistoric auction
          new anchor.BN(currentTime + 1),
          1 * LAMPORTS_PER_SOL,
          new anchor.BN(1),
          auctionAccountPDABump
        )
        .accounts({
          authority: wallet1.publicKey,
          auctionAccount: auctionAccountPDA,
          escrowTokenAccount: escrowTokenAccount,
          holderTokenAccount: wallet1TokenAccount.address,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet1])
        .rpc({ commitment: "confirmed" });

      assert(false, "Successfully initialized auction");
    } catch (e) {
      assert(e.message.indexOf("Start date must occur in the future") != -1);
    }
  });

  it("Must provide valid date range for the auction", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);

    // try to initialize an auction with an invalid date range
    try {
      await program.methods
        .initializeAuction(
          new anchor.BN(currentTime + 100), // starts 100 seconds from now
          new anchor.BN(currentTime + 50), // ends 50 seconds from now
          1 * LAMPORTS_PER_SOL,
          new anchor.BN(1),
          auctionAccountPDABump
        )
        .accounts({
          authority: wallet1.publicKey,
          auctionAccount: auctionAccountPDA,
          escrowTokenAccount: escrowTokenAccount,
          holderTokenAccount: wallet1TokenAccount.address,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([wallet1])
        .rpc({ commitment: "confirmed" });

      assert(false, "Successfully initialized auction");
    } catch (e) {
      assert(e.message.indexOf("Start date must occur before end date") != -1);
    }
  });

  it("Auction can only be closed by the instantiator", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);

    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime),
        new anchor.BN(currentTime + 3600),
        1 * LAMPORTS_PER_SOL,
        new anchor.BN(1),
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

    try {
      await program.methods
        .closeAuction()
        .accounts({
          authority: wallet2.publicKey,   // wallet2 attempting to close wallet1's auction
          auctionAccount: auctionAccountPDA,
          holderTokenAccount: wallet1TokenAccount.address,
          escrowTokenAccount: escrowTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([wallet2])
        .rpc({ commitment: "confirmed" });

      assert(false, "Successfully closed auction");
    } catch (e) {
      assert(
        e.message.indexOf(
          "Close auction can only be called by the auction authority"
        ) != -1
      );
    }

    // close auction for posterity
    await program.methods
      .closeAuction()
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        holderTokenAccount: wallet1TokenAccount.address,
        escrowTokenAccount: escrowTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });
  });

  it("Must pass auction owner into bid", async () => {
    const [auctionAccountPDA, auctionAccountPDABump] =
      await deriveAuctionAccountPDA(wallet1.publicKey);
    const escrowTokenAccount = await getAssociatedTokenAddress(
      mint,
      auctionAccountPDA,
      true
    );

    const currentTime = Math.round(Date.now() / 1000);
    await program.methods
      .initializeAuction(
        new anchor.BN(currentTime),
        new anchor.BN(currentTime + 3600),
        1 * LAMPORTS_PER_SOL,
        new anchor.BN(1),
        auctionAccountPDABump
      )
      .accounts({
        authority: wallet1.publicKey,
        auctionAccount: auctionAccountPDA,
        escrowTokenAccount: escrowTokenAccount,
        holderTokenAccount: wallet1TokenAccount.address,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet1])
      .rpc({ commitment: "confirmed" });

      const bidderTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        wallet2,
        mint,
        wallet2.publicKey
      );

      try {
        await program.methods
          .bid()
          .accounts({
            authority: wallet2.publicKey,
            auctionAccount: auctionAccountPDA,
            escrowTokenAccount: escrowTokenAccount,
            bidderTokenAccount: bidderTokenAccount.address,
            auctionOwner: wallet2.publicKey,    // passing themselves in as the recipient
            mint: mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SYSTEM_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([wallet2])
          .rpc({ commitment: "confirmed" });
        assert(false, "Successfully bid");
      } catch (e) {
        assert(e.message.indexOf("Auction owner must match auction authority") != -1);
      }
  });
});
