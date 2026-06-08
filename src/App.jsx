import { Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import { DataProvider } from './contexts/DataContext.jsx'
import Layout from './components/Layout.jsx'
import Auth from './pages/Auth.jsx'
import Pantry from './pages/Pantry.jsx'
import AllRecipes from './pages/AllRecipes.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import RecipeEditor from './pages/RecipeEditor.jsx'
import GroceryList from './pages/GroceryList.jsx'
import Friends from './pages/Friends.jsx'
import Profile from './pages/Profile.jsx'
import InviteAccept from './pages/InviteAccept.jsx'
import { PantryIcon } from './components/icons.jsx'

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-center">
        <div className="mb-2 flex justify-center text-zinc-800"><PantryIcon className="h-12 w-12" /></div>
        <p className="font-bold text-warm-soft">Loading Pantry…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { loading, isAuthed, guest } = useAuth()

  if (loading) return <Splash />
  if (!isAuthed && !guest) return <Auth />

  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Pantry />} />
          <Route path="/recipes" element={<AllRecipes />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/recipe/:id/edit" element={<RecipeEditor />} />
          <Route path="/new" element={<RecipeEditor />} />
          <Route path="/grocery" element={<GroceryList />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/invite/:inviterId" element={<InviteAccept />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Pantry />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
