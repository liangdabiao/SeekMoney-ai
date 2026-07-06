import { NextResponse } from 'next/server';
import { jobManager } from '../../../../lib/services/job-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isDev = process.env.NODE_ENV !== 'production';
  const body: Record<string, unknown> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  if (isDev) {
    body.jobs = {
      stats: jobManager.getJobStats(),
      recentJobs: jobManager.getAllJobIds().slice(-10)
    };
  }

  return NextResponse.json(body, { status: 200 });
}
