import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';
import { Program } from '@project-serum/anchor';
import { Dutch } from '../target/types/dutch';
import { PublicKey } from "@solana/web3.js"
import assert from 'assert'
import { mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token';

describe('dutch', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const SYSTEM_PROGRAM_ID = anchor.web3.SystemProgram.programId;
  const SYSVAR_RENT_PUBKEY = anchor.web3.SYSVAR_RENT_PUBKEY;

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
  }

  const deriveEscrowTokenAccountPDA = async (mint: PublicKey) => {
    const programAddress = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), mint.toBuffer()],
      program.programId
    );
    return programAddress;
  }

  it('Initialization', async () => {
    /* INITIALIZE 2 WALLETS WITH 2.5 SOL */
    const signature1 = await program.provider.connection.requestAirdrop(
      wallet1.publicKey,
      25000000000
    );

    // assert(balance1 === 2)
    await program.provider.connection.confirmTransaction(signature1);

    const signature2 = await program.provider.connection.requestAirdrop(
      wallet2.publicKey,
      25000000000
    );
    await program.provider.connection.confirmTransaction(signature2);

    const balance1 = await program.provider.connection.getBalance(wallet1.publicKey)
    assert(balance1 === 25000000000)
    const balance2 = await program.provider.connection.getBalance(wallet2.publicKey)
    assert(balance2 === 25000000000)

    /* CREATE A TOKEN AND MINT 20 TO WALLET 1 */
    mint = await spl.createMint(
      program.provider.connection,
      wallet1,
      wallet1.publicKey,
      undefined,
      0
    )
    wallet1TokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      wallet1.publicKey,
    )
    await spl.mintTo(
      program.provider.connection,
      wallet1,
      mint,
      wallet1TokenAccount.address,
      wallet1.publicKey,
      20
    )

    // check that total supply is 20
    const supply = await program.provider.connection.getTokenSupply(mint)
    assert(supply.value.amount === '20')
    assert(supply.value.decimals === 0)

    // check that wallet1 holds all the tokens
    const tokenAccounts = await program.provider.connection.getTokenAccountsByOwner(
      wallet1.publicKey, 
      {programId: spl.TOKEN_PROGRAM_ID}
    )
    const decodedTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data)
    })
    assert(decodedTokenAccounts[0].amount.toString() === '20')
  })

  it('Can initialize auction', async () => {
    const [ auctionAccountPDA, auctionAccountPDABump ] = await deriveAuctionAccountPDA(wallet1.publicKey)
    const escrowTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      auctionAccountPDA,
      true
    )

    const currentTime = (Date.now() / 1000).toFixed(0);
    await program.methods.initializeAuction(
      new anchor.BN(currentTime),              // now
      new anchor.BN(currentTime + 3600),       // 1 hour from now
      1000000000,                              // 1 SOL starting price
      new anchor.BN(1),                        // 1 token
    ).accounts({
      authority: wallet1.publicKey,
      auctionAccount: auctionAccountPDA,
      escrowTokenAccount: escrowTokenAccount.address,
      holderTokenAccount: wallet1TokenAccount.address,
      mint: mint,
      tokenProgram: spl.TOKEN_PROGRAM_ID,
      associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    },
    ).signers([wallet1]).rpc();

    /* ASSERTIONS BELOW */
    // Make sure that the values stored on the auction account are correct
    const account = await program.account.auctionAccount.fetch(auctionAccountPDA)
    assert(account.amount.toNumber() === 1, 
      'Incorrect Token Amount')
    assert(account.authority.toBase58() === wallet1.publicKey.toBase58(), 
      'Incorrect Authority')
    assert(account.startingPrice === 1000000000, 
      'Incorrect Starting Price')
    assert(account.startingTime.toNumber() == currentTime, 
      'Incorrect Starting Time')
    assert(account.endingTime.toNumber() == (currentTime + 3600), 
      'Incorrect Ending Time')

    // Check that the owner has been debited 1 token
    const tokenAccounts = await program.provider.connection.getTokenAccountsByOwner(
      wallet1.publicKey, 
      {programId: spl.TOKEN_PROGRAM_ID}
    )
    const decodedOwnerTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data)
    })
    assert(decodedOwnerTokenAccounts[0].amount.toString() === '19', 
      'Owner was not debited 1 token')

    // Ensure that the auction account owns a token account holding 1 token
    const auctionTokenAccounts = await program.provider.connection.getTokenAccountsByOwner(
      auctionAccountPDA, 
      {programId: spl.TOKEN_PROGRAM_ID}
    )
    const decodedTokenAccounts = auctionTokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data)
    })
    assert(decodedTokenAccounts[0].amount.toString() === '1',
      'Auction token account isn\'t holding the proper amount of tokens')
  });

  it('Auction instantiator can close the auction.', async () => {
    const [ auctionAccountPDA, auctionAccountPDABump ] = await deriveAuctionAccountPDA(wallet1.publicKey)
    const escrowTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      wallet1,
      mint,
      auctionAccountPDA,
      true
    )

    await program.methods.closeAuction(auctionAccountPDABump).accounts({
      authority: wallet1.publicKey,
      auctionAccount: auctionAccountPDA,
      holderTokenAccount: wallet1TokenAccount.address,
      escrowTokenAccount: escrowTokenAccount.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).signers([wallet1]).rpc()

    /* ASSERTIONS BELOW */
    // Check that the owner has received their token back
    const tokenAccounts = await program.provider.connection.getTokenAccountsByOwner(
      wallet1.publicKey, 
      {programId: spl.TOKEN_PROGRAM_ID}
    )
    const decodedTokenAccounts = tokenAccounts.value.map((account) => {
      return spl.AccountLayout.decode(account.account.data)
    })
    assert(decodedTokenAccounts[0].amount.toString() === '20', 
      'Owner did not receive their token back')

    // Ensure that the auction token account is closed
    const auctionTokenAccounts = await program.provider.connection.getTokenAccountsByOwner(
      auctionAccountPDA, 
      {programId: spl.TOKEN_PROGRAM_ID}
    )
    assert(auctionTokenAccounts.value.length === 0, 
      'Auction token account is not closed')

    // Ensure that the auction account is now closed
    try {
      await program.account.auctionAccount.fetch(auctionAccountPDA);
      assert(false, 'Account does exist')
    } catch (e) {
      assert(e.message === ('Account does not exist ' + auctionAccountPDA.toBase58()))
    }
  })
});
