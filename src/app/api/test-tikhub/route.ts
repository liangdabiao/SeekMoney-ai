// 测试 TikHub API 连接 - 仅在开发环境可用
import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = process.env.TIKHUB_API_TOKEN || process.env.TIKHUB_API_KEY;
  if (!token) {
    return NextResponse.json({
      success: false,
      error: 'TIKHUB_API_TOKEN 未设置'
    }, { status: 400 });
  }

  console.log('[Test API] 开始测试 TikHub API');
  console.log('[Test API] Token:', token.substring(0, 6) + '...');

  try {
    // 测试 1: 直接使用 axios
    console.log('[Test API] 测试 1: 直接 axios.post');
    const response1 = await axios.post('https://api.tikhub.io/api/v1/douyin/search/fetch_general_search_v1', {
      keyword: '猫咪',
      cursor: 0,
      sort_type: '0',
      publish_time: '0',
      filter_duration: '0',
      content_type: '1',
      search_id: '',
      backtrace: ''
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('[Test API] ✅ 测试 1 成功');

    // 测试 2: 使用 axios 实例
    console.log('[Test API] 测试 2: axios.create 实例');
    const client = axios.create({
      baseURL: 'https://api.tikhub.io',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const response2 = await client.post('/api/v1/douyin/search/fetch_general_search_v1', {
      keyword: 'test',
      cursor: 0,
      sort_type: '0',
      publish_time: '0',
      filter_duration: '0',
      content_type: '1',
      search_id: '',
      backtrace: ''
    });

    console.log('[Test API] ✅ 测试 2 成功');

    return NextResponse.json({
      success: true,
      message: 'TikHub API 连接正常',
      test1: {
        status: response1.status,
        code: response1.data.code,
        hasData: !!response1.data.data
      },
      test2: {
        status: response2.status,
        code: response2.data.code,
        hasData: !!response2.data.data
      }
    });

  } catch (error: any) {
    console.error('[Test API] ❌ 测试失败');
    console.error('[Test API] 错误详情:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });

    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    }, { status: 500 });
  }
}
