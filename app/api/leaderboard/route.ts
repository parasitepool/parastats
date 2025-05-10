import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formatAddress } from '@/app/utils/formatters';

interface BaseUser {
  id: number;
  address: string;
  authorised_at: number;
}

interface DifficultyUser extends BaseUser {
  diff: number;
  created_at: number;
}

interface LoyaltyUser extends BaseUser {
  bestever: number;
  created_at: number;
}

interface CombinedUser extends BaseUser {
  diff: number;
  diff_rank: number;
  loyalty_rank: number;
  combined_score: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'combined';
    const limit = parseInt(searchParams.get('limit') || '9', 10);
    
    const db = getDb();
    
    let users;
    
    switch (type) {
      case 'difficulty':
        users = db.prepare(`
          SELECT 
            id,
            address,
            bestever as diff,
            authorised_at,
            created_at
          FROM monitored_users 
          WHERE is_active = 1 AND is_public = 1 AND authorised_at != 0
          ORDER BY bestever DESC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as DifficultyUser),
          address: formatAddress((user as DifficultyUser).address)
        }));
        break;
        
      case 'loyalty':
        users = db.prepare(`
          SELECT 
            id,
            address,
            authorised_at,
            created_at,
            bestever
          FROM monitored_users 
          WHERE is_active = 1 AND is_public = 1 AND authorised_at != 0
          ORDER BY authorised_at ASC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as LoyaltyUser),
          address: formatAddress((user as LoyaltyUser).address)
        }));
        break;
        
      case 'combined':
      default:
        users = db.prepare(`
          WITH RankedUsers AS (
            SELECT 
              id,
              address,
              bestever,
              authorised_at,
              RANK() OVER (ORDER BY bestever DESC) as diff_rank,
              RANK() OVER (ORDER BY authorised_at ASC) as loyalty_rank
            FROM monitored_users
            WHERE is_active = 1 AND is_public = 1 AND authorised_at != 0
          )
          SELECT 
            id,
            address,
            bestever as diff,
            authorised_at,
            diff_rank,
            loyalty_rank,
            (diff_rank + loyalty_rank) / 2.0 as combined_score
          FROM RankedUsers
          ORDER BY combined_score ASC
          LIMIT ?
        `).all(limit).map((user: unknown) => ({
          ...(user as CombinedUser),
          address: formatAddress((user as CombinedUser).address)
        }));
        break;
    }
    
    return NextResponse.json(users);
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
