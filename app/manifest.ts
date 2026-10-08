import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fico - Money Management Made Simple',
    short_name: 'Fico',
    description: 'Fico is a comprehensive financial management application that helps you track transactions, manage budgets, and take control of your finances.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0066CC',
    shortcuts: [
      { name: 'Add expense', short_name: 'Expense', url: '/dashboard?add=expense', icons: [{ src: '/icon-512.png', sizes: '512x512' }] },
      { name: 'Add income', short_name: 'Income', url: '/dashboard?add=income', icons: [{ src: '/icon-512.png', sizes: '512x512' }] },
      { name: 'Transfer', short_name: 'Transfer', url: '/dashboard?add=transfer', icons: [{ src: '/icon-512.png', sizes: '512x512' }] },
      { name: 'Pay a bill', short_name: 'Bills', url: '/bills', icons: [{ src: '/icon-512.png', sizes: '512x512' }] },
    ],
    icons: [
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
