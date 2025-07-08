import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// 읽을 파일 패턴들
const CODE_FILE_PATTERNS = [
  'app/**/*.tsx',
  'app/**/*.ts', 
  'lib/**/*.ts',
  'utils/**/*.ts',
  'components/**/*.tsx'
]

// 제외할 파일들
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build'
]

// 의미있는 코드 라인을 추출하는 함수
function extractMeaningfulLines(content: string, filename: string): string[] {
  const lines = content.split('\n')
  const meaningfulLines: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // 빈 줄이나 주석만 있는 줄 제외
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue
    }
    
    // 의미있는 패턴들
    if (
      trimmed.includes('useState') ||
      trimmed.includes('useEffect') ||
      trimmed.includes('function ') ||
      trimmed.includes('const ') ||
      trimmed.includes('let ') ||
      trimmed.includes('interface ') ||
      trimmed.includes('type ') ||
      trimmed.includes('class ') ||
      trimmed.includes('import ') ||
      trimmed.includes('export ') ||
      trimmed.includes('async ') ||
      trimmed.includes('await ') ||
      trimmed.includes('=>') ||
      trimmed.includes('return ') ||
      trimmed.includes('.map(') ||
      trimmed.includes('.filter(') ||
      trimmed.includes('.find(') ||
      trimmed.includes('console.log') ||
      trimmed.includes('fetch(') ||
      trimmed.includes('router.') ||
      trimmed.includes('supabase') ||
      trimmed.includes('onClick') ||
      trimmed.includes('onChange') ||
      trimmed.includes('useState<') ||
      trimmed.includes('Props') ||
      trimmed.includes('Response') ||
      trimmed.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*/) // 변수 할당
    ) {
      // 너무 긴 줄은 자르기
      let processedLine = trimmed
      if (processedLine.length > 40) {
        processedLine = processedLine.substring(0, 37) + '...'
      }
      
      // 파일명 정보 추가 (가끔씩)
      if (Math.random() < 0.1) {
        const fileName = path.basename(filename, path.extname(filename))
        meaningfulLines.push(`// ${fileName}`)
      }
      
      meaningfulLines.push(processedLine)
    }
  }
  
  return meaningfulLines
}

// 디렉토리를 재귀적으로 탐색하는 함수
function findCodeFiles(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = []
  
  try {
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      
      // 제외 패턴 체크
      if (EXCLUDE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
        continue
      }
      
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        files.push(...findCodeFiles(fullPath, extensions))
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }
  
  return files
}

export async function GET(request: NextRequest) {
  try {
    const projectRoot = process.cwd()
    const codeSnippets: string[] = []
    
    // 주요 디렉토리들에서 코드 파일 찾기
    const searchDirs = [
      path.join(projectRoot, 'app'),
      path.join(projectRoot, 'lib'), 
      path.join(projectRoot, 'utils'),
      path.join(projectRoot, 'components')
    ]
    
    for (const searchDir of searchDirs) {
      if (fs.existsSync(searchDir)) {
        const files = findCodeFiles(searchDir)
        
        // 파일 개수 제한 (성능을 위해)
        const limitedFiles = files.slice(0, 20)
        
        for (const file of limitedFiles) {
          try {
            const content = fs.readFileSync(file, 'utf-8')
            const meaningful = extractMeaningfulLines(content, file)
            codeSnippets.push(...meaningful)
          } catch (error) {
            console.error(`Error reading file ${file}:`, error)
          }
        }
      }
    }
    
    // 중복 제거 및 셔플
    const uniqueSnippets = Array.from(new Set(codeSnippets))
    const shuffled = uniqueSnippets.sort(() => Math.random() - 0.5)
    
    // 적당한 양으로 제한
    const limited = shuffled.slice(0, 200)
    
    return NextResponse.json({ 
      snippets: limited,
      count: limited.length,
      source: 'live-project-code'
    })
    
  } catch (error) {
    console.error('Error extracting code snippets:', error)
    
    // 오류 시 기본 스니펫 반환
    const fallbackSnippets = [
      'export default function',
      'const [state, setState]',
      'useEffect(() => {',
      'async function fetchData',
      'return NextResponse.json',
      'interface Props {',
      'type CodeSnippet = string'
    ]
    
    return NextResponse.json({ 
      snippets: fallbackSnippets,
      count: fallbackSnippets.length,
      source: 'fallback-snippets'
    })
  }
} 