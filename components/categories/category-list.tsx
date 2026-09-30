'use client'
import { EmptyState } from '@/components/peacock-mascot'
import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, LayoutGrid, List, Edit2 } from 'lucide-react'
import CategoryModal from './category-modal'
import { useListCategories, useArchiveCategory } from '@/queries/user/category/categories'
import { useTopCategories } from '@/queries/user/transaction/transaction'
import { CategoryCard } from '@/components/page/categories/category-card'

interface CategoryViewModel {
  id: string
  name: string
  type: 'income' | 'expense'
  icon?: string
  color?: string
  status?: 'active' | 'archived'
  transactionCount?: number
}

interface CategoryApiItem {
  _id?: string
  id?: string
  name?: string
  type?: string
  icon?: string
  color?: string
  status?: string
}

const normalizeCategory = (
  category: CategoryApiItem,
  index: number,
  transactionCountByCategoryId: Record<string, number>
): CategoryViewModel => {
  const resolvedId = category._id ?? category.id ?? `category-${index}`

  return {
    id: resolvedId,
    name: category.name || 'Untitled Category',
    type: (category.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
    icon: category.icon,
    color: category.color,
    status: (category.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
    transactionCount: transactionCountByCategoryId[resolvedId] ?? 0,
  }
}

export default function CategoryList() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryViewModel | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: categoryResponse, isLoading, refetch } = useListCategories()
  const { mutate: archiveCategory } = useArchiveCategory()
  const { data: expenseBreakdownResponse } = useTopCategories({ period: 'all', type: 'expense' })
  const { data: incomeBreakdownResponse } = useTopCategories({ period: 'all', type: 'income' })

  const transactionCountByCategoryId = useMemo(() => {
    const rows = [
      ...(expenseBreakdownResponse?.data?.breakdown ?? []),
      ...(incomeBreakdownResponse?.data?.breakdown ?? []),
    ]
    return rows.reduce((acc: Record<string, number>, row: any) => {
      if (row.categoryId) acc[row.categoryId] = row.count
      return acc
    }, {})
  }, [expenseBreakdownResponse, incomeBreakdownResponse])

  const categories = useMemo(() => {
    const responseData = categoryResponse?.data as
      | CategoryApiItem[]
      | { items?: CategoryApiItem[]; categories?: CategoryApiItem[] }
      | undefined

    if (Array.isArray(responseData)) {
      return responseData.map((category, categoryIndex) => normalizeCategory(category, categoryIndex, transactionCountByCategoryId))
    }

    if (responseData && Array.isArray(responseData.items)) {
      return responseData.items.map((category, categoryIndex) => normalizeCategory(category, categoryIndex, transactionCountByCategoryId))
    }

    if (responseData && Array.isArray(responseData.categories)) {
      return responseData.categories.map((category, categoryIndex) => normalizeCategory(category, categoryIndex, transactionCountByCategoryId))
    }

    return []
  }, [categoryResponse, transactionCountByCategoryId])

  const handleArchive = (categoryId: string) => {
    archiveCategory(
      { id: categoryId },
      {
        onSuccess: () => {
          toast.success('Category archived')
          refetch()
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-foreground">All Categories</h2>
        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl">
          <Button
            size="icon"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            className="h-8 w-8 rounded-md"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            className="h-8 w-8 rounded-md"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-32 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : categories.length > 0 ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {categories.map((c) => (
            viewMode === 'grid' ? (
              <CategoryCard 
                key={c.id} 
                {...c} 
                onEdit={() => setSelectedCategory(c)} 
                onArchive={handleArchive}
              />
            ) : (
              <div
                key={c.id}
                className="p-4 bg-card border border-border rounded-xl flex justify-between items-center hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon || <Trash2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{c.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCategory(c)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10"
                    onClick={() => handleArchive(c.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="px-6 py-12 bg-card/30 border border-dashed border-border rounded-2xl">
          <EmptyState pose="advisor" title="No categories found in your account" description="Categories help you see where your money goes.">
            <Button size="lg" className="rounded-full px-8" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Category
            </Button>
          </EmptyState>
        </div>
      )}

      <CategoryModal open={open} onClose={() => setOpen(false)} />
      <CategoryModal open={!!selectedCategory} onClose={() => setSelectedCategory(null)} category={selectedCategory} />
    </div>
  )
}

