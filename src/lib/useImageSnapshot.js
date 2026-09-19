import { useEffect, useRef } from 'react'
import { isExternalImage, snapshotImage } from './imageSnapshot.js'

// Owner opens a recipe whose photo is still a remote link: save our own copy once
// and swap the link. Tried at most once per recipe per session.
const tried = new Set()

export function useImageSnapshot(recipe, user, updateRecipe) {
  const busy = useRef(false)
  useEffect(() => {
    if (!recipe || !user || recipe.authorId !== user.uid) return
    if (!isExternalImage(recipe.imageUrl) || tried.has(recipe.id) || busy.current) return
    tried.add(recipe.id)
    busy.current = true
    snapshotImage(recipe.imageUrl, user.uid)
      .then((next) => (next !== recipe.imageUrl ? updateRecipe(recipe.id, { imageUrl: next }) : null))
      .catch(() => {})
      .finally(() => { busy.current = false })
  }, [recipe?.id, recipe?.imageUrl, user?.uid])
}
