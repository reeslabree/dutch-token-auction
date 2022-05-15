use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        Mint, 
        Token, 
        TokenAccount, 
        transfer, 
        Transfer, 
        close_account as close_token_account, 
        CloseAccount as CloseTokenAccount
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
        // set the auction account data
        let auction_account: &mut Account<AuctionAccount> = &mut ctx.accounts.auction_account; 
        auction_account.authority = ctx.accounts.authority.key();
        auction_account.starting_price = start_price;
        auction_account.starting_time = starting_time;
        auction_account.ending_time = ending_time;
        auction_account.amount = amount;

        // transfer token(s) from the owner to the auction-owned token account
        transfer(
            ctx.accounts.into_transfer_ctx(),
            amount
        )?;

        Ok(())
    }

    // allow the auction initializer to close the auction
    pub fn close_auction(
        ctx: Context<CloseAuction>,
        bump: u8,
    ) -> Result<()> {
        // transfer the token(s) to the owner
        let transfer_ctx = ctx.accounts.clone();
        let authority_key = ctx.accounts.authority.key();
        transfer(
            transfer_ctx.into_transfer_ctx()
            .with_signer(&[&[authority_key.as_ref(), &[bump]]]),
            ctx.accounts.auction_account.amount, 
        )?;

        // close the token account
        let close_token_ctx = ctx.accounts.clone();
        close_token_account(
            close_token_ctx.into_close_account_ctx()
            .with_signer(&[&[authority_key.as_ref(), &[bump]]]),
        )?;

        // close the auction account
        ctx.accounts.auction_account.close(ctx.accounts.authority.to_account_info())?;

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

#[derive(Accounts, Clone)]
#[instruction(bump: u8)]
pub struct CloseAuction<'info> {
    #[account(mut)]
    authority: Signer<'info>,
    #[account(mut)]
    auction_account: Account<'info, AuctionAccount>,
    #[account(mut)]
    holder_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    escrow_token_account: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
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

impl<'info> CloseAuction<'info> {
    fn into_transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Transfer {
            authority: self.auction_account.to_account_info(),
            from: self.escrow_token_account.to_account_info(),
            to: self.holder_token_account.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }

    fn into_close_account_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseTokenAccount<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = CloseTokenAccount {
            account: self.escrow_token_account.to_account_info(),
            authority: self.auction_account.to_account_info(),
            destination: self.authority.to_account_info(),
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