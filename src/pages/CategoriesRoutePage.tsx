import { CategoriesPage } from '../components/Categories/CategoriesPage'

interface CategoriesRoutePageProps {
  userId: string
}

export function CategoriesRoutePage({ userId }: CategoriesRoutePageProps) {
  return <CategoriesPage userId={userId} />
}
