// 测试环境变量加载 - 仅在开发环境可用
import { NextResponse } from 'next/server';
import { createTikHubClient } from '../../../../lib/services/tikhub-client';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  console.log('=== 环境变量测试 ===');

  const result: any = {
    env: {
      TIKHUB_API_TOKEN: process.env.TIKHUB_API_TOKEN ? '已设置' : '未设置',
      TIKHUB_API_KEY: process.env.TIKHUB_API_KEY ? '已设置' : '未设置',
      GLM_API_KEY: process.env.GLM_API_KEY ? '已设置' : '未设置',
      NODE_ENV: process.env.NODE_ENV,
    },
    tests: []
  };

  // 测试 1: 直接使用环境变量
  console.log('\n测试 1: 直接使用 process.env.TIKHUB_API_TOKEN');
  try {
    const token = process.env.TIKHUB_API_TOKEN || process.env.TIKHUB_API_KEY;
    if (!token) {
      throw new Error('TIKHUB_API_TOKEN 未设置');
    }
    const response = await axios.post('https://api.tikhub.io/api/v1/douyin/search/fetch_general_search_v1', {
      keyword: 'test',
      cursor: 0
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000
    });
    result.tests.push({ name: '直接 env Token', success: true, code: response.status });
    console.log('✅ 成功');
  } catch (error: any) {
    result.tests.push({ name: '直接 env Token', success: false, error: error.message });
    console.log('❌ 失败:', error.message);
  }

  // 测试 2: 使用 createTikHubClient
  console.log('\n测试 2: 使用 createTikHubClient()');
  try {
    const client = createTikHubClient();
    const response = await client.searchVideos({ keyword: 'test', cursor: 0 });
    result.tests.push({ name: 'createTikHubClient', success: true, code: response.code });
    console.log('✅ 成功');
  } catch (error: any) {
    result.tests.push({ name: 'createTikHubClient', success: false, error: error.message });
    console.log('❌ 失败:', error.message);
  }

  // 测试 3: 使用 TikHubService
  console.log('\n测试 3: 使用 TikHubService');
  try {
    const { TikHubServiceAdapter } = await import('../../../../lib/services/tikhub-service');
    const service = new TikHubServiceAdapter();
    const result_svc = await service.searchAndFetch('test', 10);
    result.tests.push({ name: 'TikHubService', success: true, count: result_svc.videos.length });
    console.log('✅ 成功');
  } catch (error: any) {
    result.tests.push({ name: 'TikHubService', success: false, error: error.message });
    console.log('❌ 失败:', error.message);
  }

  return NextResponse.json(result);
}
