// 调试 TikHub 调用 - 仅在开发环境可用
import { NextResponse } from 'next/server';
import { DataSourceFactory } from '../../../../lib/services/data-source-factory';
import type { DataSourceType } from '../../../../lib/services/data-source-interface';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result: any = { steps: [] };

  // 步骤 1: 创建数据源
  try {
    console.log('\n=== 步骤 1: 创建数据源 ===');
    const dataSource: DataSourceType = 'tikhub';
    DataSourceFactory.createDataSource(dataSource);
    result.steps.push({ name: '创建数据源', success: true });
    console.log('✅ 数据源创建成功');
  } catch (error: any) {
    result.steps.push({ name: '创建数据源', success: false, error: error.message });
    console.log('❌ 创建数据源失败:', error);
    return NextResponse.json({ ...result, error: '创建数据源失败' });
  }

  // 步骤 2: 检查可用性
  try {
    console.log('\n=== 步骤 2: 检查可用性 ===');
    const service = DataSourceFactory.createDataSource('tikhub');
    if (typeof service.checkAvailability !== 'function') {
      throw new Error('数据源不支持可用性检查');
    }
    const available = await service.checkAvailability();
    result.steps.push({ name: '检查可用性', success: true, available });
    console.log('✅ 可用性检查:', available);
  } catch (error: any) {
    result.steps.push({ name: '检查可用性', success: false, error: error.message });
    console.log('❌ 检查可用性失败:', error);
  }

  // 步骤 3: 基础搜索（不含评论）
  try {
    console.log('\n=== 步骤 3: 基础搜索 ===');
    const service = DataSourceFactory.createDataSource('tikhub');
    const searchResult = await service.searchAndFetch('test', 5);
    result.steps.push({
      name: '基础搜索',
      success: true,
      videoCount: searchResult.videos.length,
      textCount: searchResult.rawTexts.length
    });
    console.log('✅ 基础搜索成功:', searchResult.videos.length, '个视频');
  } catch (error: any) {
    result.steps.push({ name: '基础搜索', success: false, error: error.message, stack: error.stack });
    console.log('❌ 基础搜索失败:', error.message);
    console.log('错误堆栈:', error.stack);
  }

  // 步骤 4: 深度搜索（含评论）
  try {
    console.log('\n=== 步骤 4: 深度搜索 ===');
    const service = DataSourceFactory.createDataSource('tikhub');
    if (typeof service.searchWithComments !== 'function') {
      throw new Error('数据源不支持深度搜索');
    }
    const deepResult = await service.searchWithComments('test', {
      maxVideos: 3,
      maxCommentsPerVideo: 5
    });
    result.steps.push({
      name: '深度搜索',
      success: true,
      videoCount: deepResult.videoCount,
      commentCount: deepResult.commentCount
    });
    console.log('✅ 深度搜索成功');
  } catch (error: any) {
    result.steps.push({ name: '深度搜索', success: false, error: error.message, stack: error.stack });
    console.log('❌ 深度搜索失败:', error.message);
    console.log('错误堆栈:', error.stack);
  }

  return NextResponse.json(result);
}
