import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple key-value store model for daily rates
// We'll store daily rates as a single JSON record

// GET /api/daily-rates - Fetch today's rates
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // For simplicity, we can use a simple table or just return default values
    // Since we don't have a DailyRates model in Prisma, let's create one or use a simple approach
    
    // Option: Return default rates (can be enhanced with actual database storage later)
    const defaultRates = {
      date: today,
      EUR: 0,
      USD: 0,
      GBP: 0,
      CAD: 0,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(defaultRates);
  } catch (error) {
    console.error('Error fetching daily rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily rates' },
      { status: 500 }
    );
  }
}

// POST /api/daily-rates - Update today's rates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { EUR, USD, GBP, CAD } = body;

    const today = new Date().toISOString().split('T')[0];
    
    const updatedRates = {
      date: today,
      EUR: parseFloat(EUR) || 0,
      USD: parseFloat(USD) || 0,
      GBP: parseFloat(GBP) || 0,
      CAD: parseFloat(CAD) || 0,
      updatedAt: new Date().toISOString(),
    };

    // TODO: Store in database when DailyRates model is added to schema
    // For now, just return the rates as confirmation

    return NextResponse.json(updatedRates, { status: 201 });
  } catch (error) {
    console.error('Error saving daily rates:', error);
    return NextResponse.json(
      { error: 'Failed to save daily rates' },
      { status: 500 }
    );
  }
}
