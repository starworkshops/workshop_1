use anchor_lang::prelude::*;

declare_id!("83JMuQzHAheSc9dMFaH4WcyPM4mo2jzmyDSAkR4HVbP4");

#[program]
pub mod solana_content_seal {
    use super::*;

    pub fn initialize_seal(
        ctx: Context<InitializeSeal>,
        content_hash: [u8; 32],
    ) -> Result<()> {
        let seal = &mut ctx.accounts.seal;
        seal.author = ctx.accounts.author.key();
        seal.content_hash = content_hash;
        seal.version = 1;
        seal.updated_at = Clock::get()?.unix_timestamp;
        seal.bump = ctx.bumps.seal;

        emit!(ContentSealed {
            author: seal.author,
            content_hash,
            version: seal.version,
        });
        Ok(())
    }

    pub fn update_seal(ctx: Context<UpdateSeal>, content_hash: [u8; 32]) -> Result<()> {
        let seal = &mut ctx.accounts.seal;
        seal.content_hash = content_hash;
        seal.version = seal
            .version
            .checked_add(1)
            .ok_or(ContentSealError::VersionOverflow)?;
        seal.updated_at = Clock::get()?.unix_timestamp;

        emit!(ContentSealed {
            author: seal.author,
            content_hash,
            version: seal.version,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeSeal<'info> {
    #[account(
        init,
        payer = author,
        space = ContentSeal::SPACE,
        seeds = [b"seal", author.key().as_ref()],
        bump
    )]
    pub seal: Account<'info, ContentSeal>,

    #[account(mut)]
    pub author: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSeal<'info> {
    #[account(
        mut,
        has_one = author,
        seeds = [b"seal", author.key().as_ref()],
        bump = seal.bump
    )]
    pub seal: Account<'info, ContentSeal>,

    pub author: Signer<'info>,
}

#[account]
pub struct ContentSeal {
    pub author: Pubkey,
    pub content_hash: [u8; 32],
    pub version: u64,
    pub updated_at: i64,
    pub bump: u8,
}

impl ContentSeal {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[event]
pub struct ContentSealed {
    pub author: Pubkey,
    pub content_hash: [u8; 32],
    pub version: u64,
}

#[error_code]
pub enum ContentSealError {
    #[msg("La versión alcanzó su valor máximo")]
    VersionOverflow,
}
