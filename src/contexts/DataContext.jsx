import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import * as fs from '../lib/firestore.js'
import { sampleRecipes } from '../data/sampleRecipes.js'

const DataContext = createContext(null)

// Guests get an in-memory copy of the sample recipes (no persistence).
function guestSeed() {
  return sampleRecipes.map((r, i) => ({
    id: `guest-${i}`,
    ...r,
    authorId: 'guest',
    authorName: 'Pantry',
    createdAt: { seconds: Date.now() / 1000 - i },
  }))
}

export function DataProvider({ children }) {
  const { user, profile, guest } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [grocery, setGrocery] = useState([])
  const [guestPantry, setGuestPantry] = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [friends, setFriends] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)

  // ----- Recipes -----
  useEffect(() => {
    if (guest) {
      setRecipes(guestSeed())
      setLoadingRecipes(false)
      return
    }
    if (!user) {
      setRecipes([])
      return
    }
    setLoadingRecipes(true)
    // Seed starter recipes for brand-new accounts, then subscribe.
    fs.seedIfEmpty(user).catch(() => {})
    const unsub = fs.listenMyRecipes(user.uid, (list) => {
      setRecipes(list)
      setLoadingRecipes(false)
    })
    return unsub
  }, [user, guest])

  // ----- Grocery -----
  useEffect(() => {
    if (guest || !user) {
      setGrocery([])
      return
    }
    const unsub = fs.listenGrocery(user.uid, setGrocery)
    return unsub
  }, [user, guest])

  // ----- Friends -----
  // Resolved at the app root, as soon as the profile loads, not when the Friends
  // tab happens to mount — that's what made opening that tab feel slow before:
  // it used to fetch fresh every time you navigated there.
  useEffect(() => {
    if (!profile?.friendIds?.length) {
      setFriends([])
      setLoadingFriends(false)
      return
    }
    let alive = true
    setLoadingFriends(true)
    fs.getUsersByIds(profile.friendIds).then((list) => {
      if (alive) { setFriends(list); setLoadingFriends(false) }
    })
    return () => { alive = false }
  }, [profile?.friendIds])

  const pantryIds = guest ? guestPantry : profile?.pantryIds || []

  const actions = useMemo(
    () => ({
      isInPantry: (id) => pantryIds.includes(id),

      togglePantry: async (id) => {
        if (guest) {
          setGuestPantry((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
          return
        }
        await fs.togglePantry(user.uid, id, pantryIds.includes(id))
      },

      createRecipe: (data) => fs.createRecipe(data, user),
      updateRecipe: (id, data) => fs.updateRecipe(id, data),
      deleteRecipe: (id) => fs.deleteRecipe(id),
      getRecipe: (id) => fs.getRecipe(id),
      pocketRecipe: (recipe) => fs.pocketRecipe(recipe, user),

      addGroceryItems: (items) => fs.addGroceryItems(user.uid, items),
      setGroceryChecked: (itemId, checked) => fs.setGroceryChecked(user.uid, itemId, checked),
      deleteGroceryItem: (itemId) => fs.deleteGroceryItem(user.uid, itemId),
      clearGrocery: (onlyCompleted) => fs.clearGrocery(user.uid, onlyCompleted),
    }),
    [user, guest, pantryIds],
  )

  const value = {
    recipes,
    grocery,
    friends,
    loadingFriends,
    pantryIds,
    pantryRecipes: recipes.filter((r) => pantryIds.includes(r.id)),
    loadingRecipes,
    canWrite: !guest && !!user,
    ...actions,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
