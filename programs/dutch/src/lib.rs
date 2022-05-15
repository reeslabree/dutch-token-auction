use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        Mint, Token, TokenAccount, transfer, Transfer
    }
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const ESCROW_SEED: &[u8] = b"escrow";

#[program]
pub mod dutch {
    use super::*;
    // initialize an auction
    pub fn initialize_auction(
        ctx: Context<InitializeAuction>, 
        starting_time: i64, 
        ending_time: i64, 
        start_price: u32,
        amount: u64,
    ) -> Result<()> {
        let auction_account: &mut Account<AuctionAccount> = &mut ctx.accounts.auction_account; 

        auction_account.authority = ctx.accounts.authority.key();
        auction_account.starting_price = start_price;
        auction_account.starting_time = starting_time;
        auction_account.ending_time = ending_time;
        auction_account.amount = amount;

        transfer(
            ctx.accounts.into_transfer_ctx(),
            // .with_signer(&[&[ctx.accounts.auction_account.key().as_ref()]]), 
            amount
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(starting_time: i64, ending_time: i64, start_price: u32, amount: u32,)]
pub struct InitializeAuction<'info> {
    #[account(mut)]
    authority: Signer<'info>,
    #[account(
        init, 
        payer = authority, 
        seeds = [authority.key().as_ref()],
        bump,
        space = AuctionAccount::LEN
    )]
    auction_account: Account<'info, AuctionAccount>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = auction_account,
    )]
    escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    holder_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeAuction<'info> {
    fn into_transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            authority: self.authority.to_account_info(),
            from: self.holder_token_account.to_account_info(),
            to: self.escrow_token_account.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[account]
pub struct AuctionAccount {
    authority: Pubkey,
    amount: u64,
    starting_price: u32,
    starting_time: i64,
    ending_time: i64,
}

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const TIMESTAMP_LENGTH: usize = 8;
const U32_LENGTH: usize = 4;
const U64_LENGTH: usize = 8;

impl AuctionAccount {
    const LEN: usize = 
        DISCRIMINATOR_LENGTH    // discriminator
        + PUBLIC_KEY_LENGTH     // authority
        + TIMESTAMP_LENGTH      // starting time
        + TIMESTAMP_LENGTH      // ending time
        + U32_LENGTH            // starting price
        + U64_LENGTH;           // amount
}