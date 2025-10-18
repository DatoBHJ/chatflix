import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAllMemoryBank } from '@/utils/memory-bank'

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('Memory Bank API - Auth check:', { user: user?.id, error: authError })

    if (authError || !user) {
      console.log('Memory Bank API - Authentication failed:', authError)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get individual category data directly
    const { data: categoryData, error: categoryError } = await supabase
      .from('memory_bank')
      .select('category, content, updated_at, last_refined_at')
      .eq('user_id', user.id)
      .order('category')

    console.log('Memory Bank API - categoryData result:', { 
      userId: user.id, 
      categoriesCount: categoryData?.length,
      error: categoryError 
    })

    if (categoryError) {
      console.error('Error fetching category data:', categoryError)
      return NextResponse.json({ error: 'Failed to fetch memory bank data' }, { status: 500 })
    }

    if (!categoryData || categoryData.length === 0) {
      return NextResponse.json({
        user_id: user.id,
        categories: [],
        last_updated: null,
        timestamp: new Date().toISOString()
      })
    }

    // Find the most recent update time
    const lastUpdated = Math.max(...categoryData.map(cat => new Date(cat.updated_at).getTime()))

    return NextResponse.json({
      user_id: user.id,
      categories: categoryData,
      last_updated: new Date(lastUpdated).toISOString(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing memory bank request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { category, content } = await req.json()

    if (!category || !content) {
      return NextResponse.json({ error: 'Category and content are required' }, { status: 400 })
    }

    // Update the specific category content
    const { data: updatedCategory, error: updateError } = await supabase
      .from('memory_bank')
      .update({ 
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('category', category)
      .select('category, content, updated_at, last_refined_at')
      .single()

    if (updateError) {
      console.error('Error updating category:', updateError)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    if (!updatedCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      category: updatedCategory,
      message: 'Category updated successfully'
    })

  } catch (error) {
    console.error('Error updating memory bank category:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
