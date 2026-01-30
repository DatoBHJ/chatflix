import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isAdmin } from '@/lib/admin'

const RESULT_FROM_GOOGLE_SEARCH_DIR = path.join(process.cwd(), 'docs', 'searchapi', 'Google AI Mode API', 'result-from-google-search')
const RESULT_DIR = path.join(process.cwd(), 'docs', 'searchapi', 'Google Search', 'result')

// JSON 파일 목록 가져오기
function getJsonFiles(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) {
      return []
    }
    const files = fs.readdirSync(dir)
    return files.filter(file => file.endsWith('.json')).sort()
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
    return []
  }
}

// 파일 내용 읽기
function readJsonFile(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error)
    return null
  }
}

// 파일 목록 가져오기
export async function GET(req: NextRequest) {
  try {
    // Admin 체크
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const filename = searchParams.get('filename')

    // 파일 목록 반환
    if (action === 'list') {
      const aiModeFiles = getJsonFiles(RESULT_FROM_GOOGLE_SEARCH_DIR)
      const resultFiles = getJsonFiles(RESULT_DIR)

      // 파일명 기준으로 매칭 (확장자 제거)
      const matchedFiles = aiModeFiles
        .map(file => {
          const nameWithoutExt = file.replace('.json', '')
          const hasMatch = resultFiles.some(rf => rf.replace('.json', '') === nameWithoutExt)
          return {
            filename: file,
            nameWithoutExt,
            hasAiMode: true,
            hasResult: hasMatch
          }
        })
        .filter(file => file.hasResult) // 양쪽에 모두 있는 파일만

      return NextResponse.json({
        files: matchedFiles,
        total: matchedFiles.length
      })
    }

    // 특정 파일 내용 반환
    if (action === 'content' && filename) {
      const aiModePath = path.join(RESULT_FROM_GOOGLE_SEARCH_DIR, filename)
      const resultPath = path.join(RESULT_DIR, filename)

      const aiModeData = readJsonFile(aiModePath)
      const resultData = readJsonFile(resultPath)

      if (!aiModeData && !resultData) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      return NextResponse.json({
        filename,
        aiMode: aiModeData ? {
          raw: aiModeData,
          formatted: JSON.stringify(aiModeData, null, 2),
          markdown: aiModeData.markdown || null,
          hasMarkdown: !!aiModeData.markdown
        } : null,
        result: resultData ? {
          raw: resultData,
          formatted: JSON.stringify(resultData, null, 2)
        } : null
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in markdown-previewer API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

