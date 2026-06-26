import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { Outlet } from 'react-router-dom'

export function MainLayout() {
  return (
    <>
      <Nav />
      <Outlet />
      <Footer />
    </>
  )
}
