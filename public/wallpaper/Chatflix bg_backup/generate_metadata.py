#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
from pathlib import Path
from datetime import datetime

def get_image_metadata(base_path, folder_name, file_path):
    """이미지 파일의 메타데이터를 추출합니다."""
    full_path = base_path / folder_name / file_path.name
    stat_info = full_path.stat()
    
    # 파일 크기 (bytes)
    size = stat_info.st_size
    
    # 생성 날짜 (ISO 8601 형식)
    created_timestamp = stat_info.st_birthtime
    created_date = datetime.fromtimestamp(created_timestamp).isoformat() + 'Z'
    
    # 상대 경로
    relative_path = f"{folder_name}/{file_path.name}"
    
    return {
        "path": relative_path,
        "filename": file_path.name,
        "size": size,
        "createdDate": created_date,
        "keywords": [],
        "links": [],
        "note": ""
    }

def main():
    base_path = Path(__file__).parent
    image_extensions = {'.jpeg', '.jpg', '.png', '.svg', '.JPEG', '.JPG', '.PNG', '.SVG'}
    
    result = {}
    
    # archive 폴더를 제외한 모든 폴더 탐색
    for folder in base_path.iterdir():
        if not folder.is_dir() or folder.name == 'archive':
            continue
        
        folder_name = folder.name
        images = []
        
        # 폴더 내의 모든 이미지 파일 찾기
        for file_path in folder.iterdir():
            if file_path.is_file() and file_path.suffix in image_extensions:
                metadata = get_image_metadata(base_path, folder_name, file_path)
                images.append(metadata)
        
        # 파일명으로 정렬
        images.sort(key=lambda x: x['filename'])
        
        if images:
            result[folder_name] = images
    
    # JSON 파일로 저장
    output_path = base_path / 'images_metadata.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"✅ JSON 파일이 생성되었습니다: {output_path}")
    print(f"📁 총 {len(result)} 개의 폴더, {sum(len(images) for images in result.values())} 개의 이미지가 포함되었습니다.")

if __name__ == "__main__":
    main()

