import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isValidBitcoinAddress } from '@/app/utils/validators';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM monitored_users WHERE address = ?').get(address);

    if (existingUser) {
      return NextResponse.json(
        { message: 'Address already being monitored' },
        { status: 200 }
      );
    }

    // Check rate limiting (max 10 new users per 3 minutes)
    const threeMinutesAgo = now - (3 * 60);
    const recentUsersCount = db.prepare(
      'SELECT COUNT(*) as count FROM monitored_users WHERE created_at > ?'
    ).get(threeMinutesAgo) as { count: number };

    if (recentUsersCount.count >= 10) {
      return NextResponse.json(
        { error: 'Too many addresses added recently, please try again later.' },
        { status: 429 }
      );
    }

    // Add new user
    const stmt = db.prepare(`
      INSERT INTO monitored_users (
        address,
        is_active,
        is_public,
        created_at,
        updated_at,
        authorised_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      address,
      1,  // is_active
      1,  // is_public
      now,
      now,
      now  // authorised_at
    );

    console.log(`Added new address to monitor: ${address}`);

    return NextResponse.json({
      message: 'Address added successfully',
      address: address,
      created_at: now
    });

  } catch (error) {
    console.error('Error adding address:', error);
    
    // Check for unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: 'Address already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 