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
    interface MonitoredUser {
      id: number;
      address: string;
      is_active: number;
      is_public: number;
      failed_attempts: number;
      created_at: number;
      updated_at: number;
      authorised_at: number;
    }

    const existingUser = db.prepare('SELECT * FROM monitored_users WHERE address = ?').get(address) as MonitoredUser | undefined;

    if (existingUser) {
      // If user exists but was inactive, reactivate them and reset failed attempts
      if (!existingUser.is_active) {
        db.prepare(`
          UPDATE monitored_users 
          SET 
            is_active = 1,
            failed_attempts = 0,
            updated_at = ?
          WHERE address = ?
        `).run(now, address);

        return NextResponse.json(
          { message: 'Address reactivated' },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { message: 'Address already being monitored' },
        { status: 200 }
      );
    }

    // Check rate limiting (max 10 new users per minute)
    const oneMinuteAgo = now - (1 * 60);
    const recentUsersCount = db.prepare(
      'SELECT COUNT(*) as count FROM monitored_users WHERE created_at > ?'
    ).get(oneMinuteAgo) as { count: number };
    let numMaxAdds = 10;
    const autoDiscoverEnabled = process.env.AUTO_DISCOVER_USERS !== 'false';
    if (autoDiscoverEnabled) {
      numMaxAdds = 110; // Higher limit if auto-discovery is enabled
    }

    if (recentUsersCount.count >= numMaxAdds) {
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